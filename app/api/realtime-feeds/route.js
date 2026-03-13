import { sql } from '../../../lib/db.js'

export async function GET() {
  try {
    const feeds = await sql`
      SELECT id, agency, feed_type, url, enabled, fetch_method,
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

export async function POST(request) {
  try {
    const { agency, feed_type, url, fetch_method, vault_secret_name, refresh_seconds } = await request.json()
    if (!agency || !feed_type || !url || !fetch_method) {
      return Response.json({ error: 'agency, feed_type, url, and fetch_method are required' }, { status: 400 })
    }
    const [feed] = await sql`
      INSERT INTO feeds (agency, feed_type, url, fetch_method, vault_secret_name, refresh_seconds, enabled)
      VALUES (${agency}, ${feed_type}, ${url}, ${fetch_method}, ${vault_secret_name || null}, ${refresh_seconds || 30}, true)
      RETURNING *
    `
    return Response.json({ feed }, { status: 201 })
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
    await sql`UPDATE feeds SET enabled = ${enabled} WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { id } = await request.json()
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 })
    await sql`DELETE FROM feeds WHERE id = ${id}`
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
