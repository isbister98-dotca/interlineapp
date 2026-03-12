import { sql } from '../../../lib/db.js'

export async function GET() {
  try {
    await sql`SET search_path TO public, realtime`
    const feeds = await sql`
      SELECT
        id, agency, feed_type, url, enabled, fetch_method,
        vault_secret_name, refresh_seconds,
        last_polled_at, last_count, last_error
      FROM feeds
      ORDER BY agency, feed_type
    `
    return Response.json({ feeds })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const { id, enabled } = await request.json()
    if (!id || typeof enabled !== 'boolean') {
      return Response.json({ error: 'id and enabled are required' }, { status: 400 })
    }
    await sql`SET search_path TO public, realtime`
    await sql`
      UPDATE feeds
      SET enabled = ${enabled}, updated_at = NOW()
      WHERE id = ${id}
    `
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
