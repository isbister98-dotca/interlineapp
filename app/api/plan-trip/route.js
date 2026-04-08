import { sql } from '../../../lib/db.js';

/**
 * POST /api/plan-trip
 * Transit trip planner with 1-transfer support.
 *
 * Body: { from_lat, from_lng, to_lat, to_lng, depart_secs }
 * Returns: array of itineraries (direct + 1-transfer)
 *
 * Transfer detection uses the same 3 strategies as build_route_stop_cache_row:
 *   1. Same stop_id (different route, same agency)
 *   2. stop_proximity table (200m same-agency, 300m cross-agency)
 *   3. Station name prefix matching ("Spadina Station - NB Platform" → "Spadina Station")
 */

export const maxDuration = 15;

const WALK_SPEED = 1.3;       // m/s (~4.7 km/h)
const MAX_WALK_M = 800;       // max walk to/from a stop
const TRANSFER_MIN_SECS = 90; // minimum transfer time
const SEARCH_WINDOW = 3600;   // 60 min lookahead

export async function POST(request) {
  try {
    const body = await request.json();
    const { from_lat, from_lng, to_lat, to_lng, depart_secs } = body;

    if (!from_lat || !from_lng || !to_lat || !to_lng || depart_secs == null) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // ── Step 1: Find nearby stops ──────────────────────────────────────────
    const [originStops, destStops] = await Promise.all([
      findNearbyStops(from_lat, from_lng, MAX_WALK_M),
      findNearbyStops(to_lat, to_lng, MAX_WALK_M),
    ]);

    if (originStops.length === 0 || destStops.length === 0) {
      return Response.json([]);
    }

    const originIds = originStops.map(s => s.stop_id);
    const destIds = destStops.map(s => s.stop_id);
    const originMap = Object.fromEntries(originStops.map(s => [`${s.feed_source}:${s.stop_id}`, s]));
    const destMap = Object.fromEntries(destStops.map(s => [`${s.feed_source}:${s.stop_id}`, s]));

    // ── Step 2: Direct rides ───────────────────────────────────────────────
    const direct = await findDirectRides(originIds, destIds, depart_secs, originMap, destMap);

    // ── Step 3: 1-transfer rides ───────────────────────────────────────────
    const transfers = await findTransferRides(originIds, destIds, depart_secs, originMap, destMap);

    // ── Step 4: Dedupe, sort, return ───────────────────────────────────────
    const all = dedup([...direct, ...transfers])
      .sort((a, b) => a.total_secs - b.total_secs)
      .slice(0, 8);

    return Response.json(all);
  } catch (error) {
    console.error('[plan-trip] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ─── Nearby stops ──────────────────────────────────────────────────────────

async function findNearbyStops(lat, lng, radiusM) {
  const box = radiusM / 111000;
  const rows = await sql`
    SELECT stop_id, stop_name, feed_source, parent_station,
           stop_lat::float8 AS lat, stop_lon::float8 AS lng
    FROM stops
    WHERE stop_lat BETWEEN ${lat - box}::numeric AND ${lat + box}::numeric
      AND stop_lon BETWEEN ${lng - box}::numeric AND ${lng + box}::numeric
  `;

  return rows
    .map(r => ({ ...r, dist_m: haversineM(lat, lng, r.lat, r.lng) }))
    .filter(r => r.dist_m <= radiusM)
    .sort((a, b) => a.dist_m - b.dist_m)
    .slice(0, 30);
}

// ─── Direct rides ──────────────────────────────────────────────────────────

async function findDirectRides(originIds, destIds, departSecs, originMap, destMap) {
  if (!originIds.length || !destIds.length) return [];

  const rows = await sql`
    WITH from_times AS (
      SELECT st.trip_id, st.feed_source, st.stop_id,
             st.stop_sequence, st.departure_time
      FROM stop_times st
      WHERE st.stop_id IN ${sql(originIds)}
        AND st.departure_time >= ${departSecs}
        AND st.departure_time <= ${departSecs + SEARCH_WINDOW}
    ),
    to_times AS (
      SELECT st.trip_id, st.feed_source, st.stop_id,
             st.stop_sequence, st.arrival_time
      FROM stop_times st
      WHERE st.stop_id IN ${sql(destIds)}
    ),
    connections AS (
      SELECT ft.trip_id, ft.feed_source,
             ft.stop_id AS board_sid, ft.departure_time AS board_time,
             tt.stop_id AS alight_sid, tt.arrival_time AS alight_time
      FROM from_times ft
      JOIN to_times tt
        ON tt.trip_id = ft.trip_id AND tt.feed_source = ft.feed_source
       AND tt.stop_sequence > ft.stop_sequence
       AND tt.arrival_time > ft.departure_time
    ),
    ranked AS (
      SELECT c.*,
        COALESCE(r.route_short_name, r.route_long_name) AS route_name,
        r.route_color, r.route_id, t.trip_headsign,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(r.route_short_name, r.route_long_name)
          ORDER BY (c.alight_time - c.board_time)
        ) AS rn
      FROM connections c
      JOIN trips  t ON t.trip_id  = c.trip_id  AND t.feed_source = c.feed_source
      JOIN routes r ON r.route_id = t.route_id AND r.feed_source = c.feed_source
    )
    SELECT * FROM ranked WHERE rn = 1
    ORDER BY (alight_time - board_time) LIMIT 5
  `;

  return rows.map(r => {
    const oKey = `${r.feed_source}:${r.board_sid}`;
    const dKey = `${r.feed_source}:${r.alight_sid}`;
    const o = originMap[oKey];
    const d = destMap[dKey];
    const walkTo = Math.round((o?.dist_m ?? 400) / WALK_SPEED);
    const walkFrom = Math.round((d?.dist_m ?? 400) / WALK_SPEED);
    const transit = r.alight_time - r.board_time;

    return {
      type: 'direct',
      route: r.route_name,
      route_color: r.route_color,
      route_id: r.route_id,
      headsign: r.trip_headsign,
      feed_source: r.feed_source,
      board_stop: o?.stop_name ?? '',
      board_coord: [o?.lng ?? 0, o?.lat ?? 0],
      alight_stop: d?.stop_name ?? '',
      alight_coord: [d?.lng ?? 0, d?.lat ?? 0],
      board_time_secs: r.board_time,
      alight_time_secs: r.alight_time,
      walk_to_m: Math.round(o?.dist_m ?? 0),
      walk_to_secs: walkTo,
      walk_from_m: Math.round(d?.dist_m ?? 0),
      walk_from_secs: walkFrom,
      transit_secs: transit,
      total_secs: walkTo + transit + walkFrom,
    };
  });
}

// ─── 1-transfer rides ──────────────────────────────────────────────────────

async function findTransferRides(originIds, destIds, departSecs, originMap, destMap) {
  if (!originIds.length || !destIds.length) return [];

  // Leg 1: trips from origin stops → all their subsequent stops at "stations"
  // (stations = stops with parent_station OR stops named "... Station ...")
  const leg1 = await sql`
    WITH from_dep AS (
      SELECT st.trip_id, st.feed_source, st.stop_id AS board_sid,
             st.stop_sequence AS board_seq, st.departure_time AS board_time
      FROM stop_times st
      WHERE st.stop_id IN ${sql(originIds)}
        AND st.departure_time >= ${departSecs}
        AND st.departure_time <= ${departSecs + SEARCH_WINDOW}
    ),
    subsequent AS (
      SELECT fd.trip_id, fd.feed_source, fd.board_sid, fd.board_time,
             st.stop_id AS xfer_sid, st.arrival_time AS xfer_arrive,
             s.stop_name AS xfer_name,
             s.stop_lat::float8 AS xfer_lat, s.stop_lon::float8 AS xfer_lng
      FROM from_dep fd
      JOIN stop_times st
        ON st.trip_id = fd.trip_id AND st.feed_source = fd.feed_source
       AND st.stop_sequence > fd.board_seq
       AND st.arrival_time > fd.board_time
      JOIN stops s ON s.stop_id = st.stop_id AND s.feed_source = st.feed_source
    ),
    with_routes AS (
      SELECT sub.*,
        COALESCE(r.route_short_name, r.route_long_name) AS r1_name,
        r.route_color AS r1_color, r.route_id AS r1_id,
        t.trip_headsign AS r1_headsign
      FROM subsequent sub
      JOIN trips  t ON t.trip_id  = sub.trip_id  AND t.feed_source = sub.feed_source
      JOIN routes r ON r.route_id = t.route_id AND r.feed_source = sub.feed_source
    )
    SELECT DISTINCT ON (r1_name, xfer_sid)
      feed_source, board_sid, board_time,
      xfer_sid, xfer_arrive, xfer_name, xfer_lat, xfer_lng,
      r1_name, r1_color, r1_id, r1_headsign
    FROM with_routes
    ORDER BY r1_name, xfer_sid, (xfer_arrive - board_time)
    LIMIT 100
  `;

  if (leg1.length === 0) return [];

  // Build a set of transfer stop_ids and their feed_sources
  const xferStops = leg1.map(l => ({ sid: l.xfer_sid, feed: l.feed_source }));
  const xferSids = [...new Set(xferStops.map(x => x.sid))];

  // Find all reachable stop_ids from transfer stops via:
  //   1. Same stop_id (implicit — already in xferSids)
  //   2. stop_proximity table
  //   3. Station name prefix (parent_station or name matching)
  const proximityPeers = await sql`
    SELECT stop_id_1 AS from_sid, feed_source_1 AS from_feed,
           stop_id_2 AS to_sid, feed_source_2 AS to_feed
    FROM stop_proximity
    WHERE stop_id_1 IN ${sql(xferSids)}
  `;

  const stationPeers = await sql`
    SELECT s1.stop_id AS from_sid, s1.feed_source AS from_feed,
           s2.stop_id AS to_sid, s2.feed_source AS to_feed
    FROM stops s1
    JOIN stops s2
      ON s2.feed_source = s1.feed_source
     AND s2.stop_id != s1.stop_id
     AND SPLIT_PART(s2.stop_name, ' - ', 1) = SPLIT_PART(s1.stop_name, ' - ', 1)
     AND s1.stop_name LIKE '%Station%'
    WHERE s1.stop_id IN ${sql(xferSids)}
  `;

  // Build transfer map: from_sid → [peer sids with feed]
  const xferPeers = {};
  for (const sid of xferSids) {
    xferPeers[sid] = [{ sid, feed: null }]; // same stop is always a peer
  }
  for (const p of proximityPeers) {
    if (!xferPeers[p.from_sid]) xferPeers[p.from_sid] = [];
    xferPeers[p.from_sid].push({ sid: p.to_sid, feed: p.to_feed });
  }
  for (const p of stationPeers) {
    if (!xferPeers[p.from_sid]) xferPeers[p.from_sid] = [];
    xferPeers[p.from_sid].push({ sid: p.to_sid, feed: p.to_feed });
  }

  // Collect all possible leg2 boarding stops
  const allLeg2Sids = new Set();
  for (const peers of Object.values(xferPeers)) {
    for (const p of peers) allLeg2Sids.add(p.sid);
  }
  const leg2BoardSids = [...allLeg2Sids];

  if (leg2BoardSids.length === 0) return [];

  // Leg 2: trips from transfer peer stops → destination stops
  const leg2 = await sql`
    WITH xfer_dep AS (
      SELECT st.trip_id, st.feed_source, st.stop_id AS board_sid,
             st.stop_sequence AS board_seq, st.departure_time AS board_time
      FROM stop_times st
      WHERE st.stop_id IN ${sql(leg2BoardSids)}
        AND st.departure_time >= ${departSecs}
        AND st.departure_time <= ${departSecs + SEARCH_WINDOW + 1800}
    ),
    to_hits AS (
      SELECT xd.trip_id, xd.feed_source, xd.board_sid AS xfer_board_sid,
             xd.board_time AS xfer_board_time,
             st.stop_id AS alight_sid, st.arrival_time AS alight_time
      FROM xfer_dep xd
      JOIN stop_times st
        ON st.trip_id = xd.trip_id AND st.feed_source = xd.feed_source
       AND st.stop_sequence > xd.board_seq
       AND st.arrival_time > xd.board_time
      WHERE st.stop_id IN ${sql(destIds)}
    ),
    with_routes AS (
      SELECT th.*,
        COALESCE(r.route_short_name, r.route_long_name) AS r2_name,
        r.route_color AS r2_color, r.route_id AS r2_id,
        t.trip_headsign AS r2_headsign,
        s.stop_name AS xfer_board_name
      FROM to_hits th
      JOIN trips  t ON t.trip_id  = th.trip_id  AND t.feed_source = th.feed_source
      JOIN routes r ON r.route_id = t.route_id AND r.feed_source = th.feed_source
      JOIN stops  s ON s.stop_id  = th.xfer_board_sid AND s.feed_source = th.feed_source
    )
    SELECT DISTINCT ON (xfer_board_sid, r2_name)
      feed_source, xfer_board_sid, xfer_board_time, xfer_board_name,
      alight_sid, alight_time,
      r2_name, r2_color, r2_id, r2_headsign
    FROM with_routes
    ORDER BY xfer_board_sid, r2_name, (alight_time - xfer_board_time)
    LIMIT 100
  `;

  if (leg2.length === 0) return [];

  // Build leg2 lookup: xfer_board_sid → [leg2 options]
  const leg2BySid = {};
  for (const l of leg2) {
    if (!leg2BySid[l.xfer_board_sid]) leg2BySid[l.xfer_board_sid] = [];
    leg2BySid[l.xfer_board_sid].push(l);
  }

  // Combine leg1 + leg2
  const results = [];

  for (const l1 of leg1) {
    const peers = xferPeers[l1.xfer_sid] ?? [];
    for (const peer of peers) {
      const options = leg2BySid[peer.sid] ?? [];
      for (const l2 of options) {
        // Different routes
        if (l1.r1_name === l2.r2_name) continue;

        // Leg2 must depart after leg1 arrives + transfer time
        if (l2.xfer_board_time < l1.xfer_arrive + TRANSFER_MIN_SECS) continue;

        // Skip if transfer wait > 20 min
        const xferWait = l2.xfer_board_time - l1.xfer_arrive;
        if (xferWait > 1200) continue;

        const oKey = `${l1.feed_source}:${l1.board_sid}`;
        const dKey = `${l2.feed_source}:${l2.alight_sid}`;
        const o = originMap[oKey];
        const d = destMap[dKey];
        if (!o || !d) continue;

        const walkTo = Math.round(o.dist_m / WALK_SPEED);
        const walkFrom = Math.round(d.dist_m / WALK_SPEED);
        const ride1 = l1.xfer_arrive - l1.board_time;
        const ride2 = l2.alight_time - l2.xfer_board_time;
        const total = walkTo + ride1 + xferWait + ride2 + walkFrom;

        results.push({
          type: 'transfer',
          route: l1.r1_name,
          route_color: l1.r1_color,
          route_id: l1.r1_id,
          headsign: l1.r1_headsign,
          feed_source: l1.feed_source,
          board_stop: o.stop_name,
          board_coord: [o.lng, o.lat],
          alight_stop: l1.xfer_name,
          alight_coord: [l1.xfer_lng, l1.xfer_lat],
          board_time_secs: l1.board_time,
          alight_time_secs: l1.xfer_arrive,
          // Transfer info
          transfer_stop: l2.xfer_board_name,
          transfer_wait_secs: xferWait,
          // Second leg
          route2: l2.r2_name,
          route2_color: l2.r2_color,
          route2_id: l2.r2_id,
          headsign2: l2.r2_headsign,
          feed_source2: l2.feed_source,
          route2_board_time_secs: l2.xfer_board_time,
          route2_alight_time_secs: l2.alight_time,
          route2_alight_stop: d.stop_name,
          route2_alight_coord: [d.lng, d.lat],
          // Totals
          walk_to_m: Math.round(o.dist_m),
          walk_to_secs: walkTo,
          walk_from_m: Math.round(d.dist_m),
          walk_from_secs: walkFrom,
          transit_secs: ride1 + ride2,
          total_secs: total,
        });
      }
    }
  }

  return results;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function dedup(results) {
  const seen = new Set();
  return results.filter(r => {
    const key = r.type === 'direct'
      ? `d:${r.route}`
      : `t:${r.route}→${r.route2}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
