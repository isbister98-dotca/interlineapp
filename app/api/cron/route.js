import { sql } from '../../../lib/db.js';

// Called nightly by Vercel Cron at 3am UTC
// Checks feed_version for each stored feed and triggers reload if changed
export async function GET(request) {
  // Verify this is being called by Vercel Cron (or manually with the secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`;
  const supabaseUrl = process.env.APP_DB_URL;
  const supabaseKey = process.env.APP_SERVICE_KEY;

  try {
    // Get all loaded feeds
    const feeds = await sql`
      SELECT name, url, feed_version, status
      FROM feed_sources
      WHERE status IN ('loaded', 'cached')
      ORDER BY name
    `;

    const results = [];

    for (const feed of feeds) {
      try {
        // Download just feed_info.txt to check version
        // We fetch the full ZIP but only read feed_info — it's first in the ZIP
        const zipResponse = await fetch(feed.url, { signal: AbortSignal.timeout(60000) });
        if (!zipResponse.ok) {
          results.push({ feed: feed.name, status: 'error', error: `HTTP ${zipResponse.status}` });
          continue;
        }

        const buffer = Buffer.from(await zipResponse.arrayBuffer());
        const AdmZip = (await import('adm-zip')).default;
        const zip = new AdmZip(buffer);

        const feedInfoEntry = zip.getEntries().find(e =>
          e.entryName.toLowerCase().replace(/^.*\//, '') === 'feed_info.txt'
        );

        if (!feedInfoEntry) {
          await sql`UPDATE feed_sources SET last_version_check = NOW() WHERE url = ${feed.url}`;
          results.push({ feed: feed.name, status: 'skipped', reason: 'no feed_info.txt' });
          continue;
        }

        const content = feedInfoEntry.getData().toString('utf8');
        const lines = content.split('\n').filter(l => l.trim());
        if (lines.length < 2) {
          await sql`UPDATE feed_sources SET last_version_check = NOW() WHERE url = ${feed.url}`;
          results.push({ feed: feed.name, status: 'skipped', reason: 'empty feed_info.txt' });
          continue;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const values = lines[1].split(',').map(v => v.trim());
        const versionIdx = headers.findIndex(h => h.includes('feed_version'));
        const newVersion = versionIdx >= 0 ? values[versionIdx] : null;

        if (!newVersion || newVersion === feed.feed_version) {
          // Update last check timestamp even if no change
          await sql`
            UPDATE feed_sources SET last_version_check = NOW() WHERE url = ${feed.url}
          `;
          results.push({ feed: feed.name, status: 'unchanged', version: newVersion });
          continue;
        }

        // Version changed — trigger full reload of small/medium tables
        results.push({ feed: feed.name, status: 'update_detected', oldVersion: feed.feed_version, newVersion });

        // Re-cache the ZIP
        await fetch(`${baseUrl}/api/cache-zip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: feed.url, name: feed.name }),
        });

        // Load all non-stop_times tables
        const tables = ['feed_info','agencies','routes','stops','trips','calendar','calendar_dates','transfers','fare_attributes','fare_rules','stop_amenities','shapes'];
        for (const tableKey of tables) {
          const isChunked = tableKey === 'shapes';
          if (isChunked) {
            // Load chunks sequentially
            let offset = 0;
            while (true) {
              const res = await fetch(`${baseUrl}/api/load-table`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: feed.url, name: feed.name, tableKey, offset }),
              });
              const data = await res.json();
              if (data.done || !data.success) break;
              offset++;
            }
          } else {
            await fetch(`${baseUrl}/api/load-table`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: feed.url, name: feed.name, tableKey }),
            });
          }
        }

        // Trigger stop_times Edge Function
        if (supabaseUrl && supabaseKey) {
          await fetch(`${supabaseUrl}/functions/v1/load-stop-times`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ feedUrl: feed.url, feedName: feed.name }),
          });
        }

        await sql`UPDATE feed_sources SET last_version_check = NOW(), feed_version = ${newVersion} WHERE url = ${feed.url}`;

      } catch (e) {
        results.push({ feed: feed.name, status: 'error', error: e.message });
      }
    }

    return Response.json({ success: true, checkedAt: new Date().toISOString(), results });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
