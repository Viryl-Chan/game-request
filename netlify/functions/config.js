// netlify/functions/config.js
// Serves the Supabase connection details to the frontend
// Credentials stay in Netlify's secure environment variables, never in the code

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_ANON_KEY
    })
  };
};
