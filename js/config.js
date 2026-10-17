/* ═══════════════════════════════════════════════════════════════════
   config.js — ALL SETTINGS LIVE HERE (no Cloudflare, no server)
   ⚠ Everything in this file is visible to anyone who opens the site.
   ═══════════════════════════════════════════════════════════════════ */
window.APP_CONFIG = {

  /* ── Public frontend settings ────────────────────────────────────
     All Google credentials and spreadsheet access belong in the
     server-side API, never in this public GitHub Pages repository. */
  API_BASE_URL: '',
  ALLOWED_LOCATIONS: ['CRIUS', 'CHIROS', 'CRIUS FND'],

  /* ── Groq AI ──────────────────────────────────────────────────── ──────────────────────────────────────────────────── */
  GROQ_API_KEY:   '',
  PRIMARY_MODEL:  'openai/gpt-oss-120b',
  FALLBACK_MODEL: 'openai/gpt-oss-20b',

  /* Cache parsed sheet data in the browser for this many seconds. */
  CACHE_SECONDS: 300
};
