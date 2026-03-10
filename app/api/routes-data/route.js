import { sql } from '../../../lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const feed = searchParams.get('feed') || '';

    let result;
    if (feed) {
      result = await sql`
        SELECT route_id, route_short_name, route_long_name, route_type, route_color, feed_source
        FROM routes
        WHERE feed_source = ${feed}
        ORDER BY route_short_name
        LIMIT 200
      `;
    } else {
      result = await sql`
        SELECT route_id, route_short_name, route_long_name, route_type, route_color, feed_source
        FROM routes
        ORDER BY feed_source, route_short_name
        LIMIT 200
      `;
    }
    return Response.json({ routes: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
