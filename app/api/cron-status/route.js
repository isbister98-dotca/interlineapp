import { sql } from '../../../lib/db.js

export async function GET() {
  try {
    const [jobs, cacheRow] = await Promise.all([
      sql`SELECT * FROM cron_status`,
      sql`SELECT updated_at FROM vehicle_cache WHERE id = 1`,
    ])

    // Try cron history first
    let lastRun = jobs
      .map(j => j.start_time)
      .filter(Boolean)
      .sort()
      .pop()

    // Fall back to vehicle_cache.updated_at if cron history was trimmed
    const cacheUpdatedAt = cacheRow[0]?.updated_at ?? null
    const usedFallback = !lastRun && cacheUpdatedAt

    if (!lastRun && cacheUpdatedAt) {
      lastRun = cacheUpdatedAt
    }

    const secondsSinceLastRun = lastRun
      ? Math.floor((Date.now() - new Date(lastRun).getTime()) / 1000)
      : null

    // Healthy if polled within 90s — works for both cron history and cache fallback
    const healthy = secondsSinceLastRun !== null && secondsSinceLastRun < 90

    return Response.json({
      healthy,
      secondsSinceLastRun,
      jobs,
      source: usedFallback ? 'vehicle_cache' : 'cron_history',
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
