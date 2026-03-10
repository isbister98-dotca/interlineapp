import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { sql } from '../../../lib/db.js';

// Downloads the ZIP once and stores each .txt file's content in gtfs_cache table.
// This means we only download the ZIP one time regardless of how many tables we load.
export async function POST(request) {
  try {
    const { url, name } = await request.json();
    if (!url || !name) return Response.json({ success: false, error: 'Missing url or name' }, { status: 400 });

    // Upsert feed source
    await sql`
      INSERT INTO feed_sources (name, url, status)
      VALUES (${name}, ${url}, 'caching')
      ON CONFLICT (url) DO UPDATE SET name = ${name}, status = 'caching', loaded_at = NULL
    `;

    // Clear any existing cache for this URL
    await sql`DELETE FROM gtfs_cache WHERE feed_url = ${url}`;

    // Download the ZIP
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ZIP`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = new AdmZip(buffer);

    const fileSizes = {};

    for (const entry of zip.getEntries()) {
      if (!entry.entryName.endsWith('.txt')) continue;
      const filename = entry.entryName.toLowerCase().replace(/^.*\//, '').replace('.txt', '');
      try {
        const content = entry.getData().toString('utf8');
        // Count rows
        const rows = parse(content, {
          columns: true, skip_empty_lines: true, trim: true,
          relax_column_count: true, relax_quotes: true, skip_records_with_error: true
        });
        // Store raw CSV content in cache
        await sql`
          INSERT INTO gtfs_cache (feed_url, filename, content, row_count)
          VALUES (${url}, ${filename}, ${content}, ${rows.length})
          ON CONFLICT (feed_url, filename) DO UPDATE SET content = ${content}, row_count = ${rows.length}, created_at = NOW()
        `;
        fileSizes[filename] = rows.length;
      } catch (e) {
        console.warn(`Could not cache ${filename}:`, e.message);
        fileSizes[filename] = 0;
      }
    }

    await sql`UPDATE feed_sources SET status = 'cached' WHERE url = ${url}`;
    return Response.json({ success: true, fileSizes });
  } catch (error) {
    console.error('cache-zip error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
