import { sql } from '../../../lib/db.js';

export async function GET() {
  try {
    const [stops, routes, trips, feeds] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM stops`,
      sql`SELECT COUNT(*) as count FROM routes`,
      sql`SELECT COUNT(*) as count FROM trips`,
      sql`SELECT name, status, loaded_at, row_count FROM feed_sources ORDER BY name`,
    ]);

    return Response.json({
      stops: parseInt(stops[0].count),
      routes: parseInt(routes[0].count),
      trips: parseInt(trips[0].count),
      feeds: feeds,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
