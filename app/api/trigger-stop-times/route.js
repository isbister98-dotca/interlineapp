import { sql } from '../../../lib/db.js';

// Triggers the Supabase Edge Function to load stop_times for a given feed
export async function POST(request) {
  try {
    const { feedUrl, feedName, forceReload = false } = await request.json();
    if (!feedUrl || !feedName) return Response.json({ success: false, error: 'Missing feedUrl or feedName' }, { status: 400 });

    const supabaseUrl = process.env.APP_DB_URL;
    const supabaseKey = process.env.APP_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({
        success: false,
        error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel environment variables'
      }, { status: 500 });
    }

    // Call the Supabase Edge Function
    const edgeFnUrl = `${supabaseUrl}/functions/v1/load-stop-times`;
    const response = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ feedUrl, feedName, forceReload }),
      signal: AbortSignal.timeout(180000), // 3 min timeout waiting for Edge Fn
    });

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('trigger-stop-times error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
