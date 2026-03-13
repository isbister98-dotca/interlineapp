import { sql } from '../../../lib/db.js'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agency = searchParams.get('agency')
    const routeId = searchParams.get('routeId')
    const tripId = searchParams.get('tripId')
    const stopId = searchParams.get('stopId')

    let rows
    if (agency) {
      rows = await sql`SELECT * FROM trip_updates_cache WHERE id = ${agency}`
    } else {
      rows = await sql`SELECT * FROM trip_updates_cache ORDER BY id`
    }

    // Flatten updates from all agencies
    let updates = rows.flatMap(r => r.updates ?? [])

    // Apply filters
    if (routeId) updates = updates.filter(u => u.routeId === routeId)
    if (tripId)  updates = updates.filter(u => u.tripId === tripId)
    if (stopId)  updates = updates.filter(u =>
      u.stopTimeUpdates?.some(s => s.stopId === stopId)
    )

    const updatedAt = rows.map(r => r.updated_at).filter(Boolean).sort().pop() ?? null

    return Response.json({ updates, updatedAt }, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' }
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
