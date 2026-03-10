import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { sql } from '../../../lib/db.js';

const CHUNK_ROWS = 5000; // rows per chunk for large files
const CHUNKED_FILES = ['shapes', 'stop_times']; // these get chunked, not full-text cached
const SKIP_FILES = ['stop_times']; // handled entirely by Supabase Edge Function

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

    // Clear existing cache for this URL
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

        if (SKIP_FILES.includes(filename)) {
          // Parse just to count rows, don't cache — Edge Function handles this
          const rows = parse(content, {
            columns: true, skip_empty_lines: true, trim: true,
            relax_column_count: true, relax_quotes: true, skip_records_with_error: true
          });
          fileSizes[filename] = rows.length;
          fileSizes[`${filename}_note`] = 'handled_by_edge_function';
          continue;
        }

        const rows = parse(content, {
          columns: true, skip_empty_lines: true, trim: true,
          relax_column_count: true, relax_quotes: true, skip_records_with_error: true
        });

        if (CHUNKED_FILES.includes(filename) && rows.length > CHUNK_ROWS) {
          // Store in chunks as JSON arrays
          const totalChunks = Math.ceil(rows.length / CHUNK_ROWS);

          // Store metadata entry
          const meta = JSON.stringify({ totalChunks, totalRows: rows.length });
          await sql`
            INSERT INTO gtfs_cache (feed_url, filename, content, row_count)
            VALUES (${url}, ${filename + '_meta'}, ${meta}, ${rows.length})
            ON CONFLICT (feed_url, filename) DO UPDATE
              SET content = ${meta}, row_count = ${rows.length}, created_at = NOW()
          `;

          // Store each chunk
          for (let i = 0; i < totalChunks; i++) {
            const chunk = rows.slice(i * CHUNK_ROWS, (i + 1) * CHUNK_ROWS);
            const chunkKey = `${filename}_chunk_${i}`;
            const chunkContent = JSON.stringify(chunk);
            await sql`
              INSERT INTO gtfs_cache (feed_url, filename, content, row_count)
              VALUES (${url}, ${chunkKey}, ${chunkContent}, ${chunk.length})
              ON CONFLICT (feed_url, filename) DO UPDATE
                SET content = ${chunkContent}, row_count = ${chunk.length}, created_at = NOW()
            `;
          }

          fileSizes[filename] = rows.length;
        } else {
          // Store as full text for small files
          await sql`
            INSERT INTO gtfs_cache (feed_url, filename, content, row_count)
            VALUES (${url}, ${filename}, ${content}, ${rows.length})
            ON CONFLICT (feed_url, filename) DO UPDATE
              SET content = ${content}, row_count = ${rows.length}, created_at = NOW()
          `;
          fileSizes[filename] = rows.length;
        }
      } catch (e) {
        console.warn(`Could not process ${filename}:`, e.message);
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
