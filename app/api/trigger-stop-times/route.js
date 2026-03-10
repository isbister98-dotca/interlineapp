import { sql } from '../../../lib/db.js';

// Fires the Supabase Edge Function without waiting for it to complete.
// The frontend polls /api/stop-times-status for progress instead.
export async function POST(request) {
  try {
    const { feedUrl, feedName, forceReload = false } = await request.json();
    if (!feedUrl || !feedName) return Response.json({ success: false, error: 'Missing feedUrl or feedName' }, { status: 400 });

    const supabaseUrl = process.env.APP_DB_URL;
    const supabaseKey = process.env.APP_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ success: false, error: 'APP_DB_URL and APP_SERVICE_KEY must be set in Vercel environment variables' }, { status: 500 });
    }

    // Mark as loading immediately
    await sql`UPDATE feed_sources SET stop_times_status = 'loading' WHERE url = ${feedUrl}`;

    // Fire and forget — don't await the edge function
    const edgeFnUrl = `${supabaseUrl}/functions/v1/load-stop-times`;
    fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ feedUrl, feedName, forceReload }),
    }).catch(err => console.error('Edge function error:', err));

    // Return immediately — frontend will poll for progress
    return Response.json({ success: true, fired: true, message: 'Edge function triggered — polling for progress' });
  } catch (error) {
    console.error('trigger-stop-times error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
