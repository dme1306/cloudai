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

  /* ── Secure backend fetch: no Google credentials in the browser ── */
  async function fetchSheetValues() {
    const base = String(CFG.API_BASE_URL || '').trim().replace(/\/+$/, '');
    if (!base || /YOUR-VERCEL|REPLACE-WITH/i.test(base)) {
      throw new Error('Secure data backend is not configured yet. Deploy the /api/dashboard endpoint to Vercel, add the required server-side environment variables, then set API_BASE_URL in js/config.js to your Vercel deployment URL.');
    }
    let response;
    try {
      response = await fetch(base + '/api/dashboard', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
    } catch (error) {
      throw new Error('Could not reach the secure expense data backend. Check the Vercel deployment and allowed origin.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || ('Secure data backend returned HTTP ' + response.status));
    }
    if (!Array.isArray(payload.values)) {
      throw new Error('Secure data backend response is missing the spreadsheet values.');
    }
    return payload.values;
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
