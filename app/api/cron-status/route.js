import { sql } from '../../../lib/db.js'

export async function GET() {
  try {
    const jobs = await sql`SELECT * FROM cron_status`

    const lastRun = jobs
      .map(j => j.start_time)
      .filter(Boolean)
      .sort()
      .pop()

    const secondsSinceLastRun = lastRun
      ? Math.floor((Date.now() - new Date(lastRun).getTime()) / 1000)
      : null

    const healthy = secondsSinceLastRun !== null && secondsSinceLastRun < 90

    return Response.json({ healthy, secondsSinceLastRun, jobs })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
