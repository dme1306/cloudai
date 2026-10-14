/* ═══════════════════════════════════════════════════════════════════
   data.js — replaces Code1.gs
   Signs in with the Google service account (in the browser, via WebCrypto),
   reads the sheet through the Google Sheets API and parses it.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  const CFG = window.APP_CONFIG;
  const MONTH_MAP  = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DATA_CACHE_KEY  = 'crius_sheet_cache_v1';
  const TOKEN_CACHE_KEY = 'crius_gtoken_v1';

  /* ── parsing helpers (same logic as Code1.gs) ─────────────────── */
  const cell = (row, i) => (i >= 0 && row[i] !== undefined && row[i] !== null) ? row[i] : '';
  function pick(headers, cands) { for (const c of cands) if (headers.indexOf(c) !== -1) return c; return null; }
  function parseFY(v) { const m = String(v || '').match(/20\d{2}/); return m ? parseInt(m[0], 10) : 0; }
  function parseMonthNum(v) {
    if (v === '' || v == null) return 0;
    const s = String(v).trim().toLowerCase();
    const m3 = s.substring(0, 3);
    if (MONTH_MAP.hasOwnProperty(m3)) return MONTH_MAP[m3];
    let m = s.match(/^(\d{1,2})/);
    if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 12) return n; }
    m = s.match(/\d{4}[-/](\d{1,2})/);
    if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 12) return n; }
    m = s.match(/^(\d{1,2})[/-]/);
    if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= 12) return n; }
    return 0;
  }
  function toAmount(v) {
    if (v === '' || v == null) return 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).replace(/[₹,\s]/g, '').replace(/[()]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  // "Apr-24" → "Apr 2024"; anything else → rebuild from Month + FY so sorting works
  function normMonthYear(s, mn, fy) {
    s = String(s || '').trim();
    let m = s.match(/^([A-Za-z]{3,})[\s\-\/,]+(\d{4})$/);
    if (m) return m[1].slice(0, 3) + ' ' + m[2];
    m = s.match(/^([A-Za-z]{3,})[\s\-\/,]+(\d{2})$/);
    if (m) return m[1].slice(0, 3) + ' 20' + m[2];
    return MONTH_ABBR[mn - 1] + ' ' + fy;
  }

  function parseSheet(all) {
    if (!all || all.length < 2) return { rows: [], headers: [], columnMap: {} };
    const headers = all[0].map(h => String(h).trim());

    const COL_LOC   = pick(headers, ['Location','LOCATION','Company']);
    const COL_PART  = pick(headers, ['Particulars','PARTICULARS']);
    const COL_AC    = pick(headers, ['Expenses A/C Name','Expenses AC Name','AC Name','A/C Name']);
    const COL_DESCR = pick(headers, ['DESCR','Descr','Description']);
    const COL_MONTH = pick(headers, ['Month','MONTH']);
    const COL_TXN   = pick(headers, ['TXNREMARK','TxnRemark','Transaction Remark']);
    const COL_AMT   = pick(headers, ['Expensebal','Expense Amount','Amount','Expense']);
    const COL_FY    = pick(headers, ['Fin. Year','Financial Year','FY','Fin Year']);
    const COL_MY    = pick(headers, ['Month-Year','MonthYear','Month Year']);
    const idx = c => c ? headers.indexOf(c) : -1;
    const iLoc = idx(COL_LOC), iPart = idx(COL_PART), iAc = idx(COL_AC), iDescr = idx(COL_DESCR),
          iMonth = idx(COL_MONTH), iTxn = idx(COL_TXN), iAmt = idx(COL_AMT), iFy = idx(COL_FY), iMy = idx(COL_MY);

    const rows = [];
    const stats = { total: 0, locOK: 0, fyOK: 0, monthOK: 0, kept: 0 };

    for (let r = 1; r < all.length; r++) {
      const row = all[r];
      stats.total++;
      const loc = String(cell(row, iLoc)).trim().toUpperCase();
      if (CFG.ALLOWED_LOCATIONS.indexOf(loc) === -1) continue;
      stats.locOK++;
      const fy = parseFY(cell(row, iFy));
      if (fy <= 0) continue;
      stats.fyOK++;
      const mn = parseMonthNum(cell(row, iMonth));
      if (mn < 1 || mn > 12) continue;
      stats.monthOK++;

      rows.push({
        location: loc,
        particulars: String(cell(row, iPart)).trim(),
        account:     iAc >= 0 ? String(cell(row, iAc)).trim() : 'Uncategorized',
        descr:       String(cell(row, iDescr)).trim(),
        txn_remark:  String(cell(row, iTxn)).trim(),
        amount:      toAmount(cell(row, iAmt)),
        fy: fy, month_num: mn,
        month_year:  normMonthYear(cell(row, iMy), mn, fy)
      });
      stats.kept++;
    }
    console.log('Parsed', stats);
    return { rows, headers, debug: stats,
      columnMap: { location: COL_LOC, particulars: COL_PART, account: COL_AC, descr: COL_DESCR,
                   month: COL_MONTH, amount: COL_AMT, fy: COL_FY, monthYear: COL_MY } };
  }

  /* ── Google service-account sign-in (JWT signed in the browser) ── */
  const enc = new TextEncoder();
  function b64url(bytes) {
    bytes = new Uint8Array(bytes);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    try {
      const c = JSON.parse(sessionStorage.getItem(TOKEN_CACHE_KEY) || 'null');
      if (c && c.exp > now + 60) return c.token;
    } catch (e) {}

    if (!window.crypto || !window.crypto.subtle)
      throw new Error('WebCrypto unavailable — the site must be opened over https:// (GitHub Pages is fine).');

    const sa = CFG.SERVICE_ACCOUNT;
    const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const claim  = b64url(enc.encode(JSON.stringify({
      iss: sa.CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600
    })));

    const pem = String(sa.PRIVATE_KEY)
      .replace(/\\n/g, '\n')
      .replace(/-----[A-Z ]+-----/g, '')
      .replace(/\s+/g, '');
    let der;
    try { der = Uint8Array.from(atob(pem), c => c.charCodeAt(0)); }
    catch (e) { throw new Error('PRIVATE_KEY in js/config.js is not valid — paste the full private_key from the JSON file.'); }

    const key = await crypto.subtle.importKey(
      'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(header + '.' + claim));
    const jwt = header + '.' + claim + '.' + b64url(sig);

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token)
      throw new Error('Google sign-in failed: ' + (j.error_description || j.error || ('HTTP ' + r.status)));

    const exp = now + (j.expires_in || 3600);
    try { sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({ token: j.access_token, exp: exp })); } catch (e) {}
    return j.access_token;
  }

  async function fetchSheetValues() {
    const token = await getAccessToken();
    const range = encodeURIComponent("'" + CFG.SHEET_NAME + "'");
    const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + CFG.SHEET_ID +
                '/values/' + range + '?valueRenderOption=FORMATTED_VALUE';
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && j.error.message) || ('HTTP ' + r.status);
      if (r.status === 403 || r.status === 404)
        throw new Error('Sheets API ' + r.status + ': ' + msg + ' — is the sheet shared with the service-account email as Viewer, and is the Sheets API enabled?');
      throw new Error('Sheets API ' + r.status + ': ' + msg);
    }
    return j.values || [];
  }

  /* ── public function used by app.js ───────────────────────────── */
  async function getDashboardData(force) {
    if (!force) {
      try {
        const c = JSON.parse(sessionStorage.getItem(DATA_CACHE_KEY) || 'null');
        if (c && (Date.now() - c.t) < CFG.CACHE_SECONDS * 1000) return c.data;
      } catch (e) {}
    }
    const data = parseSheet(await fetchSheetValues());
    try { sessionStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
    return data;
  }

  window.getDashboardData = getDashboardData;
})();
