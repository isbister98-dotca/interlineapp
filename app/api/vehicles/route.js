import { sql } from '../../../lib/db.js'

export async function GET() {
  try {
    const rows = await sql`
      SELECT vehicles, agency_status, updated_at
      FROM realtime.vehicle_cache
      WHERE id = 1
      LIMIT 1
    `
    if (!rows.length) {
      return Response.json({ vehicles: [], agency_status: {}, updated_at: null })
    }
    return Response.json(rows[0], {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      },
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
