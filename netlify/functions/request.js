// netlify/functions/request.js
// Handles game requests server-side so we can get the visitor's real IP address
// This is what enforces one request per person per game

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Get the visitor's real IP address from Netlify's headers
  const ip =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    'unknown';

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { igdb_id, title, cover_url, genres, summary } = body;

  if (!igdb_id || !title) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };

  try {
    // Step 1: Insert the game if it doesn't exist yet (ignore if it already does)
    await fetch(`${supabaseUrl}/rest/v1/games?on_conflict=igdb_id`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=ignore-duplicates' },
      body: JSON.stringify({ igdb_id, title, cover_url, genres, summary, request_count: 1 })
    });

    // Step 2: Get the game's current data (we need its id and request_count)
    const gameRes = await fetch(
      `${supabaseUrl}/rest/v1/games?igdb_id=eq.${igdb_id}&select=id,request_count`,
      { headers }
    );
    const games = await gameRes.json();
    const game = games[0];

    if (!game) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Game not found after insert' }) };
    }

    // Step 3: Try to record this person's request (will fail if they already requested this game)
    const reqRes = await fetch(`${supabaseUrl}/rest/v1/requests`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ game_id: game.id, ip_address: ip })
    });

    // If we get a 409 conflict, this IP already requested this game
    if (reqRes.status === 409) {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'already_requested', request_count: game.request_count })
      };
    }

    // Step 4: Increment the request count on the game
    await fetch(`${supabaseUrl}/rest/v1/games?igdb_id=eq.${igdb_id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ request_count: game.request_count + 1 })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', request_count: game.request_count + 1 })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
