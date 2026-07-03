// netlify/functions/igdb.js
// This runs on the server so your IGDB credentials are never exposed to visitors

exports.handler = async (event) => {
  const query = event.queryStringParameters?.q;

  if (!query || query.trim().length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Query too short' }) };
  }

  try {
    // Step 1: Get a Twitch access token using your credentials
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
      { method: 'POST' }
    );
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to get access token' }) };
    }

    // Step 2: Search IGDB for games matching the query
    const igdbRes = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain'
      },
      // Only return games that have cover art, to keep results clean
      body: `search "${query}"; fields id,name,cover.image_id,genres.name,summary; limit 12; where cover != null;`
    });

    const games = await igdbRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(games)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
