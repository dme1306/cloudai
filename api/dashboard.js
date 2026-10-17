const { createSign } = require('node:crypto');

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) return cachedToken;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    const error = new Error('Google Sheets backend is not configured. Add the service-account email and private key as Vercel environment variables.');
    error.statusCode = 503;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + '.' + claim;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const jwt = unsigned + '.' + signer.sign(privateKey, 'base64url');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const tokenPayload = await response.json().catch(() => ({}));
  if (!response.ok || !tokenPayload.access_token) {
    const error = new Error('Google authentication failed. Verify the service account, private key, and Sheets API configuration.');
    error.statusCode = 502;
    throw error;
  }
  cachedToken = tokenPayload.access_token;
  cachedTokenExpiresAt = Date.now() + Number(tokenPayload.expires_in || 3600) * 1000;
  return cachedToken;
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://dme1306.github.io';
  const requestOrigin = req.headers.origin || '';
  if (requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME;
    if (!sheetId || !sheetName) {
      return res.status(503).json({ error: 'Google Sheets backend is not configured. Add GOOGLE_SHEET_ID and GOOGLE_SHEET_NAME in Vercel.' });
    }
    const token = await getAccessToken();
    const range = "'" + sheetName.replace(/'/g, "''") + "'";
    const url = 'https://sheets.googleapis.com/v4/spreadsheets/' +
      encodeURIComponent(sheetId) + '/values/' + encodeURIComponent(range) +
      '?valueRenderOption=FORMATTED_VALUE';
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error('Google Sheets could not return the requested data. Verify the spreadsheet ID, tab name, sharing permissions, and Sheets API.');
      error.statusCode = 502;
      throw error;
    }
    return res.status(200).json({ values: payload.values || [] });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    return res.status(status).json({
      error: status === 503 ? error.message : 'Unable to load expense data securely. Check the server-side Google Sheets settings.'
    });
  }
};
