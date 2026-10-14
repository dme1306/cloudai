/* ═══════════════════════════════════════════════════════════════════
   ai.js — replaces Code.gs
   • Fast local answer engine runs in the browser (instant, no API call)
   • Anything else goes to the Cloudflare Worker (/ai), which holds the Groq key
   ═══════════════════════════════════════════════════════════════════ */

const _aiCache = new Map();

/* Same signature as the Apps Script version, but returns a Promise */
async function askGemini(question, records, skipFast) {
  if (!question || !question.trim()) return 'Please ask a question.';
  if (!records || !records.length) return 'No expense data available. Please refresh.';

  if (!skipFast) {
    const fast = tryFastAnswer_(question, records);
    if (fast) return fast;
  }

  const key = question + '|' + records.length;
  const hit = _aiCache.get(key);
  if (hit && Date.now() - hit.t < 5 * 60 * 1000) return hit.a;

  let res, data;
  try {
    res = await fetch(window.APP_CONFIG.AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        snapshot: buildRichSnapshot_(records),
        minimal: buildMinimalSnapshot_(records)
      })
    });
    data = await res.json().catch(function () { return {}; });
  } catch (e) {
    return 'The AI service is unreachable. Please check your connection and try again.\n\n_Technical: ' +
           String(e.message || e).substring(0, 200) + '_';
  }

  if (!res.ok || !data.answer) {
    const err = (data && data.error) || ('HTTP ' + res.status);
    if (/429|rate|quota|tokens per minute|TPM/i.test(err)) {
      return '⚠️ **Free-tier limit reached.** Please wait about 30 seconds and try again.\n\n' +
             '**Meanwhile, these are answered instantly without AI:**\n' +
             '— Total spend this year\n— Highest month for Chiros\n— Top 5 categories\n' +
             '— Top 5 vendors\n— Compare Crius vs Chiros\n— Average transaction';
    }
    return 'The AI service is busy. Please try again in a moment.\n\n_Technical: ' +
           String(err).substring(0, 200) + '_';
  }

  _aiCache.set(key, { a: data.answer, t: Date.now() });
  return data.answer;
}

/* ═══════════════════════════════════════════════════════════════════
   FAST LOCAL ANSWER ENGINE (unchanged from Code.gs)
   ═══════════════════════════════════════════════════════════════════ */
