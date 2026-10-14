/* ═══════════════════════════════════════════════════════════════════
   config.js — ALL SETTINGS LIVE HERE (no Cloudflare, no server)
   ⚠ Everything in this file is visible to anyone who opens the site.
   ═══════════════════════════════════════════════════════════════════ */
window.APP_CONFIG = {

  /* ── Google Sheet ─────────────────────────────────────────────── */
  SHEET_ID:   '1GtvrpKr-ONenL2Wx8XAl61NTH-eKkQDAlqSkk_x3tbk',
  SHEET_NAME: 'Till Sep2026',
  ALLOWED_LOCATIONS: ['CRIUS', 'CHIROS', 'CRIUS FND'],

  /* ── Google service account (from the downloaded JSON key file) ──
     Share the sheet with CLIENT_EMAIL as Viewer.
     Paste private_key exactly as in the JSON (the \n sequences are fine). */
  SERVICE_ACCOUNT: {
    CLIENT_EMAIL: 'PASTE-client_email-HERE@YOUR-PROJECT.iam.gserviceaccount.com',
    PRIVATE_KEY:  '-----BEGIN PRIVATE KEY-----\nPASTE-REST-OF-KEY-HERE\n-----END PRIVATE KEY-----\n'
  },

  /* ── Groq AI ──────────────────────────────────────────────────── */
  GROQ_API_KEY:   'PASTE-YOUR-GROQ-KEY-HERE',
  PRIMARY_MODEL:  'openai/gpt-oss-120b',
  FALLBACK_MODEL: 'openai/gpt-oss-20b',

  /* Cache parsed sheet data in the browser for this many seconds
     (makes repeat loads instant; the ↻ button always bypasses it) */
  CACHE_SECONDS: 300
};
