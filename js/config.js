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
    CLIENT_EMAIL: 'crius-sheet-reader@testprojectsample-493211.iam.gserviceaccount.com',
    PRIVATE_KEY:  "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCxeP/AeaSX5x7Y\nYaxc2VO9kIoSoWPslJ88bQ5yHGvq3lKhzo74vBctSYo/MYACa4S+Thw7WIwhAQGS\nWTxTM915CskznOseUHz/JDLZYJtD8I38sKiEi3t9I5fbnQKHGwOZ/9rsCC/L2tXa\nw/zCAL3K6S53p48qfikNqY8p5e9Lpl1xuVu+sGnyJh1H3TH+KPiCkDoy+9nC2Uy3\nvbUxnhmzizVe7dG2RX+OQI8e/Xf1UViyRW7BsegYCtnUL0qhUTfqubvCjQAdrDwk\nOveW9APjK/3s38QVVffeevNXWRT+OH05WFGYbpz1U6JFohtIJOx+8fqQq1yPNwzO\n4+ibBpybAgMBAAECggEACtrcRcEK9LGRvOloefte+FrFXzNY4ckLXk5LUmZzoVd8\n1WHFc+hJQJ9dYdUcv8kkwuETL/wQAhrGJlXn7yzecH9c5BfGd8Gzi4WCyLH0fTjS\n7nA9tnGzmWlaaffWBj58P2ibUtGDXuQhLXLMXG9gLG+LxIzOoGo8B5Zl58mlE8rc\njGFWan3p5uEe2paX0p6iZOZmrErz77KKTtQ3+xWdGBnPV2KS3LEAejQ/7OhucGuG\nGxwobIojNvkpBDrtUKwYTdCb1Fn3zodVToMF63hPULKDyxVbCssU+AHLgpIQqG9U\n7Ych5BdLX2HCRIyv/tlgsyuEu2zSjHKrjY/R/AEqJQKBgQDkV/gbX7/yGWhi4D2A\n4FFVMssLJwN77w0BLoB7qXIkexF7vjbkFliULz2AXaIMSUnAvAx9DZVviyPIkKN9\nwhoOgZwA1C3T+2TGQQz6Ke5gTNsb89sQcYDPsR3tGwvwZHc20uXhxrSeMNErea6X\nZGYo/lxqqcwEjw1uQz8j2bvDhwKBgQDG97j2TJbXZp08/nFVArwUYZHM3/3YHitj\nflk9yp3RBx1RMn1/mf6ptJuGfaNfnHL60K9xMizmU3b0TvMQ4Y1hTDDxsoMN1Jx5\ncRjSw9SzZKPwVf7JR8vZE1qQgqSfWQd4eo934kFr9tu0cB4DlXzSF5v8mjtXiUwS\n9Ix/SCoLTQKBgAzLQQOHoeGWutqPZeLKrsPvTKEbVn6jLj9as6g6HkMdAiXEyp6N\nAfmLjA6dMG8vzAoYfzqigDT3vtGGCSMKtRsK+Aqz2L1/4G2bR3bc0pZiuAQg7a1G\nLsl0SxD16v1VI7jWqDq2P3h9k7qz3qxs26yAU/1F9kBrI32CFw+TK4oRAoGABai2\nEgtLnwTEJB/4iTpyrwG3a+RTC/qPsVy+nQtOQcu6Ab015JM0sw73/XNFWkrQ2mFl\nHAsZS9PD5l74etpvcvz/x2AUaihJ6wpUcmoveoq6PvOzM3ZfTeVHBiUxGXcmxz51\nJivBQJjc1tz5fZCa5D7XqO+aEHtPNprOBDDBQWECgYEAoySrfRIaNYTfcEYikk30\ns0SMdCnR63oSINIjc72W78/GnUUwTrJTwX5qJId0oHv/Znz8iA/6dR9TLh9d3ud+\njQcRNpnX3MNj5tuIHapjM8XhtpO0vzdmVBtRmR14rpL10WSRQXIjLmsgK5tKE7Pu\n57RA/iF3T/t06tzNA8cMIao=\n-----END PRIVATE KEY-----\n"
  },

  /* ── Groq AI ──────────────────────────────────────────────────── */
  GROQ_API_KEY:   'PASTE-YOUR-GROQ-KEY-HERE',
  PRIMARY_MODEL:  'openai/gpt-oss-120b',
  FALLBACK_MODEL: 'openai/gpt-oss-20b',

  /* Cache parsed sheet data in the browser for this many seconds
     (makes repeat loads instant; the ↻ button always bypasses it) */
  CACHE_SECONDS: 300
};