function tryFastAnswer_(question, records) {
  var q = String(question || '').toLowerCase().trim();
  if (!q) return null;

  var MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  var company = null;
  if (/\bcrius\s*fnd\b|\bcriusfnd\b|\bfnd\b/.test(q)) company = 'CRIUS FND';
  else if (/\bchiros\b/.test(q)) company = 'CHIROS';
  else if (/\bcrius\b/.test(q)) company = 'CRIUS';

  var year = null;
  var ym = q.match(/\b(20\d{2})\b/);
  if (ym) year = parseInt(ym[1], 10);
  else if (/\bthis\s+year\b|\bcurrent\s+year\b/.test(q)) {
    year = Math.max.apply(null, records.map(function(r){ return Number(r.fy) || 0; }));
  } else if (/\blast\s+year\b|\bprevious\s+year\b/.test(q)) {
    year = Math.max.apply(null, records.map(function(r){ return Number(r.fy) || 0; })) - 1;
  }

  var monthNum = null;
  for (var i = 0; i < MONTHS.length; i++) {
    if (new RegExp('\\b' + MONTHS[i] + '\\b').test(q)) { monthNum = i + 1; break; }
  }

  var topN = 5;
  var tnm = q.match(/\btop\s+(\d+)/);
  if (tnm) topN = Math.min(50, parseInt(tnm[1], 10));

  var filtered = records.slice();
  if (company) filtered = filtered.filter(function(r){ return String(r.location || r.company || '').toUpperCase() === company; });
  if (year)    filtered = filtered.filter(function(r){ return Number(r.fy) === year; });
  if (monthNum) {
    filtered = filtered.filter(function(r) {
      var m = Number(r.month) || 0;
      if (m) return m === monthNum;
      var my = String(r.month_year || '').toLowerCase();
      return my.indexOf(MONTHS[monthNum - 1]) === 0;
    });
  }

  if (!filtered.length) return null;

  var total = filtered.reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
  var scope = buildScopeLabel_(company, year, monthNum, MONTH_FULL);

  if (/\btotal\b|\bhow\s+much\b|\bsum\b|\bspen[dt]\b|\bexpense[sd]?\b/.test(q)
      && !/\btop\b|\bhighest\b|\blowest\b|\bmax\b|\bmin\b|\bcompare\b|\btrend\b|\baverage\b|\bavg\b/.test(q)) {
    return '<div><b>Total expense' + scope + '</b></div>' +
           '<div style="font-family:var(--font-display);font-size:24px;font-weight:700;color:var(--accent);margin:8px 0;">' + inr_(total) + '</div>' +
           '<div style="color:var(--text-muted);font-size:12px;">' + fmtNum_(filtered.length) + ' transactions · avg ' + inr2_(total / filtered.length) + '</div>';
  }

  if (/\b(highest|top|max|biggest|peak|most)\s+month/.test(q) ||
      /\bmonth\s+with\s+(highest|most|max)/.test(q)) {
    var mMap = {};
    filtered.forEach(function(r){
      var m = Number(r.month) || 0;
      if (m >= 1 && m <= 12) mMap[m] = (mMap[m] || 0) + (Number(r.amount) || 0);
    });
    var mEntries = Object.keys(mMap).map(function(k){ return { m: parseInt(k,10), amt: mMap[k] }; })
                          .sort(function(a,b){ return b.amt - a.amt; });
    if (mEntries.length) {
      var top = mEntries[0];
      var monthLabel = MONTH_FULL[top.m - 1] + (year ? ' ' + year : '');
      var lines = mEntries.slice(0, 5).map(function(e, i){
        var share = total ? (e.amt / total * 100).toFixed(1) + '%' : '—';
        return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">' +
               '<span>' + (i+1) + '. ' + MONTH_FULL[e.m - 1] + '</span>' +
               '<span style="font-family:var(--font-mono);font-weight:700;">' + inr_(e.amt) + ' · ' + share + '</span></div>';
      }).join('');
      return '<div><b>Highest month' + scope + '</b></div>' +
             '<div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--accent);margin:8px 0;">' + monthLabel + '</div>' +
             '<div style="font-family:var(--font-mono);font-weight:700;margin-bottom:10px;">' + inr_(top.amt) + '</div>' +
             '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:12px;">' + lines + '</div>';
    }
  }

  if (/\b(lowest|least|min|smallest)\s+month/.test(q)) {
    var mMap2 = {};
    filtered.forEach(function(r){
      var m = Number(r.month) || 0;
      if (m >= 1 && m <= 12) mMap2[m] = (mMap2[m] || 0) + (Number(r.amount) || 0);
    });
    var mEnt2 = Object.keys(mMap2).map(function(k){ return { m: parseInt(k,10), amt: mMap2[k] }; })
                           .sort(function(a,b){ return a.amt - b.amt; });
    if (mEnt2.length) {
      var lo = mEnt2[0];
      return '<div><b>Lowest month' + scope + '</b></div>' +
             '<div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--accent);margin:8px 0;">' + MONTH_FULL[lo.m - 1] + (year ? ' ' + year : '') + '</div>' +
             '<div style="font-family:var(--font-mono);font-weight:700;">' + inr_(lo.amt) + '</div>';
    }
  }

  if ((/\b(top|highest|biggest)\b.*\b(categor|account|a\/c)/.test(q)) || (/\bcategor(y|ies)\b/.test(q) && /\btop\b/.test(q))) {
    var cMap = {};
    filtered.forEach(function(r){ var k = r.account || 'Uncategorized'; cMap[k] = (cMap[k] || 0) + (Number(r.amount) || 0); });
    var cSorted = Object.keys(cMap).map(function(k){ return { name: k, amt: cMap[k] }; }).sort(function(a,b){ return b.amt - a.amt; }).slice(0, topN);
    var lines2 = cSorted.map(function(e, i){
      var share = total ? (e.amt / total * 100).toFixed(1) + '%' : '—';
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">' +
             '<span style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml_(e.name) + '">' + (i+1) + '. ' + escHtml_(e.name) + '</span>' +
             '<span style="font-family:var(--font-mono);font-weight:700;">' + inr_(e.amt) + ' · ' + share + '</span></div>';
    }).join('');
    return '<div><b>Top ' + cSorted.length + ' categories' + scope + '</b></div><div style="margin-top:8px;">' + lines2 + '</div>';
  }

  if ((/\b(top|highest|biggest)\b.*\b(vendor|supplier|particular|party)/.test(q)) || (/\bparticular[s]?\b/.test(q) && /\btop\b/.test(q))) {
    var pMap = {};
    filtered.forEach(function(r){ var k = r.particulars || 'Uncategorized'; pMap[k] = (pMap[k] || 0) + (Number(r.amount) || 0); });
    var pSorted = Object.keys(pMap).map(function(k){ return { name: k, amt: pMap[k] }; }).sort(function(a,b){ return b.amt - a.amt; }).slice(0, topN);
    var lines3 = pSorted.map(function(e, i){
      var share = total ? (e.amt / total * 100).toFixed(1) + '%' : '—';
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">' +
             '<span style="max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml_(e.name) + '">' + (i+1) + '. ' + escHtml_(e.name) + '</span>' +
             '<span style="font-family:var(--font-mono);font-weight:700;">' + inr_(e.amt) + ' · ' + share + '</span></div>';
    }).join('');
    return '<div><b>Top ' + pSorted.length + ' vendors / particulars' + scope + '</b></div><div style="margin-top:8px;">' + lines3 + '</div>';
  }

  if (/\baverage\b|\bavg\b|\bmean\b/.test(q)) {
    return '<div><b>Average transaction' + scope + '</b></div>' +
           '<div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--accent);margin:8px 0;">' + inr2_(total / filtered.length) + '</div>' +
           '<div style="color:var(--text-muted);font-size:12px;">' + inr_(total) + ' ÷ ' + fmtNum_(filtered.length) + ' transactions</div>';
  }

  if (/\bhow\s+many\b|\bcount\b|\bnumber\s+of\b/.test(q)) {
    return '<div><b>Transaction count' + scope + '</b></div>' +
           '<div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--accent);margin:8px 0;">' + fmtNum_(filtered.length) + '</div>' +
           '<div style="color:var(--text-muted);font-size:12px;">Total spend: ' + inr_(total) + '</div>';
  }

  if (/\bcompare\b|\bvs\.?\b|\bversus\b/.test(q)) {
    var comps = [];
    if (/\bcrius\s*fnd\b|\bcriusfnd\b|\bfnd\b/.test(q)) comps.push('CRIUS FND');
    if (/\bchiros\b/.test(q)) comps.push('CHIROS');
    if (/\bcrius\b/.test(q) && comps.indexOf('CRIUS') === -1 && !/\bcrius\s*fnd\b/.test(q)) comps.push('CRIUS');
    if (comps.length === 2) {
      var totals = {};
      comps.forEach(function(c){
        var sub = records.filter(function(r){
          if (String(r.location || r.company || '').toUpperCase() !== c) return false;
          if (year && Number(r.fy) !== year) return false;
          return true;
        });
        totals[c] = sub.reduce(function(s, r){ return s + (Number(r.amount) || 0); }, 0);
      });
      var nameA = comps[0] === 'CRIUS FND' ? 'Crius FND' : (comps[0].charAt(0) + comps[0].slice(1).toLowerCase());
      var nameB = comps[1] === 'CRIUS FND' ? 'Crius FND' : (comps[1].charAt(0) + comps[1].slice(1).toLowerCase());
      var diff = totals[comps[0]] - totals[comps[1]];
      var pctDiff = totals[comps[1]] ? (diff / totals[comps[1]] * 100) : 0;
      var higher = diff >= 0 ? nameA : nameB;
      var yearLbl = year ? ' (FY ' + year + ')' : '';
      return '<div><b>Comparison' + yearLbl + '</b></div>' +
             '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>' + nameA + '</span><span style="font-family:var(--font-mono);font-weight:700;">' + inr_(totals[comps[0]]) + '</span></div>' +
             '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>' + nameB + '</span><span style="font-family:var(--font-mono);font-weight:700;">' + inr_(totals[comps[1]]) + '</span></div>' +
             '<div style="margin-top:10px;font-size:13px;"><b>' + higher + '</b> spent <span style="color:var(--accent);font-weight:700;">' + inr_(Math.abs(diff)) + '</span> ' + (diff >= 0 ? 'more' : 'less') + ' (' + Math.abs(pctDiff).toFixed(1) + '%)</div>';
    }
  }

  if (/\b(highest|biggest|largest|max)\b.*\b(single|one|transaction|expense|payment)\b/.test(q)
      && !/\bmonth\b/.test(q)) {
    var topRec = filtered[0];
    filtered.forEach(function(r){ if ((Number(r.amount) || 0) > (Number(topRec.amount) || 0)) topRec = r; });
    if (topRec) {
      return '<div><b>Highest single expense' + scope + '</b></div>' +
             '<div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:var(--accent);margin:8px 0;">' + inr_(topRec.amount) + '</div>' +
             '<div style="font-size:12px;color:var(--text-muted);">' + escHtml_(topRec.particulars || '') + '</div>' +
             '<div style="font-size:12px;color:var(--text-muted);">' + escHtml_(topRec.account || '') + '</div>' +
             '<div style="font-size:12px;color:var(--text-muted);">' + (topRec.month_year || '') + ' · ' + (topRec.company || topRec.location || '') + '</div>';
    }
  }

  return null;
}

