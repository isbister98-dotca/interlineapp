import { sql } from '../../../lib/db.js'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const agency = searchParams.get('agency')
    const routeId = searchParams.get('routeId')
    const stopId = searchParams.get('stopId')

    let rows
    if (agency) {
      rows = await sql`SELECT * FROM alerts_cache WHERE id = ${agency}`
    } else {
      rows = await sql`SELECT * FROM alerts_cache ORDER BY id`
    }

    // Flatten alerts from all agencies
    let alerts = rows.flatMap(r => r.alerts ?? [])

    // Filter out expired alerts (no end time = still active)
    const now = Math.floor(Date.now() / 1000)
    alerts = alerts.filter(a => {
      if (!a.activePeriods?.length) return true
      return a.activePeriods.some(p => (!p.end || p.end > now) && (!p.start || p.start <= now))
    })

    // Apply filters
    if (routeId) alerts = alerts.filter(a =>
      a.informedEntities?.some(e => e.routeId === routeId)
    )
    if (stopId) alerts = alerts.filter(a =>
      a.informedEntities?.some(e => e.stopId === stopId)
    )

    const updatedAt = rows.map(r => r.updated_at).filter(Boolean).sort().pop() ?? null

    return Response.json({ alerts, updatedAt }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
