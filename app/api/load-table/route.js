import { parse } from 'csv-parse/sync';
import { sql } from '../../../lib/db.js';

const TABLE_COLUMNS = {
  agencies:        { table: 'agencies',        file: 'agency',         columns: ['agency_id','agency_name','agency_url','agency_timezone','agency_lang','agency_phone','agency_fare_url','cemv_support'], conflict: null },
  routes:          { table: 'routes',          file: 'routes',         columns: ['route_id','agency_id','route_short_name','route_long_name','route_desc','route_type','route_url','route_color','route_text_color'], conflict: 'ON CONFLICT (feed_source, route_id) DO NOTHING' },
  stops:           { table: 'stops',           file: 'stops',          columns: ['stop_id','stop_code','stop_name','stop_desc','stop_lat','stop_lon','zone_id','stop_url','location_type','parent_station','stop_timezone','wheelchair_boarding'], conflict: 'ON CONFLICT (feed_source, stop_id) DO NOTHING' },
  trips:           { table: 'trips',           file: 'trips',          columns: ['trip_id','route_id','service_id','trip_headsign','trip_short_name','direction_id','block_id','shape_id','wheelchair_accessible','bikes_allowed'], conflict: 'ON CONFLICT (feed_source, trip_id) DO NOTHING' },
  calendar:        { table: 'calendar',        file: 'calendar',       columns: ['service_id','monday','tuesday','wednesday','thursday','friday','saturday','sunday','start_date','end_date'], conflict: null },
  calendar_dates:  { table: 'calendar_dates',  file: 'calendar_dates', columns: ['service_id','date','exception_type'], conflict: null },
  shapes:          { table: 'shapes',          file: 'shapes',         columns: ['shape_id','shape_pt_lat','shape_pt_lon','shape_pt_sequence','shape_dist_traveled'], conflict: null, chunked: true },
  stop_times:      { table: 'stop_times',      file: 'stop_times',     columns: ['trip_id','arrival_time','departure_time','stop_id','stop_sequence','stop_headsign','pickup_type','drop_off_type','shape_dist_traveled'], conflict: null, chunked: true },
  stop_amenities:  { table: 'stop_amenities',  file: 'stop_amenities', columns: ['stop_id','shelter','washroom','bike_rack','bench'], conflict: null },
  transfers:       { table: 'transfers',       file: 'transfers',      columns: ['from_stop_id','to_stop_id','transfer_type','min_transfer_time'], conflict: null },
  fare_attributes: { table: 'fare_attributes', file: 'fare_attributes',columns: ['fare_id','price','currency_type','payment_method','transfers'], conflict: null },
  fare_rules:      { table: 'fare_rules',      file: 'fare_rules',     columns: ['fare_id','origin_id','destination_id'], conflict: null },
  feed_info:       { table: 'feed_info',       file: 'feed_info',      columns: ['feed_publisher_name','feed_publisher_url','feed_lang','default_lang','feed_start_date','feed_end_date','feed_version','feed_contact_email','feed_contact_url'], conflict: null },
};

async function bulkInsert(tableName, columns, rows, feedSource, isFirstChunk = false) {
  if (!rows || rows.length === 0) return 0;
  const BATCH = 500;
  let inserted = 0;
  // Delete existing rows for this feed on first chunk only
  if (isFirstChunk) {
    await sql.unsafe(`DELETE FROM ${tableName} WHERE feed_source = '${feedSource.replace(/'/g, "''")}'`);
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values = batch.map(row =>
      `(${[feedSource, ...columns.map(c => row[c] ?? null)]
        .map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
        .join(',')})`
    ).join(',');
    const colList = ['feed_source', ...columns].join(',');
    await sql.unsafe(`INSERT INTO ${tableName} (${colList}) VALUES ${values}`);
    inserted += batch.length;
  }
  return inserted;
}

export async function POST(request) {
  try {
    const { url, name, tableKey, offset = 0 } = await request.json();
    if (!url || !name || !tableKey) return Response.json({ success: false, error: 'Missing url, name, or tableKey' }, { status: 400 });

    const def = TABLE_COLUMNS[tableKey];
    if (!def) return Response.json({ success: false, error: `Unknown table: ${tableKey}` }, { status: 400 });

    let rows, total, done;

    if (def.chunked) {
      // ── Chunked file (shapes) ──
      const metaResult = await sql`
        SELECT content FROM gtfs_cache WHERE feed_url = ${url} AND filename = ${def.file + '_meta'}
      `;

      if (!metaResult || metaResult.length === 0) {
        return Response.json({ success: true, inserted: 0, total: 0, done: true, message: `${def.file} not found in cache` });
      }

      const meta = JSON.parse(metaResult[0].content);
      total = meta.totalRows;
      const totalChunks = meta.totalChunks;
      const chunkKey = `${def.file}_chunk_${offset}`;

      const chunkResult = await sql`
        SELECT content FROM gtfs_cache WHERE feed_url = ${url} AND filename = ${chunkKey}
      `;

      if (!chunkResult || chunkResult.length === 0) {
        return Response.json({ success: true, inserted: 0, total, done: true, message: `Chunk ${offset} not found` });
      }

      rows = JSON.parse(chunkResult[0].content);
      done = offset >= totalChunks - 1;
      const inserted = await bulkInsert(def.table, def.columns, rows, name, offset === 0);
      
      if (done) {
        await sql`UPDATE feed_sources SET status = 'loaded', loaded_at = NOW() WHERE url = ${url}`;
        if (tableKey === 'stop_times') {
          await sql`DELETE FROM gtfs_cache WHERE feed_url = ${url}`;
        }
      }

      return Response.json({ success: true, inserted, total, done, offset });

    } else {
      // ── Regular full-text file ──
      const cached = await sql`
        SELECT content, row_count FROM gtfs_cache WHERE feed_url = ${url} AND filename = ${def.file}
      `;

      if (!cached || cached.length === 0) {
        return Response.json({ success: true, inserted: 0, total: 0, done: true, message: `${def.file}.txt not found in this feed` });
      }

      const rawContent = cached[0].content;
      const cleanContent = rawContent.charCodeAt(0) === 0xFEFF ? rawContent.slice(1) : rawContent;
      rows = parse(cleanContent, {
        columns: true, skip_empty_lines: true, trim: true,
        relax_column_count: true, relax_quotes: true, skip_records_with_error: true
      });
      total = rows.length;
      done = true;

      // Boolean conversion for calendar
      if (tableKey === 'calendar') {
        rows = rows.map(r => ({
          ...r,
          monday: r.monday === '1' ? 'true' : 'false',
          tuesday: r.tuesday === '1' ? 'true' : 'false',
          wednesday: r.wednesday === '1' ? 'true' : 'false',
          thursday: r.thursday === '1' ? 'true' : 'false',
          friday: r.friday === '1' ? 'true' : 'false',
          saturday: r.saturday === '1' ? 'true' : 'false',
          sunday: r.sunday === '1' ? 'true' : 'false',
        }));
      }

      // Store feed_version when loading feed_info
      if (tableKey === 'feed_info' && rows.length > 0) {
        const version = rows[0].feed_version || null;
        if (version) {
          await sql`UPDATE feed_sources SET feed_version = ${version} WHERE url = ${url}`;
        }
      }

      const inserted = await bulkInsert(def.table, def.columns, rows, name, true);
      return Response.json({ success: true, inserted, total, done, offset });
    }
  } catch (error) {
    console.error('load-table error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
