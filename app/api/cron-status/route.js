import { sql } from '../../../lib/db.js'

export async function GET() {
  try {
    const jobs = await sql`
      SELECT j.jobid, j.jobname, j.schedule, j.active,
             r.status, r.start_time, r.end_time
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT status, start_time, end_time
        FROM cron.job_run_details
        WHERE jobid = j.jobid
        ORDER BY start_time DESC
        LIMIT 1
      ) r ON true
      WHERE j.jobname LIKE 'poll-transit%'
      ORDER BY j.jobname
    `

    const allActive = jobs.every(j => j.active)
    const lastRun = jobs
      .map(j => j.start_time)
      .filter(Boolean)
      .sort()
      .pop()

    const secondsSinceLastRun = lastRun
      ? Math.floor((Date.now() - new Date(lastRun).getTime()) / 1000)
      : null

    // Healthy = at least one job ran in the last 90 seconds
    const healthy = secondsSinceLastRun !== null && secondsSinceLastRun < 90

    return Response.json({ healthy, allActive, secondsSinceLastRun, jobs })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
