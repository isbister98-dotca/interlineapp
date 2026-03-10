import { sql } from '../../../lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    if (!q.trim()) return Response.json({ stops: [] });

    const result = await sql`
      SELECT stop_name, feed_source, stop_lat, stop_lon, stop_code
      FROM stops
      WHERE stop_name ILIKE ${'%' + q + '%'}
      ORDER BY stop_name
      LIMIT 50
    `;
    return Response.json({ stops: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
