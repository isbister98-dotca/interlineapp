import { sql } from '../../../lib/db.js';

// Polled by the frontend to check stop_times loading progress
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const feedUrl = searchParams.get('feedUrl');
    if (!feedUrl) return Response.json({ error: 'Missing feedUrl' }, { status: 400 });

    const [feedRow, countRow] = await Promise.all([
      sql`SELECT stop_times_status, stop_times_loaded_at, stop_times_row_count, feed_version FROM feed_sources WHERE url = ${feedUrl}`,
      sql`SELECT COUNT(*) as count FROM stop_times WHERE feed_source = (SELECT name FROM feed_sources WHERE url = ${feedUrl})`,
    ]);

    if (!feedRow || feedRow.length === 0) return Response.json({ error: 'Feed not found' }, { status: 404 });

    return Response.json({
      status: feedRow[0].stop_times_status,
      loadedAt: feedRow[0].stop_times_loaded_at,
      rowCount: feedRow[0].stop_times_row_count,
      currentRows: parseInt(countRow[0].count),
      feedVersion: feedRow[0].feed_version,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
