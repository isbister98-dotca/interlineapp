import { sql } from '../../../lib/db.js';

export async function GET() {
  try {
    const [stops, routes, trips, stop_times, feeds] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM stops`,
      sql`SELECT COUNT(*) as count FROM routes`,
      sql`SELECT COUNT(*) as count FROM trips`,
      sql`SELECT COUNT(*) as count FROM stop_times`,
      sql`SELECT name, url, status, loaded_at, row_count, feed_version, last_version_check, stop_times_status, stop_times_loaded_at, stop_times_row_count FROM feed_sources ORDER BY loaded_at DESC NULLS LAST`,
    ]);
    return Response.json({
      stops: parseInt(stops[0].count),
      routes: parseInt(routes[0].count),
      trips: parseInt(trips[0].count),
      stop_times: parseInt(stop_times[0].count),
      feeds: feeds,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