function buildScopeLabel_(company, year, monthNum, MONTH_FULL) {
  var parts = [];
  if (company) parts.push(company === 'CRIUS FND' ? 'Crius FND' : (company.charAt(0) + company.slice(1).toLowerCase()));
  if (year) parts.push('FY ' + year);
  if (monthNum) parts.push(MONTH_FULL[monthNum - 1]);
  return parts.length ? ' for ' + parts.join(' · ') : '';
}
function inr_(n){ return '₹' + new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(Math.round(Number(n)||0)); }
function inr2_(n){ return '₹' + new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0); }
function fmtNum_(n){ return new Intl.NumberFormat('en-IN').format(Number(n)||0); }
function escHtml_(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ═══════════════════════════════════════════════════════════════════
   SNAPSHOTS SENT TO THE WORKER (unchanged from Code.gs)
   ═══════════════════════════════════════════════════════════════════ */
function buildRichSnapshot_(records) {
  var total = 0;
  var byCompany = {}, byCategory = {}, byParticular = {}, byFY = {};
  var companyYear = {}, yearMonth = {};

  records.forEach(function(r){
    var amt  = Number(r.amount) || 0;
    var loc  = String(r.location || r.company || '').toUpperCase() || 'UNKNOWN';
    var cat  = r.account || 'Uncategorized';
    var part = r.particulars || 'Uncategorized';
    var fy   = Number(r.fy) || 0;
    var m    = Number(r.month) || 0;

    total += amt;
    byCompany[loc]     = (byCompany[loc]     || 0) + amt;
    byCategory[cat]    = (byCategory[cat]    || 0) + amt;
    byParticular[part] = (byParticular[part] || 0) + amt;
    if (fy) byFY[fy]   = (byFY[fy]           || 0) + amt;
    if (fy) {
      companyYear[loc + '|' + fy]  = (companyYear[loc + '|' + fy]  || 0) + amt;
      if (m) yearMonth[fy + '|' + m] = (yearMonth[fy + '|' + m]    || 0) + amt;
    }
  });

  function topArr(obj, n) {
    return Object.keys(obj)
      .map(function(k){ return [k, obj[k]]; })
      .sort(function(a,b){ return b[1] - a[1]; })
      .slice(0, n);
  }
  function nest(obj) {
    var out = {};
    Object.keys(obj).forEach(function(k){
      var parts = k.split('|');
      if (!out[parts[0]]) out[parts[0]] = {};
      out[parts[0]][parts[1]] = obj[k];
    });
    return out;
  }

  var sortedRecs = records.slice().sort(function(a, b){ return (Number(b.amount)||0) - (Number(a.amount)||0); });

  return {
    meta: {
      records: records.length,
      total: total,
      years: Object.keys(byFY).map(Number).sort(function(a,b){ return a - b; })
    },
    byCompany:    topArr(byCompany,    5),
    byFY:         topArr(byFY,        10),
    byCategory:   topArr(byCategory,   8),
    byParticular: topArr(byParticular, 8),
    cy: nest(companyYear),
    ym: nest(yearMonth),
    top: sortedRecs.slice(0, 5).map(function(r){
      return [r.fy, r.month_year, r.location || r.company, r.account, r.particulars, r.amount];
    })
  };
}

function buildMinimalSnapshot_(records) {
  var total = 0;
  var byCompany = {}, byFY = {}, byCategory = {};
  records.forEach(function(r){
    var amt = Number(r.amount) || 0;
    var loc = String(r.location || r.company || '').toUpperCase() || 'UNKNOWN';
    var cat = r.account || 'Uncategorized';
    var fy  = Number(r.fy) || 0;
    total += amt;
    byCompany[loc]  = (byCompany[loc]  || 0) + amt;
    byCategory[cat] = (byCategory[cat] || 0) + amt;
    if (fy) byFY[fy] = (byFY[fy] || 0) + amt;
  });
  function topArr(obj, n) {
    return Object.keys(obj).map(function(k){ return [k, obj[k]]; })
      .sort(function(a,b){ return b[1] - a[1]; }).slice(0, n);
  }
  return {
    records: records.length,
    total: total,
    companies: topArr(byCompany, 3),
    years: topArr(byFY, 6),
    topCategories: topArr(byCategory, 5)
  };
}
