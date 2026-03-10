import { sql } from '../../../lib/db.js';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

// Helper: fetch a ZIP from URL and return parsed CSV files
async function fetchAndParseGTFS(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = new AdmZip(buffer);
  const files = {};
  for (const entry of zip.getEntries()) {
    if (entry.entryName.endsWith('.txt')) {
      const key = entry.entryName.replace('.txt', '').toLowerCase().replace(/^.*\//, '');
      try {
        const content = entry.getData().toString('utf8');
        files[key] = parse(content, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
      } catch (e) {
        console.warn(`Could not parse ${entry.entryName}:`, e.message);
      }
    }
  }
  return files;
}

// Helper: bulk insert rows in batches to avoid hitting query limits
async function bulkInsert(tableName, columns, rows, feedSource) {
  if (!rows || rows.length === 0) return 0;
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values = batch.map(row =>
      `(${[feedSource, ...columns.map(c => row[c] ?? null)].map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`).join(',')})`
    ).join(',');
    const colList = ['feed_source', ...columns].join(',');
    try {
      await sql.unsafe(`INSERT INTO ${tableName} (${colList}) VALUES ${values} ON CONFLICT DO NOTHING`);
      inserted += batch.length;
    } catch (e) {
      console.warn(`Batch insert error in ${tableName}:`, e.message);
    }
  }
  return inserted;
}

export async function POST(request) {
  try {
    const { url, name } = await request.json();
    if (!url || !name) return Response.json({ success: false, error: 'Missing url or name' }, { status: 400 });

    // Update status to loading
    await sql`UPDATE feed_sources SET status = 'loading' WHERE url = ${url}`;

    // Fetch and parse the GTFS zip
    const files = await fetchAndParseGTFS(url);
    const summary = [];

    // Load agencies
    if (files.agency) {
      const n = await bulkInsert('agencies',
        ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang', 'agency_phone'],
        files.agency, name);
      summary.push(`${n} agencies`);
    }

    // Load routes
    if (files.routes) {
      const n = await bulkInsert('routes',
        ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color', 'route_text_color'],
        files.routes, name);
      summary.push(`${n} routes`);
    }

    // Load stops
    if (files.stops) {
      const n = await bulkInsert('stops',
        ['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'stop_code', 'zone_id'],
        files.stops, name);
      summary.push(`${n} stops`);
    }

    // Load trips
    if (files.trips) {
      const n = await bulkInsert('trips',
        ['trip_id', 'route_id', 'service_id', 'trip_headsign', 'direction_id', 'shape_id'],
        files.trips, name);
      summary.push(`${n} trips`);
    }

    // Load calendar
    if (files.calendar) {
      const n = await bulkInsert('calendar',
        ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
        files.calendar, name);
      summary.push(`${n} calendar entries`);
    }

    // Load stop_times — limit to 50k rows to avoid timeouts on large feeds
    if (files.stop_times) {
      const slice = files.stop_times.slice(0, 50000);
      const n = await bulkInsert('stop_times',
        ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence'],
        slice, name);
      summary.push(`${n} stop times (capped at 50k)`);
    }

    const summaryText = summary.join(', ');
    const totalRows = summary.reduce((acc, s) => acc + (parseInt(s) || 0), 0);

    await sql`
      UPDATE feed_sources
      SET status = 'loaded', loaded_at = NOW(), row_count = ${totalRows}
      WHERE url = ${url}
    `;

    return Response.json({ success: true, summary: summaryText });
  } catch (error) {
    console.error('load-gtfs error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
