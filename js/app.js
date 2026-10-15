/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS & STATE
   ═══════════════════════════════════════════════════════════════════ */
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COMPANY_NAMES  = { 'CRIUS':'Crius', 'CHIROS':'Chiros', 'CRIUS FND':'Crius FND' };
const COMPANY_COLORS = { 'CRIUS':'#db2777', 'CHIROS':'#0891b2', 'CRIUS FND':'#d97706' };
const COMPANY_ORDER  = { 'CRIUS': 0, 'CHIROS': 1, 'CRIUS FND': 2 };

const MONTH_DRAWER_COLS = [
  { key: 'loc',         label: 'Location',           field: 0, sortAs: 'str' },
  { key: 'particulars', label: 'Particulars',        field: 1, sortAs: 'str' },
  { key: 'ac',          label: 'Expenses A/C Name',  field: 2, sortAs: 'str' },
  { key: 'descr',       label: 'DESCR',              field: 3, sortAs: 'str' },
  { key: 'txn',         label: 'TXNREMARK',          field: 5, sortAs: 'str' },
  { key: 'amt',         label: 'Expensebal',         field: 6, sortAs: 'num', num: true },
  { key: 'fy',          label: 'Fin. Year',          field: 7, sortAs: 'num' },
  { key: 'month',       label: 'Month-Year',         field: 8, sortAs: 'str' }
];

let allRecords = [];
let records    = [];
let currentFY  = 'ALL';
let currentLoc = '';
let selFY  = new Set();
let selLoc = new Set();
let fyInitialized = false;
let allFYs = [];
let fyMs = null, locMs = null, rptFyMs = null, rptLocMs = null;
let reportYears = [];
let reportAllYears = [];
const ALL_COMPANIES = ['CRIUS', 'CHIROS', 'CRIUS FND'];
let reportCompanies = [];
let reportFYSel = new Set();
let reportLocSel = new Set();
let reportGroups = new Set();
let reportAccts  = new Set();
let pendingGroups = new Set();
let pendingAccts  = new Set();
let savingsGenerated = false;
let reviewGenerated  = false;

let drawerMode = 'ac';
let drawerMonthKey = '';
let drawerParticular = '';
let drawerParticularYear = null;
let drawerFYCompany = '';
let monthDrawerRows = [];
let monthDrawerLoc = '';
let monthDrawerPresetCompany = '';
let monthDrawerColSort = 'amt';
let monthDrawerColDir  = 'desc';

let monthSortKey = 'month';
let monthSortDir = 'desc';
let fySortKey = 'year';
let fySortDir = 'asc';
let pivotSortParticular = '';
let pivotSortDir = 'asc';

let expSortKey = 'total';
let expSortDir = 'desc';
let rptUnifiedSortKey = 'total';
let rptUnifiedSortDir = 'desc';

let cmdItems = [];
let cmdFiltered = [];
let cmdActiveIndex = 0;

let lastAiQuestion = '';

const fmt  = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ═══════════════════════════════════════════════════════════════════
   MULTI-SELECT CHECKBOX DROPDOWN
   ═══════════════════════════════════════════════════════════════════ */
function syncCurrent() {
  currentFY  = selFY.size === 1 ? String(Array.from(selFY)[0]) : 'ALL';
  currentLoc = selLoc.size === 1 ? Array.from(selLoc)[0] : '';
}
function fyScopeText() {
  if (!selFY.size) return 'No years';
  if (selFY.size >= allFYs.length) return 'All Years';
  return Array.from(selFY).sort((a, b) => a - b).map(y => 'FY ' + y).join(', ');
}
function locScopeText() {
  if (!selLoc.size) return 'No companies';
  if (selLoc.size >= ALL_COMPANIES.length) return 'All Companies';
  return ALL_COMPANIES.filter(k => selLoc.has(k)).map(k => COMPANY_NAMES[k] || k).join(', ');
}

function createMultiSelect(host, cfg) {
  host.classList.add('ms');
  host.innerHTML = '<button type="button" class="ms-btn" aria-haspopup="true" aria-expanded="false"><span class="ms-text"></span><span class="ms-caret">▾</span></button><div class="ms-panel" role="group"></div>';
  const btn = host.querySelector('.ms-btn'), txt = host.querySelector('.ms-text'), panel = host.querySelector('.ms-panel');
  const close = () => { host.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  const open  = () => { document.dispatchEvent(new CustomEvent('ms-close-others', { detail: host })); host.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); };

  function refresh() {
    const opts = cfg.options();
    const sel = cfg.getSel();
    const total = opts.length;
    const selSize = sel.size;
    const allSelected = total > 0 && selSize >= total;
    const noneSelected = selSize === 0;

    if (noneSelected)      txt.textContent = cfg.noneLabel || ('No ' + cfg.plural);
    else if (allSelected)  txt.textContent = cfg.allLabel;
    else {
      const one = opts.filter(o => sel.has(o.value))[0];
      txt.textContent = (selSize === 1 && one) ? one.label : selSize + ' ' + cfg.plural;
    }

    const masterChecked = allSelected;
    const masterIndet   = !allSelected && !noneSelected;

    panel.innerHTML =
      '<label class="ms-opt ms-all"><input type="checkbox" data-all' +
        (masterChecked ? ' checked' : '') +
        '><span>' + esc(cfg.allLabel) + '</span></label>' +
      '<div class="ms-sep"></div>' +
      opts.map(o =>
        '<label class="ms-opt"><input type="checkbox" value="' + esc(o.value) + '"' +
        (sel.has(o.value) ? ' checked' : '') +
        '><span>' + esc(o.label) + '</span></label>'
      ).join('');

    const master = panel.querySelector('input[data-all]');
    if (master) master.indeterminate = masterIndet;
  }

  panel.addEventListener('change', e => {
    const t = e.target;
    if (!t || t.type !== 'checkbox') return;
    const values = cfg.options().map(o => o.value);
    let next;
    if (t.hasAttribute('data-all')) {
      const cur = cfg.getSel();
      const isCurrentlyAll = values.length > 0 && cur.size >= values.length;
      next = isCurrentlyAll ? new Set() : new Set(values);
    } else {
      const cur = cfg.getSel();
      next = new Set(cur);
      if (t.checked) next.add(t.value); else next.delete(t.value);
    }
    cfg.setSel(next);
  });

  btn.addEventListener('click', e => { e.stopPropagation(); host.classList.contains('open') ? close() : open(); });
  panel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('ms-close-others', e => { if (e.detail !== host) close(); });
  refresh();
  return { refresh: refresh, close: close };
}

function normalizeRecord(r) {
  return {
    locationKey:   String(r.location || '').toUpperCase(),
    financialYear: Number(r.fy) || 0,
    month:         Number(r.month_num) || 0,
    expenseAmount: Number(r.amount) || 0,
    category:      r.account || 'Uncategorized',
    particulars:   r.particulars || '',
    monthYear:     r.month_year || '',
    descr:         r.descr || '',
    txnRemark:     r.txn_remark || ''
  };
}

function money(n, compact) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const v = Number(n);
  if (compact) {
    if (Math.abs(v) >= 1e7) return '₹' + (v/1e7).toFixed(2) + ' Cr';
    if (Math.abs(v) >= 1e5) return '₹' + (v/1e5).toFixed(2) + ' L';
    if (Math.abs(v) >= 1e3) return '₹' + (v/1e3).toFixed(1) + 'K';
  }
  return '₹' + fmt.format(Math.round(v));
}
function money2(n) { return (n === null || n === undefined || isNaN(n)) ? '—' : '₹' + fmt2.format(Number(n)); }
function pct(n) { return (n === null || isNaN(n)) ? '—' : Number(n).toFixed(1) + '%'; }
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function showBanner(msg, type) { const el = document.getElementById('banner'); el.className = 'banner ' + (type || 'info'); el.innerHTML = msg; el.classList.remove('d-none'); }
function showLoading(msg) { showBanner('<span class="spinner"></span> ' + msg, 'info'); }
function hideBanner() { document.getElementById('banner').classList.add('d-none'); }

function pill(loc, clickable) {
  const k = String(loc || '').toUpperCase();
  const cls = k === 'CRIUS' ? 'pill pill-crius' : k === 'CHIROS' ? 'pill pill-chiros' : k === 'CRIUS FND' ? 'pill pill-fnd' : 'pill pill-other';
  const label = COMPANY_NAMES[k] || loc || '—';
  const clickCls = clickable ? ' loc-clickable' : '';
  const title = clickable ? ' title="Click to filter to ' + esc(label) + '"' : '';
  const dataAttr = clickable ? ' data-pill-loc="' + esc(k) + '"' : '';
  return '<span class="' + cls + clickCls + '"' + dataAttr + title + '>' + esc(label) + '</span>';
}

function parseMonthYear(s) {
  const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const str = String(s || '');
  let m = str.match(/([A-Za-z]{3,})[\s\-\/,]+(\d{4})/);
  if (m) { const mo = months[m[1].toLowerCase().slice(0,3)]; if (mo) return { y: parseInt(m[2],10), m: mo }; }
  m = str.match(/(\d{4})[\-\/](\d{1,2})/);
  if (m) return { y: parseInt(m[1],10), m: parseInt(m[2],10) };
  return { y: 9999, m: 0 };
}
function monthKey(r) { if (r.monthYear) return r.monthYear; if (r.month >= 1 && r.month <= 12) return MONTH_ABBR[r.month-1] + ' ' + r.financialYear; return 'Unknown'; }
function monthKeySort(a, b) { const pa = parseMonthYear(a), pb = parseMonthYear(b); return (pa.y - pb.y) || (pa.m - pb.m); }
function fyRangeLabel() {
  if (!records.length) return '—';
  const years = records.map(r => Number(r.financialYear)).filter(y => !isNaN(y));
  if (!years.length) return '—';
  const min = Math.min(...years), max = Math.max(...years);
  return min === max ? 'FY ' + min : 'FY ' + min + '–' + max;
}

function computeDelta() {
  if (!selFY.size) return null;
  let base = allRecords;
  if (selLoc.size && selLoc.size < ALL_COMPANIES.length) {
    base = base.filter(r => selLoc.has(String(r.locationKey || '').toUpperCase()));
  }
  const byFy = {};
  base.forEach(r => { const fy = Number(r.financialYear); if (!fy) return; byFy[fy] = (byFy[fy] || 0) + r.expenseAmount; });
  const years = Object.keys(byFy).map(Number).sort((a,b) => a - b);
  if (years.length < 2) return null;
  let curMin, curMax;
  const sy = Array.from(selFY).sort((a, b) => a - b);
  if (sy.length >= allFYs.length) {
    curMin = years[0]; curMax = years[years.length - 1];
  } else {
    curMin = sy[0]; curMax = sy[sy.length - 1];
    if (curMax - curMin + 1 !== sy.length) return null;
    if (years.indexOf(curMin) === -1) return null;
  }
  const span = curMax - curMin + 1;
  const prevMax = curMin - 1, prevMin = prevMax - span + 1;
  let curTotal = 0; for (let y = curMin; y <= curMax; y++) curTotal += byFy[y] || 0;
  let prevTotal = 0; for (let y = prevMin; y <= prevMax; y++) prevTotal += byFy[y] || 0;
  if (prevTotal <= 0) return null;
  return { delta: ((curTotal - prevTotal) / prevTotal) * 100, prevLabel: span === 1 ? ('FY ' + prevMin) : ('FY ' + prevMin + '–' + prevMax) };
}
function renderDeltaBadge(el, delta) {
  if (!el) return;
  if (!delta) { el.innerHTML = ''; el.className = 'kpi-delta'; return; }
  const p = delta.delta;
  if (!isFinite(p)) { el.innerHTML = ''; return; }
  const up = p >= 0;
  el.className = 'kpi-delta ' + (up ? 'up' : 'down');
  el.innerHTML = '<span class="delta-arrow">' + (up ? '▲' : '▼') + '</span>' + Math.abs(p).toFixed(1) + '% vs ' + delta.prevLabel;
}

function applyClientFilters() {
  let filtered = allRecords;
  if (selFY.size)  filtered = filtered.filter(r => selFY.has(Number(r.financialYear)));
  else             filtered = [];
  if (selLoc.size) filtered = filtered.filter(r => selLoc.has(String(r.locationKey || '').toUpperCase()));
  else             filtered = [];
  records = filtered;

  // Keep the Report tab's filters in lock-step with the dashboard's
  if (typeof reportFYSel !== 'undefined' && !setsEqual(reportFYSel, selFY)) {
    reportFYSel = new Set(selFY);
    if (rptFyMs) rptFyMs.refresh();
  }
  if (typeof reportLocSel !== 'undefined' && !setsEqual(reportLocSel, selLoc)) {
    reportLocSel = new Set(selLoc);
    if (rptLocMs) rptLocMs.refresh();
  }
  syncReportSelection();

  renderLayoutForFilter(); renderKPIs(); renderMonthlyBreakdown(); renderFYBreakdown(); applyPivotFilters(); updateResetButton();
  if (document.getElementById('drawer').classList.contains('open')) {
    if (drawerMode === 'ac' || drawerMode === 'particulars') renderDrawer(document.getElementById('drawerSearch').value);
    else if (drawerMode === 'particular') renderParticularDrawer(document.getElementById('drawerSearch').value);
    else if (drawerMode === 'month') renderMonthDrawer(document.getElementById('drawerSearch').value);
    else if (drawerMode === 'fy_view') renderFYDrawer(document.getElementById('drawerSearch').value);
  }
}
function hasActiveFilters() {
  const sb = document.getElementById('searchBox'), ms = document.getElementById('monthSearch');
  const fyFiltered  = selFY.size  !== allFYs.length;
  const locFiltered = selLoc.size !== ALL_COMPANIES.length;
  return fyFiltered || locFiltered || (sb && !!sb.value.trim()) || (ms && !!ms.value.trim());
}
function updateResetButton() { const btn = document.getElementById('resetBtn'); if (btn) btn.classList.toggle('is-visible', hasActiveFilters()); }
function resetAllFilters() {
  selFY  = new Set(allFYs);
  selLoc = new Set(ALL_COMPANIES);
  syncCurrent();
  monthSortKey = 'month'; monthSortDir = 'desc';
  fySortKey = 'year'; fySortDir = 'asc';
  monthDrawerColSort = 'amt'; monthDrawerColDir = 'desc'; monthDrawerPresetCompany = '';
  pivotSortParticular = ''; pivotSortDir = 'asc';
  expSortKey = 'total'; expSortDir = 'desc';
  rptUnifiedSortKey = 'total'; rptUnifiedSortDir = 'desc';
  if (fyMs) fyMs.refresh();
  if (locMs) locMs.refresh();
  document.getElementById('searchBox').value = '';
  document.getElementById('monthSearch').value = '';
  closeDrawer(); applyClientFilters();
}

function arrEqual(a, b) { const x = a.slice().sort(), y = b.slice().sort(); return x.length === y.length && x.every((v, i) => v === y[i]); }
function setsEqual(a, b) { if (a.size !== b.size) return false; for (const v of a) if (!b.has(v)) return false; return true; }

function getExpenseTypeName(r) {
  const rawGroup = (r.particulars || 'Uncategorized').trim();
  const isGenericExpense = /^(?:consumables?|expenses?\s*(?:\(\s*(?:direct|indirect)\s*\)|-?\s*(?:direct|indirect))?|(?:direct|indirect)\s+expenses?|(?:direct|indirect)\s+exp)$/i.test(rawGroup);
  return isGenericExpense ? (r.category || 'Uncategorized') : rawGroup;
}

function getReportRecords(applyTypes) {
  if (!reportYears.length || !reportCompanies.length) return [];
  const ys = new Set(reportYears), cs = new Set(reportCompanies);
  const useTypes = !!applyTypes && (reportGroups.size || reportAccts.size);
  return allRecords.filter(r => {
    if (!ys.has(Number(r.financialYear))) return false;
    if (!cs.has(String(r.locationKey || '').toUpperCase())) return false;
    if (useTypes) {
      const g = getExpenseTypeName(r), a = r.category || 'Uncategorized';
      if (!reportGroups.has(g) && !reportAccts.has(a)) return false;
    }
    return true;
  });
}

function syncReportSelection() {
  reportYears = reportFYSel.size ? Array.from(reportFYSel).sort((a, b) => a - b) : [];
  reportCompanies = reportLocSel.size ? ALL_COMPANIES.filter(k => reportLocSel.has(k)) : [];
}
function initReportFilters() {
  reportFYSel = new Set(selFY);
  reportLocSel = new Set(selLoc);
  syncReportSelection();
  renderReportFilterUI();
}
function reportFiltersActive() { return hasActiveFilters(); }
function resetReportFilters() { resetAllFilters(); }

function renderReportFilterUI() {
  if (rptFyMs) rptFyMs.refresh();
  if (rptLocMs) rptLocMs.refresh();
  const rb = document.getElementById('rptResetBtn');
  if (rb) rb.classList.toggle('is-visible', reportFiltersActive());

  const ap = document.getElementById('rfApplied');
  if (!ap) return;
  const tag = t => '<span class="rf-tag">' + esc(t) + '</span>';
  const allSelFY  = reportFYSel.size > 0 && reportFYSel.size >= allFYs.length;
  const noSelFY   = reportFYSel.size === 0;
  const allSelLoc = reportLocSel.size > 0 && reportLocSel.size >= ALL_COMPANIES.length;
  const noSelLoc  = reportLocSel.size === 0;
  const yrs = noSelFY  ? tag('No years')
            : allSelFY ? tag('All years')
            : reportYears.map(y => tag('FY ' + y)).join('');
  const cos = noSelLoc  ? tag('No companies')
            : allSelLoc ? tag('All companies')
            : reportCompanies.map(k => tag(COMPANY_NAMES[k] || k)).join('');
  const typeNames = Array.from(reportGroups).concat(Array.from(reportAccts));
  let typeHtml = tag('All expense types');
  if (typeNames.length) {
    const shown = typeNames.slice(0, 3).map(t => tag(t.length > 28 ? t.slice(0, 26) + '…' : t)).join('');
    typeHtml = shown + (typeNames.length > 3 ? tag('+' + (typeNames.length - 3) + ' more') : '');
  }
  const n = getReportRecords(true).length;
  ap.innerHTML =
    '<span class="rf-group"><span class="rf-glabel">Years</span>' + yrs + '</span>' +
    '<span class="rf-group"><span class="rf-glabel">Companies</span>' + cos + '</span>' +
    '<span class="rf-group"><span class="rf-glabel">Expense types</span>' + typeHtml + '</span>' +
    '<span class="rf-count">' + fmt.format(n) + ' transactions</span>';
}

function refreshExpSelClasses() {
  document.querySelectorAll('#expAnalysisTable tr[data-sel-kind]').forEach(tr => {
    const set = tr.getAttribute('data-sel-kind') === 'g' ? pendingGroups : pendingAccts;
    tr.classList.toggle('row-sel', set.has(tr.getAttribute('data-sel-key')));
  });
}
function updateExpSelUI() {
  const st = document.getElementById('expSelStatus'), ap = document.getElementById('expApplyBtn'), cl = document.getElementById('expClearBtn');
  if (!st || !ap || !cl) return;
  const pn = pendingGroups.size + pendingAccts.size, an = reportGroups.size + reportAccts.size;
  const dirty = !setsEqual(pendingGroups, reportGroups) || !setsEqual(pendingAccts, reportAccts);
  if (dirty) st.innerHTML = '<b>' + pn + '</b> selected · not applied yet';
  else if (an) st.innerHTML = 'Filtering the report by <b>' + an + '</b> expense type' + (an === 1 ? '' : 's');
  else st.textContent = 'No selection — showing all expense types';
  ap.disabled = !dirty;
  cl.style.display = (pn || an) ? '' : 'none';
}
function applyExpSelection() {
  reportGroups = new Set(pendingGroups); reportAccts = new Set(pendingAccts);
  renderReport();
}
function clearExpSelection() {
  pendingGroups = new Set(); pendingAccts = new Set(); reportGroups = new Set(); reportAccts = new Set();
  renderReport();
}

function downloadCSV(filename, rows) {
  const csv = rows.map(row => row.map(cell => {
    const s = (cell === null || cell === undefined) ? '' : String(cell);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function csvTimestamp() { const d = new Date(); const pad = n => String(n).padStart(2, '0'); return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()); }
function fyScopeTag() { return (selFY.size && selFY.size < allFYs.length ? 'fy' + Array.from(selFY).sort((a, b) => a - b).join('-') : 'allyears') + (selLoc.size && selLoc.size < ALL_COMPANIES.length ? '_' + Array.from(selLoc).map(k => k.toLowerCase().replace(/\s+/g, '')).join('-') : ''); }

function exportFYCSV() {
  const rows = [['Financial Year','Crius','Chiros','Crius FND','Total','Tx','Avg / Tx','YoY %','Top Month']];
  const map = {};
  records.forEach(r => {
    const fy = Number(r.financialYear); if (!fy) return;
    if (!map[fy]) map[fy] = { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0, total:0, tx:0, months:{} };
    const loc = String(r.locationKey || '').toUpperCase();
    map[fy][loc] = (map[fy][loc] || 0) + r.expenseAmount;
    map[fy].total += r.expenseAmount; map[fy].tx += 1;
    const mk = monthKey(r); map[fy].months[mk] = (map[fy].months[mk] || 0) + r.expenseAmount;
  });
  const years = Object.keys(map).map(Number).sort((a,b) => a - b);
  years.forEach((y, i) => {
    const d = map[y]; const avg = d.tx ? d.total / d.tx : 0; let yoy = '';
    if (i > 0) { const prev = map[years[i-1]].total; if (prev > 0) yoy = (((d.total - prev) / prev) * 100).toFixed(1); }
    const topMonthEntry = Object.entries(d.months).sort((a,b) => b[1]-a[1])[0] || ['',''];
    rows.push(['FY ' + y, d['CRIUS']||0, d['CHIROS']||0, d['CRIUS FND']||0, d.total, d.tx, avg.toFixed(2), yoy, topMonthEntry[0]]);
  });
  downloadCSV('crius_fy_breakdown_' + fyScopeTag() + '_' + csvTimestamp() + '.csv', rows);
}
function exportMonthlyCSV() {
  const rows = [['Month','Crius','Chiros','Crius FND','Total','Tx','MoM %']];
  const map = {};
  records.forEach(r => { const k = monthKey(r); if (!map[k]) map[k] = { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0, total:0, tx:0 }; const loc = String(r.locationKey || '').toUpperCase(); map[k][loc] = (map[k][loc] || 0) + r.expenseAmount; map[k].total += r.expenseAmount; map[k].tx += 1; });
  const keys = Object.keys(map).sort(monthKeySort);
  keys.forEach((k, i) => { const prevTotal = i > 0 ? map[keys[i-1]].total : 0; const mom = prevTotal > 0 ? (((map[k].total - prevTotal) / prevTotal) * 100).toFixed(1) : ''; rows.push([k, map[k]['CRIUS']||0, map[k]['CHIROS']||0, map[k]['CRIUS FND']||0, map[k].total, map[k].tx, mom]); });
  downloadCSV('crius_monthly_breakdown_' + fyScopeTag() + '_' + csvTimestamp() + '.csv', rows);
}
function exportParticularsCSV() {
  const data = buildPivotData(records);
  const headers = ['Financial Year', ...data.particulars.map(p => p.name), 'Total'];
  const rows = [headers];
  let sortedFys = data.fys.slice();
  if (pivotSortParticular === '__total') sortedFys.sort((a, b) => { const cmp = (data.rowTotals[a] || 0) - (data.rowTotals[b] || 0); return pivotSortDir === 'asc' ? cmp : -cmp; });
  else if (pivotSortParticular) sortedFys.sort((a, b) => { const av = (data.matrix[a] && data.matrix[a][pivotSortParticular]) || 0; const bv = (data.matrix[b] && data.matrix[b][pivotSortParticular]) || 0; return pivotSortDir === 'asc' ? av - bv : bv - av; });
  else sortedFys.sort((a, b) => pivotSortDir === 'asc' ? a - b : b - a);
  sortedFys.forEach(fy => { const row = ['FY ' + fy]; data.particulars.forEach(p => row.push((data.matrix[fy] && data.matrix[fy][p.name]) || 0)); row.push(data.rowTotals[fy]); rows.push(row); });
  const footer = ['TOTAL']; data.particulars.forEach(p => footer.push(data.colTotals[p.name])); footer.push(data.grandTotal); rows.push(footer);
  downloadCSV('crius_fy_particulars_pivot_' + fyScopeTag() + '_' + csvTimestamp() + '.csv', rows);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footerYear').textContent = new Date().getFullYear();
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-bs-theme', saved);
  document.getElementById('themeToggle').textContent = saved === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeToggle').addEventListener('click', function () {
    const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    localStorage.setItem('theme', next);
    this.textContent = next === 'dark' ? '☀️' : '🌙';
  });
  document.getElementById('resetBtn').addEventListener('click', resetAllFilters);

  const brandHome = document.getElementById('brandHome');
  if (brandHome) {
    brandHome.classList.add('is-home');
    const doBrandReset = () => { resetAllFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); showBanner('⟲ Filters reset', 'info'); clearTimeout(doBrandReset._t); doBrandReset._t = setTimeout(hideBanner, 1400); };
    brandHome.addEventListener('click', doBrandReset);
    brandHome.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); doBrandReset(); } });
  }

  fyMs = createMultiSelect(document.getElementById('fyMs'), {
    allLabel: 'All Years', noneLabel: 'No years', plural: 'years',
    options: () => allFYs.map(y => ({ value: String(y), label: 'FY ' + y })),
    getSel: () => new Set(Array.from(selFY).map(String)),
    setSel: sel => { selFY = new Set(Array.from(sel).map(Number)); syncCurrent(); fyMs.refresh(); applyClientFilters(); }
  });
  locMs = createMultiSelect(document.getElementById('locMs'), {
    allLabel: 'All Companies', noneLabel: 'No companies', plural: 'companies',
    options: () => ALL_COMPANIES.map(k => ({ value: k, label: COMPANY_NAMES[k] || k })),
    getSel: () => new Set(selLoc),
    setSel: sel => { selLoc = new Set(sel); syncCurrent(); locMs.refresh(); applyClientFilters(); }
  });

  document.querySelectorAll('#companyRow .kpi[data-loc]').forEach(card => {
    card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => { const loc = card.getAttribute('data-loc'); if (!loc) return; selLoc = new Set([loc]); syncCurrent(); if (locMs) locMs.refresh(); applyClientFilters(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
  });

  document.getElementById('refreshBtn').addEventListener('click', () => { const btn = document.getElementById('refreshBtn'); btn.disabled = true; btn.textContent = '⏳'; showLoading('Refreshing data from server…'); loadInitial(true); });

  document.getElementById('searchBox').addEventListener('input', () => { applyPivotFilters(); updateResetButton(); });
  document.getElementById('monthSearch').addEventListener('input', () => { renderMonthlyBreakdown(); updateResetButton(); });

  const pivotBody = document.getElementById('pivotBody');
  if (pivotBody) {
    pivotBody.addEventListener('click', (e) => {
      const cell = e.target.closest('td[data-action="cell"]');
      if (!cell) return;
      const fy = parseInt(cell.getAttribute('data-fy'), 10);
      const particular = cell.getAttribute('data-particular') || '';
      openParticularDrawer(particular, fy);
    });
    pivotBody.addEventListener('click', (e) => {
      const cell = e.target.closest('td[data-action="row-total"]');
      if (!cell) return;
      const fy = parseInt(cell.getAttribute('data-fy'), 10);
      openParticularDrawer('', fy);
    });
  }

  document.getElementById('monthlyBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-month]'); if (!tr) return;
    const compCell = e.target.closest('td[data-loc]');
    if (compCell) { if (compCell.getAttribute('data-zero') === '1') return; const mk = tr.getAttribute('data-month') || ''; const fy = parseInt(tr.getAttribute('data-fy'), 10); const m  = parseInt(tr.getAttribute('data-m'), 10); const company = compCell.getAttribute('data-loc'); openDrawer('month', mk, fy, m, company); return; }
    const totalCell = e.target.closest('td.total-cell');
    if (totalCell) { const mk = tr.getAttribute('data-month') || ''; const fy = parseInt(tr.getAttribute('data-fy'), 10); const m  = parseInt(tr.getAttribute('data-m'), 10); openDrawer('month', mk, fy, m, null); return; }
  });

  document.getElementById('statUniqueAcCard').addEventListener('click', () => openDrawer('ac'));
  document.getElementById('topParticularCard').addEventListener('click', () => openDrawer('particulars'));
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.getElementById('drawerBackdrop').addEventListener('click', closeDrawer);
  document.getElementById('drawerSearch').addEventListener('input', e => renderDrawer(e.target.value));

  document.getElementById('drawerExpand').addEventListener('click', function() {
    const drawer = document.getElementById('drawer');
    drawer.classList.toggle('fullscreen');
    const isFull = drawer.classList.contains('fullscreen');
    this.innerHTML = isFull
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="10" y1="14" x2="3" y2="21"></line><line x1="21" y1="3" x2="14" y2="10"></line></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    this.title = isFull ? 'Minimize' : 'Maximize';
  });

  document.getElementById('cmdBackdrop').addEventListener('click', closeCommandPalette);
  document.getElementById('cmdInput').addEventListener('input', (e) => { cmdActiveIndex = 0; renderCommandResults(e.target.value); });
  document.getElementById('cmdInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (cmdActiveIndex < cmdFiltered.length - 1) cmdActiveIndex++; renderCommandResults(e.target.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (cmdActiveIndex > 0) cmdActiveIndex--; renderCommandResults(e.target.value); }
    else if (e.key === 'Enter') { e.preventDefault(); if (cmdFiltered[cmdActiveIndex]) cmdFiltered[cmdActiveIndex].action(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); closeCommandPalette(); closeAIAssistant(); }
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); }
  });

  rptFyMs = createMultiSelect(document.getElementById('rptFyMs'), {
    allLabel: 'All Years', noneLabel: 'No years', plural: 'years',
    options: () => allFYs.map(y => ({ value: String(y), label: 'FY ' + y })),
    getSel: () => new Set(Array.from(reportFYSel).map(String)),
    setSel: sel => {
      const numSel = new Set(Array.from(sel).map(Number));
      selFY = numSel;
      reportFYSel = new Set(numSel);
      syncCurrent();
      syncReportSelection();
      if (fyMs) fyMs.refresh();
      if (rptFyMs) rptFyMs.refresh();
      applyClientFilters();
    }
  });
  rptLocMs = createMultiSelect(document.getElementById('rptLocMs'), {
    allLabel: 'All Companies', noneLabel: 'No companies', plural: 'companies',
    options: () => ALL_COMPANIES.map(k => ({ value: k, label: COMPANY_NAMES[k] || k })),
    getSel: () => new Set(reportLocSel),
    setSel: sel => {
      const s = new Set(sel);
      selLoc = s;
      reportLocSel = new Set(s);
      syncCurrent();
      syncReportSelection();
      if (locMs) locMs.refresh();
      if (rptLocMs) rptLocMs.refresh();
      applyClientFilters();
    }
  });
  const rptRst = document.getElementById('rptResetBtn');
  if (rptRst) rptRst.addEventListener('click', resetReportFilters);

  const unifiedCsv = document.getElementById('rptUnifiedCsvBtn');
  if (unifiedCsv) unifiedCsv.addEventListener('click', exportUnifiedComparisonCSV);

  updateResetButton();
  loadInitial(false);
});

/* ═══════════════════════════════════════════════════════════════════
   DATA LOAD — via the Cloudflare Worker (/data)
   ═══════════════════════════════════════════════════════════════════ */
function loadInitial(isRefresh) {
  if (!isRefresh) showLoading('Loading dashboard…');
  getDashboardData(isRefresh)
    .then(payload => {
      const btn = document.getElementById('refreshBtn'); if (btn) { btn.disabled = false; btn.textContent = '↻'; }
      const rows = (payload && payload.rows) || [];
      allRecords = rows.map(normalizeRecord);
      const years = [...new Set(allRecords.map(r => Number(r.financialYear)))].filter(y => y).sort((a,b) => a-b);
      populateFY(years);
      reportAllYears = years.slice();
      initReportFilters();
      const stamp = new Date().toLocaleString('en-IN');
      document.getElementById('lastUpdate').textContent = 'Updated ' + stamp;
      document.getElementById('footerUpdate').textContent = 'Updated ' + stamp;
      if (!allRecords.length) { showBanner('<b>No valid records after parsing.</b> Headers detected: ' + esc((payload.headers||[]).join(' | ')), 'danger'); return; }
      hideBanner();
      applyClientFilters();
    })
    .catch(err => {
      const btn = document.getElementById('refreshBtn'); if (btn) { btn.disabled = false; btn.textContent = '↻'; }
      showBanner('<b>Load error:</b> ' + esc((err && err.message) || String(err)), 'danger');
    });
}

function populateFY(years) {
  allFYs = years.map(Number).sort((a, b) => a - b);
  selFY = new Set(Array.from(selFY).filter(y => allFYs.indexOf(y) !== -1));
  if (!fyInitialized && allFYs.length) {
    selFY  = new Set(allFYs);
    selLoc = new Set(ALL_COMPANIES);
    fyInitialized = true;
  }
  reportFYSel  = new Set(selFY);
  reportLocSel = new Set(selLoc);
  syncCurrent();
  syncReportSelection();
  if (fyMs)  fyMs.refresh();
  if (locMs) locMs.refresh();
}

function renderLayoutForFilter() {
  const companyRow = document.getElementById('companyRow');
  const statsRow   = document.getElementById('statsRow');
  const brandMark  = document.getElementById('brandMark');
  const brandTitle = document.getElementById('brandTitle');
  const brandSub   = document.getElementById('brandSub');
  const overviewTitle = document.getElementById('overviewTitle');
  const card1      = document.getElementById('card1');
  const card1Label = document.getElementById('card1Label');
  document.querySelectorAll('#companyRow .kpi[data-loc]').forEach(c => {
    const col = c.parentElement;
    if (col && col !== companyRow) col.style.display = (selLoc.size > 1 && !selLoc.has(c.getAttribute('data-loc'))) ? 'none' : '';
  });
  if (!currentLoc) {
    companyRow.classList.remove('d-none'); statsRow.classList.add('d-none');
    brandMark.style.background = 'linear-gradient(135deg, #ec4899 0%, #7c3aed 100%)';
    brandTitle.textContent = 'Crius Life Science'; brandSub.textContent = 'Expense Report';
    overviewTitle.textContent = 'Overview'; card1.className = 'kpi primary'; card1Label.textContent = 'Total Expenses';
  } else {
    companyRow.classList.add('d-none'); statsRow.classList.remove('d-none');
    const name = COMPANY_NAMES[currentLoc] || currentLoc;
    const color = COMPANY_COLORS[currentLoc] || '#7c3aed';
    brandMark.style.background = 'linear-gradient(135deg, ' + color + ' 0%, ' + color + 'dd 100%)';
    brandTitle.textContent = name + ' Dashboard'; brandSub.textContent = 'Crius Life Science · Filtered';
    overviewTitle.textContent = name + ' · Overview';
    card1.className = currentLoc === 'CRIUS' ? 'kpi primary-crius' : currentLoc === 'CHIROS' ? 'kpi primary-chiros' : 'kpi primary-fnd';
    card1Label.textContent = name + ' Total';
  }
}

function renderKPIs() {
  const byLoc = { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0 };
  const txByLoc = { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0 };
  const monthSet = new Set();
  let total = 0;
  records.forEach(r => { const k = String(r.locationKey || '').toUpperCase(); byLoc[k] = (byLoc[k] || 0) + r.expenseAmount; txByLoc[k] = (txByLoc[k] || 0) + 1; total += r.expenseAmount; monthSet.add(r.financialYear + '-' + r.month); });
  const monthCount = monthSet.size || 1;
  document.getElementById('card1Value').textContent = money(total);
  document.getElementById('card1Sub').textContent = fmt.format(records.length) + ' transactions';
  renderDeltaBadge(document.getElementById('card1Delta'), computeDelta());
  const c1t = document.getElementById('card1Trend'); c1t.textContent = fyRangeLabel(); c1t.className = 'trend acc';

  const monthTotals = {}; records.forEach(r => { const k = monthKey(r); monthTotals[k] = (monthTotals[k] || 0) + r.expenseAmount; });
  const monthEntries = Object.entries(monthTotals).sort((a, b) => monthKeySort(a[0], b[0]));

  const card2Label = document.getElementById('card2Label');
  const card2Value = document.getElementById('card2Value');
  const card2Sub   = document.getElementById('card2Sub');
  const card2Trend = document.getElementById('card2Trend');

  if (!monthEntries.length) { card2Label.textContent = 'Month'; card2Value.textContent = '—'; card2Sub.textContent = 'no data'; card2Trend.textContent = '—'; card2Trend.className = 'trend flat'; }
  else if (currentFY === 'ALL') {
    card2Label.textContent = 'Latest Month';
    const latestEntry = monthEntries[monthEntries.length - 1];
    const latestName = latestEntry[0], latestVal = latestEntry[1];
    const prevVal = monthEntries.length >= 2 ? monthEntries[monthEntries.length - 2][1] : 0;
    card2Value.textContent = money(latestVal); card2Sub.textContent = latestName;
    if (prevVal <= 0) { card2Trend.textContent = 'no prior month'; card2Trend.className = 'trend flat'; }
    else { const momPct = ((latestVal - prevVal) / prevVal) * 100; const up = momPct >= 0; card2Trend.textContent = (up ? '↑ ' : '↓ ') + Math.abs(momPct).toFixed(1) + '% MoM'; card2Trend.className = 'trend ' + (up ? 'up' : 'down'); }
  } else {
    card2Label.textContent = 'Peak Month';
    const peak = monthEntries.slice().sort((a, b) => b[1] - a[1])[0];
    card2Value.textContent = money(peak[1]); card2Sub.textContent = peak[0];
    const share = total ? (peak[1] / total * 100) : 0;
    card2Trend.textContent = pct(share) + ' of FY'; card2Trend.className = 'trend acc';
  }
  renderContextCard3(total, byLoc);

  const partTotals = {}; records.forEach(r => { const k = r.particulars || 'Uncategorized'; partTotals[k] = (partTotals[k] || 0) + r.expenseAmount; });
  let partName = '', partVal = 0;
  Object.entries(partTotals).forEach(([k, v]) => { if (v > partVal) { partVal = v; partName = k; } });
  if (!partName) partName = '—';
  document.getElementById('kpiTopCat').textContent = partName.length > 24 ? partName.slice(0, 22) + '…' : partName;
  document.getElementById('kpiTopCatVal').textContent = money(partVal);
  const partPct = total ? (partVal / total * 100) : 0;
  document.getElementById('kpiTopCatPct').textContent = pct(partPct) + ' share';
  document.getElementById('kpiTopCatPct').className = 'trend acc';

  if (!currentLoc) {
    document.getElementById('kpiCrius').textContent  = money(byLoc['CRIUS']);
    document.getElementById('kpiChiros').textContent = money(byLoc['CHIROS']);
    document.getElementById('kpiFnd').textContent    = money(byLoc['CRIUS FND']);
    document.getElementById('kpiCriusPct').textContent = fyRangeLabel();
    document.getElementById('kpiChirosPct').textContent = fyRangeLabel();
    document.getElementById('kpiFndPct').textContent = fyRangeLabel();
    document.getElementById('kpiCriusTx').textContent = fmt.format(txByLoc['CRIUS']) + ' tx';
    document.getElementById('kpiChirosTx').textContent = fmt.format(txByLoc['CHIROS']) + ' tx';
    document.getElementById('kpiFndTx').textContent = fmt.format(txByLoc['CRIUS FND']) + ' tx';
  } else {
    document.getElementById('statTx').textContent = fmt.format(records.length);
    document.getElementById('statTxSub').textContent = 'across ' + monthCount + ' months';
    document.getElementById('statAvgTx').textContent = money2(records.length ? total / records.length : 0);
    const accountTotals = {}; records.forEach(r => { const k = r.category || 'Uncategorized'; accountTotals[k] = (accountTotals[k] || 0) + r.expenseAmount; });
    document.getElementById('statUniqueAc').textContent = fmt.format(Object.keys(accountTotals).length);
    let topAc = '', topAcVal = 0;
    Object.entries(accountTotals).forEach(([k, v]) => { if (v > topAcVal) { topAcVal = v; topAc = k; } });
    const topAcEl = document.getElementById('statTopAc');
    topAcEl.textContent = topAc ? (topAc.length > 20 ? topAc.slice(0, 18) + '…' : topAc) : '—';
    topAcEl.title = topAc;
    document.getElementById('statTopAcSub').textContent = money(topAcVal) + (total ? ' · ' + pct(topAcVal/total*100) + ' share' : '');
  }
}

function renderContextCard3(total, byLoc) {
  const labelEl = document.getElementById('card3Label'), valueEl = document.getElementById('card3Value'), subEl = document.getElementById('card3Sub'), trendEl = document.getElementById('card3Trend'), card = document.getElementById('card3');
  if (!currentLoc) {
    const fyTotals = {}; records.forEach(r => { const fy = Number(r.financialYear); if (!fy) return; fyTotals[fy] = (fyTotals[fy] || 0) + r.expenseAmount; });
    let topFy = null, topFyVal = 0; Object.entries(fyTotals).forEach(([fy, v]) => { if (v > topFyVal) { topFyVal = v; topFy = fy; } });
    if (topFy === null) { labelEl.textContent = 'Top Financial Year'; valueEl.textContent = '—'; subEl.textContent = 'no data'; trendEl.textContent = '—'; trendEl.className = 'trend flat'; card.className = 'kpi crius'; return; }
    const locTotals = { 'CRIUS': 0, 'CHIROS': 0, 'CRIUS FND': 0 };
    records.forEach(r => { if (Number(r.financialYear) !== Number(topFy)) return; const k = String(r.locationKey || '').toUpperCase(); locTotals[k] = (locTotals[k] || 0) + r.expenseAmount; });
    let topLoc = '', topLocVal = 0; Object.entries(locTotals).forEach(([k, v]) => { if (v > topLocVal) { topLocVal = v; topLoc = k; } });
    const locShare = topFyVal ? (topLocVal / topFyVal * 100) : 0;
    labelEl.textContent = 'Top Financial Year'; valueEl.textContent = 'FY ' + topFy; subEl.textContent = money(topFyVal);
    trendEl.textContent = (COMPANY_NAMES[topLoc] || topLoc || '—') + ' · ' + pct(locShare); trendEl.className = 'trend up';
    card.className = 'kpi ' + (topLoc === 'CRIUS' ? 'crius' : topLoc === 'CHIROS' ? 'chiros' : topLoc === 'CRIUS FND' ? 'fnd' : 'crius');
  } else if (currentFY === 'ALL') {
    const monthTotals = {}; records.forEach(r => { const k = monthKey(r); monthTotals[k] = (monthTotals[k] || 0) + r.expenseAmount; });
    const entries = Object.entries(monthTotals).sort((a,b) => b[1]-a[1]);
    const [peakName, peakVal] = entries[0] || ['—', 0];
    labelEl.textContent = 'Peak Month'; valueEl.textContent = peakName; subEl.textContent = money(peakVal);
    const share = total ? (peakVal / total * 100) : 0;
    trendEl.textContent = pct(share) + ' of ' + (COMPANY_NAMES[currentLoc] || 'total'); trendEl.className = 'trend rose'; card.className = 'kpi rose';
  } else {
    let maxRecord = null; records.forEach(r => { if (!maxRecord || r.expenseAmount > maxRecord.expenseAmount) maxRecord = r; });
    if (!maxRecord) { labelEl.textContent = 'Highest Single Expense'; valueEl.textContent = '—'; subEl.textContent = 'no data'; trendEl.textContent = '—'; trendEl.className = 'trend flat'; card.className = 'kpi rose'; return; }
    labelEl.textContent = 'Highest Single Expense'; valueEl.textContent = money(maxRecord.expenseAmount);
    const acName = maxRecord.category || 'Uncategorized';
    subEl.textContent = acName.length > 20 ? acName.slice(0, 18) + '…' : acName; subEl.title = acName;
    trendEl.textContent = maxRecord.monthYear || '—'; trendEl.className = 'trend rose'; card.className = 'kpi rose';
  }
}

function renderFYBreakdown() {
  const thead = document.getElementById('fyHead'), tbody = document.getElementById('fyBody'), tfoot = document.getElementById('fyFoot'), subEl = document.getElementById('fySub');
  const map = {};
  records.forEach(r => { const fy = Number(r.financialYear); if (!fy) return; if (!map[fy]) map[fy] = { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0, total:0, tx:0, months:{} }; const loc = String(r.locationKey || '').toUpperCase(); map[fy][loc] = (map[fy][loc] || 0) + r.expenseAmount; map[fy].total += r.expenseAmount; map[fy].tx += 1; const mk = monthKey(r); map[fy].months[mk] = (map[fy].months[mk] || 0) + r.expenseAmount; });
  const allYears = Object.keys(map).map(Number);
  const chronoYears = allYears.slice().sort((a, b) => a - b);
  const yoyMap = {};
  chronoYears.forEach((y, i) => { if (i === 0) { yoyMap[y] = null; return; } const prev = map[chronoYears[i - 1]].total; yoyMap[y] = prev > 0 ? ((map[y].total - prev) / prev) * 100 : null; });
  const rows = allYears.map(y => { const d = map[y]; const topMonthEntry = Object.entries(d.months).sort((a, b) => b[1] - a[1])[0] || ['—', 0]; const avg = d.tx ? d.total / d.tx : 0; return { year: y, crius: d['CRIUS'] || 0, chiros: d['CHIROS'] || 0, fnd: d['CRIUS FND'] || 0, total: d.total, tx: d.tx, avg, yoy: yoyMap[y] === null ? -Infinity : yoyMap[y], topMonth: topMonthEntry[0], topMonthVal: topMonthEntry[1] }; });
  rows.sort((a, b) => { const av = a[fySortKey], bv = b[fySortKey]; let cmp = (typeof av === 'string' && typeof bv === 'string') ? av.localeCompare(bv) : (Number(av) || 0) - (Number(bv) || 0); return fySortDir === 'asc' ? cmp : -cmp; });
  const cols = [
    { key: 'year', label: 'Financial Year', num: false },
    { key: 'crius', label: 'Crius', num: true }, { key: 'chiros', label: 'Chiros', num: true }, { key: 'fnd', label: 'Crius FND', num: true },
    { key: 'total', label: 'Total', num: true }, { key: 'tx', label: 'Tx', num: true }, { key: 'avg', label: 'Avg / Tx', num: true },
    { key: 'yoy', label: 'YoY', num: true }, { key: 'topMonth', label: 'Top Month', num: false }
  ];
  thead.innerHTML = cols.map(c => { const isActive = c.key === fySortKey; const cls = isActive ? (fySortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''; const arrow = isActive ? (fySortDir === 'asc' ? '▲' : '▼') : '◇'; const align = c.num ? 'text-end' : ''; return '<th data-fkey="' + c.key + '" class="' + cls + ' ' + align + '">' + c.label + '<span class="sort-arrow">' + arrow + '</span></th>'; }).join('');
  thead.querySelectorAll('th[data-fkey]').forEach(th => { th.addEventListener('click', () => { const key = th.getAttribute('data-fkey'); if (fySortKey === key) fySortDir = fySortDir === 'asc' ? 'desc' : 'asc'; else { fySortKey = key; fySortDir = (key === 'year' || key === 'topMonth') ? 'asc' : 'desc'; } renderFYBreakdown(); }); });
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="text-center py-4" style="color:var(--text-muted)">No data for the selected filters</td></tr>'; tfoot.innerHTML = ''; subEl.textContent = '0 financial years'; return; }
  tbody.innerHTML = rows.map(r => {
    const yoyVal = yoyMap[r.year];
    let yoyCell = '<span class="mom-pill none">—</span>';
    if (yoyVal !== null && isFinite(yoyVal)) { const up = yoyVal >= 0; yoyCell = '<span class="mom-pill ' + (up ? 'up' : 'down') + '">' + (up ? '↑' : '↓') + ' ' + Math.abs(yoyVal).toFixed(1) + '%</span>'; }
    return '<tr>' +
      '<td><span class="fy-cell fy-drill" data-fy-drill="' + r.year + '" data-fy-loc="" style="cursor:pointer" title="Click to view month-wise data for FY ' + r.year + '"><span class="fy-prefix">FY</span>' + r.year + '</span></td>' +
      '<td class="cell-num amt-crius'  + (r.crius  > 0 ? ' fy-drill' : '') + '"' + (r.crius  > 0 ? ' data-fy-drill="' + r.year + '" data-fy-loc="CRIUS"'     : '') + '>' + money(r.crius)  + '</td>' +
      '<td class="cell-num amt-chiros' + (r.chiros > 0 ? ' fy-drill' : '') + '"' + (r.chiros > 0 ? ' data-fy-drill="' + r.year + '" data-fy-loc="CHIROS"'    : '') + '>' + money(r.chiros) + '</td>' +
      '<td class="cell-num amt-fnd'    + (r.fnd    > 0 ? ' fy-drill' : '') + '"' + (r.fnd    > 0 ? ' data-fy-drill="' + r.year + '" data-fy-loc="CRIUS FND"' : '') + '>' + money(r.fnd)    + '</td>' +
      '<td class="cell-num amt-total">' + money(r.total) + '</td>' +
      '<td class="cell-num">' + fmt.format(r.tx) + '</td>' +
      '<td class="cell-num amt-avg">' + money2(r.avg) + '</td>' +
      '<td class="cell-num">' + yoyCell + '</td>' +
      '<td><span class="top-month-cell"><span class="tm-month">' + esc(r.topMonth) + '</span><span class="tm-val">' + money(r.topMonthVal, true) + '</span></span></td></tr>';
  }).join('');
  const t = { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0 };
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandTx    = rows.reduce((s, r) => s + r.tx, 0);
  rows.forEach(r => { t['CRIUS'] += r.crius; t['CHIROS'] += r.chiros; t['CRIUS FND'] += r.fnd; });
  tfoot.innerHTML = '<tr><td>TOTAL</td><td class="cell-num amt-crius">' + money(t['CRIUS']) + '</td><td class="cell-num amt-chiros">' + money(t['CHIROS']) + '</td><td class="cell-num amt-fnd">' + money(t['CRIUS FND']) + '</td><td class="cell-num amt-total">' + money(grandTotal) + '</td><td class="cell-num">' + fmt.format(grandTx) + '</td><td class="cell-num amt-avg">' + money2(grandTx ? grandTotal / grandTx : 0) + '</td><td class="cell-num"></td><td></td></tr>';
  subEl.textContent = rows.length + ' financial year' + (rows.length === 1 ? '' : 's') + ' · ' + money(grandTotal) + ' total · ' + fmt.format(grandTx) + ' transactions · Click any FY to view month-wise · Click a company amount to filter';
  tbody.querySelectorAll('.fy-drill').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); const fy = parseInt(el.getAttribute('data-fy-drill'), 10); const loc = el.getAttribute('data-fy-loc') || ''; openFYDrawer(fy, loc); }); });
}

function buildPivotData(recs) {
  const particularsMap = {}; const fysSet = new Set(); const matrix = {}; const rowTotals = {}; const colTotals = {}; let grandTotal = 0;
  recs.forEach(r => { const part = r.particulars || 'Uncategorized'; const fy = r.financialYear; const amt = r.expenseAmount; if (!fy) return; fysSet.add(fy); particularsMap[part] = (particularsMap[part] || 0) + amt; if (!matrix[fy]) matrix[fy] = {}; if (!matrix[fy][part]) matrix[fy][part] = 0; matrix[fy][part] += amt; if (!rowTotals[fy]) rowTotals[fy] = 0; rowTotals[fy] += amt; if (!colTotals[part]) colTotals[part] = 0; colTotals[part] += amt; grandTotal += amt; });
  const particulars = Object.entries(particularsMap).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }));
  const fys = Array.from(fysSet).sort((a, b) => a - b);
  return { particulars, fys, matrix, rowTotals, colTotals, grandTotal };
}
function applyPivotFilters() {
  const q = document.getElementById('searchBox').value.trim().toLowerCase();
  let filteredRecords = records;
  if (q) filteredRecords = filteredRecords.filter(r => { const fyStr = String(r.financialYear); const partStr = (r.particulars || 'Uncategorized').toLowerCase(); return fyStr.indexOf(q) !== -1 || partStr.indexOf(q) !== -1; });
  const data = buildPivotData(filteredRecords);
  const totalAmt = filteredRecords.reduce((s, r) => s + r.expenseAmount, 0);
  document.getElementById('tableSub').textContent = filteredRecords.length + ' records · ' + money(totalAmt) + ' total · ' + data.fys.length + ' financial years · ' + data.particulars.length + ' particulars · Click a column header to sort · Click any cell to drill into transactions';
  renderPivotTable(data);
}
function renderPivotTable(data) {
  const thead = document.getElementById('pivotHead'), tbody = document.getElementById('pivotBody'), tfoot = document.getElementById('pivotFoot');
  if (!data.fys.length || !data.particulars.length) { thead.innerHTML = ''; tbody.innerHTML = '<tr><td colspan="2" class="text-center py-4" style="color:var(--text-muted)">No matching records</td></tr>'; tfoot.innerHTML = ''; return; }
  let sortedFys = data.fys.slice();
  if (pivotSortParticular === '__total') sortedFys.sort((a, b) => { const cmp = (data.rowTotals[a] || 0) - (data.rowTotals[b] || 0); return pivotSortDir === 'asc' ? cmp : -cmp; });
  else if (pivotSortParticular) sortedFys.sort((a, b) => { const av = (data.matrix[a] && data.matrix[a][pivotSortParticular]) || 0; const bv = (data.matrix[b] && data.matrix[b][pivotSortParticular]) || 0; return pivotSortDir === 'asc' ? av - bv : bv - av; });
  else sortedFys.sort((a, b) => pivotSortDir === 'asc' ? a - b : b - a);
  let headHtml = '<tr>';
  const fyActive = (pivotSortParticular === '');
  const fyCls = fyActive ? (pivotSortDir === 'asc' ? 'sort-asc' : 'sort-desc') : '';
  const fyArrow = fyActive ? (pivotSortDir === 'asc' ? '▲' : '▼') : '◇';
  headHtml += '<th data-pkey="__fy" class="' + fyCls + '" style="min-width:150px; text-align:left; cursor:pointer; position:sticky; left:0; top:0; z-index:30; background:var(--surface-2); box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1);">Financial Year<span class="sort-arrow">' + fyArrow + '</span></th>';
  data.particulars.forEach(p => { const isActive = pivotSortParticular === p.name; const cls = isActive ? (pivotSortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''; const arrow = isActive ? (pivotSortDir === 'asc' ? '▲' : '▼') : '◇'; headHtml += '<th data-pkey="' + esc(p.name) + '" class="' + cls + '" style="text-align:right; min-width:150px; white-space:nowrap;" title="Click to sort by ' + esc(p.name) + '">' + esc(p.name) + '<span class="sort-arrow">' + arrow + '</span></th>'; });
  const totalActive = (pivotSortParticular === '__total');
  headHtml += '<th data-pkey="__total" class="row-total ' + (totalActive ? (pivotSortDir === 'asc' ? 'sort-asc' : 'sort-desc') : '') + '" style="text-align:right; min-width:130px; cursor:pointer; border-left: 2px solid var(--border-strong);">Total<span class="sort-arrow">' + (totalActive ? (pivotSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>';
  headHtml += '</tr>';
  thead.innerHTML = headHtml;
  let bodyHtml = '';
  sortedFys.forEach(fy => { const rowTotal = data.rowTotals[fy]; let rowHtml = '<tr><td style="font-weight:600; text-align:left; position:sticky; left:0; background:var(--surface); z-index:20; box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1);"><span class="fy-cell"><span class="fy-prefix">FY</span>' + fy + '</span></td>'; data.particulars.forEach(p => { const amt = (data.matrix[fy] && data.matrix[fy][p.name]) || 0; if (amt > 0) rowHtml += '<td class="cell-num cell-clickable" data-action="cell" data-fy="' + fy + '" data-particular="' + esc(p.name) + '" title="Click to view ' + esc(p.name) + ' · FY ' + fy + '">' + money(amt) + '</td>'; else rowHtml += '<td class="cell-num" style="color:var(--text-faint);">—</td>'; }); rowHtml += '<td class="cell-num row-total cell-clickable" data-action="row-total" data-fy="' + fy + '" title="Click to view all FY ' + fy + ' transactions">' + money(rowTotal) + '</td></tr>'; bodyHtml += rowHtml; });
  tbody.innerHTML = bodyHtml;
  let footHtml = '<tr><td style="text-align:left; position:sticky; left:0; background:var(--surface-2); z-index:30; box-shadow: 2px 0 5px -2px rgba(0,0,0,0.1);">TOTAL</td>';
  data.particulars.forEach(p => { footHtml += '<td class="cell-num">' + money(data.colTotals[p.name] || 0) + '</td>'; });
  footHtml += '<td class="cell-num row-total" style="border-left: 2px solid var(--border-strong); background:var(--surface-2);">' + money(data.grandTotal) + '</td></tr>';
  tfoot.innerHTML = footHtml;
  thead.querySelectorAll('th[data-pkey]').forEach(th => { th.addEventListener('click', () => { const key = th.getAttribute('data-pkey'); if (key === '__fy') { if (pivotSortParticular === '') pivotSortDir = pivotSortDir === 'asc' ? 'desc' : 'asc'; else { pivotSortParticular = ''; pivotSortDir = 'asc'; } } else if (pivotSortParticular === key) pivotSortDir = pivotSortDir === 'asc' ? 'desc' : 'asc'; else { pivotSortParticular = key; pivotSortDir = 'desc'; } applyPivotFilters(); }); });
}

function openDrawer(mode, monthKeyArg, fyArg, mArg, companyArg) {
  drawerMode = mode || 'ac'; drawerMonthKey = monthKeyArg || ''; monthDrawerPresetCompany = companyArg ? String(companyArg).toUpperCase() : '';
  const drawer = document.getElementById('drawer'), titleEl = document.getElementById('drawerTitle'), searchEl = document.getElementById('drawerSearch'), controls = document.getElementById('drawerControls');
  if (drawerMode === 'month') {
    drawer.classList.add('wide');
    const presetName = monthDrawerPresetCompany ? (COMPANY_NAMES[monthDrawerPresetCompany] || monthDrawerPresetCompany) : '';
    titleEl.textContent = 'Transactions · ' + drawerMonthKey + (presetName ? ' · ' + presetName : ' · All Companies');
    searchEl.placeholder = 'Search particulars, A/C, DESCR…'; searchEl.value = '';
    controls.classList.remove('d-none'); drawer.classList.add('open');
    document.getElementById('drawerBackdrop').classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    const fyNum = parseInt(fyArg, 10), mNum = parseInt(mArg, 10);
    if (isNaN(fyNum) || isNaN(mNum)) { document.getElementById('drawerSub').textContent = 'Error'; document.getElementById('drawerBody').innerHTML = '<p style="text-align:center;padding:60px 20px;color:var(--rose);font-size:13px">Could not determine month/year.</p>'; return; }
    const filtered = allRecords.filter(r => Number(r.financialYear) === fyNum && Number(r.month) === mNum && (!selLoc.size || selLoc.has(String(r.locationKey || '').toUpperCase())));
    monthDrawerRows = filtered.map(r => [r.locationKey, r.particulars, r.category, r.descr, '', r.txnRemark, r.expenseAmount, r.financialYear, r.monthYear]);
    monthDrawerLoc = monthDrawerPresetCompany ? String(monthDrawerPresetCompany).toUpperCase() : (currentLoc ? String(currentLoc).toUpperCase() : '');
    monthDrawerColSort = 'amt'; monthDrawerColDir = 'desc';
    if (!monthDrawerRows.length) { document.getElementById('drawerSub').textContent = '0 records'; document.getElementById('drawerBody').innerHTML = '<div style="text-align:center;padding:60px 20px;font-size:13px;line-height:1.7"><div style="font-size:34px;margin-bottom:14px">📭</div><b style="font-size:14px">No records found for this month.</b></div>'; return; }
    renderMonthDrawer('');
    setTimeout(() => searchEl.focus(), 100);
    return;
  }
  monthDrawerPresetCompany = '';
  controls.classList.add('d-none'); drawer.classList.remove('wide');
  if (drawerMode === 'ac') { titleEl.textContent = 'All Expenses A/C Names'; searchEl.placeholder = 'Search account name…'; }
  else { titleEl.textContent = 'All Particulars'; searchEl.placeholder = 'Search particular…'; }
  searchEl.value = ''; renderDrawer('');
  drawer.classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  setTimeout(() => searchEl.focus(), 240);
}
function openFYDrawer(fy, loc) {
  drawerMode = 'fy_view'; drawerParticularYear = fy; drawerFYCompany = String(loc || '').toUpperCase(); monthDrawerPresetCompany = '';
  const drawer = document.getElementById('drawer'), titleEl = document.getElementById('drawerTitle'), searchEl = document.getElementById('drawerSearch');
  document.getElementById('drawerControls').classList.add('d-none'); drawer.classList.remove('wide');
  const companyLabel = drawerFYCompany ? (COMPANY_NAMES[drawerFYCompany] || drawerFYCompany) : 'All Companies';
  titleEl.textContent = 'Month-wise · FY ' + fy + ' · ' + companyLabel;
  searchEl.placeholder = 'Search month…'; searchEl.value = '';
  document.getElementById('drawerSub').textContent = 'Loading…';
  document.getElementById('drawerBody').innerHTML = '<p style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:13px"><span class="spinner"></span> Preparing month-wise data…</p>';
  drawer.classList.add('open'); document.getElementById('drawerBackdrop').classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
  setTimeout(() => { renderFYDrawer(''); setTimeout(() => searchEl.focus(), 60); }, 40);
}
function renderFYDrawer(query) {
  const q = (query || '').trim().toLowerCase();
  const targetYear = drawerParticularYear, locFilter = drawerFYCompany;
  let fyRecords = records.filter(r => Number(r.financialYear) === targetYear);
  if (locFilter) fyRecords = fyRecords.filter(r => String(r.locationKey || '').toUpperCase() === locFilter);
  if (!fyRecords.length) { document.getElementById('drawerSub').textContent = '0 records'; document.getElementById('drawerBody').innerHTML = '<div style="text-align:center;padding:60px 20px;font-size:13px;line-height:1.7"><div style="font-size:34px;margin-bottom:14px">📭</div><b style="font-size:14px">No data found for this selection.</b></div>'; return; }
  const monthTotals = {}; let yearTotal = 0;
  fyRecords.forEach(r => { const m = Number(r.month); if (!m) return; monthTotals[m] = (monthTotals[m] || 0) + r.expenseAmount; yearTotal += r.expenseAmount; });
  const monthNums = Object.keys(monthTotals).map(Number).sort((a, b) => a - b);
  const visibleMonths = monthNums.filter(m => { if (!q) return true; const label = (MONTH_ABBR[m-1] + ' ' + targetYear).toLowerCase(); return label.indexOf(q) !== -1 || MONTH_ABBR[m-1].toLowerCase().indexOf(q) !== -1; });
  const visibleTotal = visibleMonths.reduce((s, m) => s + monthTotals[m], 0);
  let maxAmt = 1; monthNums.forEach(m => { if (monthTotals[m] > maxAmt) maxAmt = monthTotals[m]; });
  const companyLabel = locFilter ? (COMPANY_NAMES[locFilter] || locFilter) : locScopeText();
  document.getElementById('drawerSub').textContent = monthNums.length + ' month' + (monthNums.length === 1 ? '' : 's') + ' · FY ' + targetYear + ' · ' + companyLabel + ' · ' + fmt.format(fyRecords.length) + ' tx';
  const body = document.getElementById('drawerBody');
  if (!visibleMonths.length) { body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:60px 20px">' + (q ? 'No months match "' + esc(q) + '"' : 'No data available.') + '</p>'; return; }
  let html = '<div class="particular-hero"><div><div class="hero-label">FY ' + targetYear + ' · ' + esc(companyLabel) + '</div><div class="hero-value">' + money(visibleTotal) + '</div></div><div class="hero-badge">📅 ' + visibleMonths.length + ' month' + (visibleMonths.length === 1 ? '' : 's') + '</div></div><div class="drawer-section-header"><span>Month-wise</span><span class="section-total">' + money(visibleTotal) + '</span></div>';
  visibleMonths.forEach(m => { const amt = monthTotals[m]; const barW = (amt / maxAmt) * 100; const share = yearTotal ? (amt / yearTotal * 100) : 0; const mk = MONTH_ABBR[m-1] + ' ' + targetYear; html += '<div class="drawer-month-row" data-fy-drawer-month="' + esc(mk) + '" data-fy-drawer-m="' + m + '" style="cursor:pointer"><div><div class="month-name"><span class="month-badge">' + MONTH_ABBR[m-1] + '</span> ' + mk + '</div><div class="bar"><div style="width:' + barW.toFixed(2) + '%"></div></div></div><div><div class="amt">' + money(amt) + '</div><div class="pct">' + share.toFixed(1) + '%</div></div></div>'; });
  body.innerHTML = html;
  body.querySelectorAll('[data-fy-drawer-month]').forEach(row => { row.addEventListener('click', () => { const mk = row.getAttribute('data-fy-drawer-month'); const m = parseInt(row.getAttribute('data-fy-drawer-m'), 10); const company = locFilter || null; closeDrawer(); setTimeout(() => openDrawer('month', mk, targetYear, m, company), 240); }); });
}
function openParticularDrawer(arg1, arg2) {
  drawerMode = 'particular'; drawerParticular = arg1 || ''; drawerParticularYear = arg2; monthDrawerPresetCompany = '';
  const drawer = document.getElementById('drawer'), titleEl = document.getElementById('drawerTitle'), searchEl = document.getElementById('drawerSearch');
  document.getElementById('drawerControls').classList.add('d-none'); drawer.classList.remove('wide');
  if (drawerParticular) titleEl.textContent = drawerParticular + ' · FY ' + drawerParticularYear; else titleEl.textContent = 'All Particulars · FY ' + drawerParticularYear;
  searchEl.placeholder = 'Search month…'; searchEl.value = '';
  document.getElementById('drawerSub').textContent = 'Loading…';
  document.getElementById('drawerBody').innerHTML = '<p style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:13px"><span class="spinner"></span> Preparing month-wise data…</p>';
  drawer.classList.add('open'); document.getElementById('drawerBackdrop').classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
  setTimeout(() => { renderParticularDrawer(''); setTimeout(() => searchEl.focus(), 60); }, 40);
}
function closeDrawer() {
  const drawer = document.getElementById('drawer');
  drawer.classList.remove('open', 'fullscreen');

  const expandBtn = document.getElementById('drawerExpand');
  if (expandBtn) {
    expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    expandBtn.title = 'Maximize';
  }

  document.getElementById('drawerBackdrop').classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}
function renderDrawer(query) {
  if (drawerMode === 'month') { renderMonthDrawer(query); return; }
  if (drawerMode === 'fy_view') { renderFYDrawer(query); return; }
  if (drawerMode === 'particular') { renderParticularDrawer(query); return; }
  const q = (query || '').trim().toLowerCase();
  const field = drawerMode === 'ac' ? 'category' : 'particulars';
  const totals = {}; let grand = 0;
  records.forEach(r => { const raw = r[field]; const k = (raw && String(raw).trim()) ? String(raw).trim() : 'Uncategorized'; totals[k] = (totals[k] || 0) + r.expenseAmount; grand += r.expenseAmount; });
  const all = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  const filtered = q ? all.filter(([k]) => k.toLowerCase().indexOf(q) !== -1) : all;
  const max = all.length ? all[0][1] : 1;
  const scope  = locScopeText();
  const period = fyScopeText();
  document.getElementById('drawerSub').textContent = all.length + ' unique · ' + scope + ' · ' + period + ' · ' + money(grand) + ' total';
  const body = document.getElementById('drawerBody');
  if (!filtered.length) { body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:32px 0">' + (q ? 'No items match "' + esc(q) + '"' : 'No data for the current selection.') + '</p>'; return; }
  body.innerHTML = filtered.map(([name, val], i) => { const rankCls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''; const barW = max ? (val / max * 100) : 0; const share = grand ? (val / grand * 100) : 0; return '<div class="drawer-row ' + rankCls + '"><div class="rank-num">' + (i+1) + '</div><div><div class="name">' + esc(name) + '</div><div class="bar"><div style="width:' + barW + '%"></div></div></div><div><div class="amt">' + money(val) + '</div><div class="pct">' + share.toFixed(1) + '%</div></div></div>'; }).join('');
}
function renderParticularDrawer(query) {
  const q = (query || '').trim().toLowerCase();
  const targetYear = drawerParticularYear;
  let partRecords = records.filter(r => Number(r.financialYear) === targetYear);
  if (drawerParticular) partRecords = partRecords.filter(r => (r.particulars || 'Uncategorized') === drawerParticular);
  if (!partRecords.length) { document.getElementById('drawerSub').textContent = '0 records'; document.getElementById('drawerBody').innerHTML = '<div style="text-align:center;padding:60px 20px;font-size:13px;line-height:1.7"><div style="font-size:34px;margin-bottom:14px">📭</div><b style="font-size:14px">No data found for FY ' + targetYear + '.</b></div>'; return; }
  const monthTotals = {}; let yearTotal = 0;
  partRecords.forEach(r => { const m = Number(r.month); if (!m) return; monthTotals[m] = (monthTotals[m] || 0) + r.expenseAmount; yearTotal += r.expenseAmount; });
  const monthNums = Object.keys(monthTotals).map(Number).sort((a, b) => a - b);
  const visibleMonths = monthNums.filter(m => { if (!q) return true; const label = (MONTH_ABBR[m-1] + ' ' + targetYear).toLowerCase(); return label.indexOf(q) !== -1 || MONTH_ABBR[m-1].toLowerCase().indexOf(q) !== -1; });
  const visibleTotal = visibleMonths.reduce((s, m) => s + monthTotals[m], 0);
  let maxAmt = 1; monthNums.forEach(m => { if (monthTotals[m] > maxAmt) maxAmt = monthTotals[m]; });
  const scope = locScopeText();
  document.getElementById('drawerSub').textContent = monthNums.length + ' month' + (monthNums.length === 1 ? '' : 's') + ' · FY ' + targetYear + ' · ' + (drawerParticular ? drawerParticular : scope);
  const body = document.getElementById('drawerBody');
  if (!visibleMonths.length) { body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:60px 20px">' + (q ? 'No months match "' + esc(q) + '"' : 'No data available.') + '</p>'; return; }
  let html = '<div class="particular-hero"><div><div class="hero-label">' + (drawerParticular ? drawerParticular + ' · FY ' + targetYear : 'FY ' + targetYear + ' Total') + '</div><div class="hero-value">' + money(visibleTotal) + '</div></div><div class="hero-badge">📅 ' + visibleMonths.length + ' month' + (visibleMonths.length === 1 ? '' : 's') + '</div></div><div class="drawer-section-header"><span>FY ' + targetYear + ' · Month-wise</span><span class="section-total">' + money(visibleTotal) + '</span></div>';
  visibleMonths.forEach(m => { const amt = monthTotals[m]; const barW = (amt / maxAmt) * 100; const share = yearTotal ? (amt / yearTotal * 100) : 0; html += '<div class="drawer-month-row"><div><div class="month-name"><span class="month-badge">' + MONTH_ABBR[m-1] + '</span> ' + MONTH_ABBR[m-1] + ' ' + targetYear + '</div><div class="bar"><div style="width:' + barW.toFixed(2) + '%"></div></div></div><div><div class="amt">' + money(amt) + '</div><div class="pct">' + share.toFixed(1) + '%</div></div></div>'; });
  body.innerHTML = html;
}
function renderMonthDrawer(query) {
  const q = (query || '').trim().toLowerCase();
  const locKey = monthDrawerLoc ? String(monthDrawerLoc).toUpperCase() : '';
  const showAll = !locKey;
  let rows = monthDrawerRows.filter(row => { if (locKey && String(row[0] || '').toUpperCase() !== locKey) return false; if (!q) return true; return String(row.join(' ')).toLowerCase().indexOf(q) !== -1; });
  const col = MONTH_DRAWER_COLS.find(c => c.key === monthDrawerColSort) || MONTH_DRAWER_COLS[5];
  const dir = monthDrawerColDir === 'asc' ? 1 : -1;
  const compareByCol = (a, b) => { const av = a[col.field], bv = b[col.field]; const cmp = col.sortAs === 'str' ? String(av || '').localeCompare(String(bv || '')) : (Number(av) || 0) - (Number(bv) || 0); return cmp * dir; };
  if (monthDrawerColSort === 'loc') rows.sort(compareByCol);
  else if (showAll) rows.sort((a, b) => { const aLoc = String(a[0] || '').toUpperCase(), bLoc = String(b[0] || '').toUpperCase(); const aOrd = COMPANY_ORDER[aLoc] !== undefined ? COMPANY_ORDER[aLoc] : 99; const bOrd = COMPANY_ORDER[bLoc] !== undefined ? COMPANY_ORDER[bLoc] : 99; if (aOrd !== bOrd) return aOrd - bOrd; return compareByCol(a, b); });
  else rows.sort(compareByCol);
  const grand = rows.reduce((s, r) => s + (Number(r[6]) || 0), 0);
  const avgRow = rows.length ? grand / rows.length : 0;
  const isNumCol = col.sortAs === 'num';
  const dirLabel = isNumCol ? (monthDrawerColDir === 'asc' ? 'Low → High' : 'High → Low') : (monthDrawerColDir === 'asc' ? 'A → Z' : 'Z → A');
  const locLabel = monthDrawerLoc ? (COMPANY_NAMES[monthDrawerLoc] || monthDrawerLoc) : 'All Companies';
  document.getElementById('drawerSub').textContent = rows.length + ' records · ' + money(grand) + ' total · ' + locLabel;
  const body = document.getElementById('drawerBody');
  if (!rows.length) { body.innerHTML = '<div style="text-align:center;padding:60px 20px;font-size:13px;line-height:1.7"><div style="font-size:34px;margin-bottom:14px">📭</div><b style="font-size:14px">No records match the current filters.</b><div style="color:var(--text-muted);margin-top:6px">Try a different location or clear the search.</div></div>'; return; }
  const rowHtml = (r) => { const loc = String(r[0] || '').toUpperCase(); const particulars = String(r[1] || ''), acName = String(r[2] || ''), descr = String(r[3] || ''), txnRemark = String(r[5] || ''); const expense = r[6], fy = r[7], monthYear = String(r[8] || ''); let rowCls = ''; if (loc === 'CRIUS') rowCls = 'row-crius'; else if (loc === 'CHIROS') rowCls = 'row-chiros'; else if (loc === 'CRIUS FND') rowCls = 'row-crius-fnd'; return '<tr class="' + rowCls + '"><td>' + pill(loc, showAll) + '</td><td><div class="cell-clamp" title="' + esc(particulars) + '">' + esc(particulars) + '</div></td><td><div class="cell-clamp" title="' + esc(acName) + '">' + esc(acName) + '</div></td><td><div class="cell-clamp" title="' + esc(descr) + '">' + esc(descr) + '</div></td><td><div class="cell-clamp" title="' + esc(txnRemark) + '">' + esc(txnRemark) + '</div></td><td class="amt">' + money2(expense) + '</td><td>' + esc(String(fy || '')) + '</td><td>' + esc(monthYear) + '</td></tr>'; };
  const bodyHtml = rows.map(rowHtml).join('');
  const headHtml = MONTH_DRAWER_COLS.map(c => { const isActive = c.key === monthDrawerColSort; const cls = isActive ? ('d-sort-' + monthDrawerColDir) : ''; const arrow = isActive ? (monthDrawerColDir === 'asc' ? '▲' : '▼') : '◇'; const align = c.num ? ' style="text-align:right"' : ''; return '<th data-dkey="' + c.key + '" class="' + cls + '"' + align + '>' + c.label + '<span class="d-sort-arrow">' + arrow + '</span></th>'; }).join('');
  const chipHtml = showAll ? '◇ Sorted by <b style="color:var(--accent);">' + esc(col.label) + '</b><span class="s-dir">' + dirLabel + '</span>' : '🏢 Showing only <b style="color:var(--accent);">' + esc(COMPANY_NAMES[monthDrawerLoc] || monthDrawerLoc) + '</b><button type="button" class="chip-back-btn" id="monthDrawerBackBtn">← All Companies</button><span class="s-dir">◇ ' + esc(col.label) + ' · ' + dirLabel + '</span>';
  body.innerHTML = '<div class="drawer-summary"><div class="ds-item"><span class="ds-l">Records</span><span class="ds-v">' + fmt.format(rows.length) + '</span></div><div class="ds-item"><span class="ds-l">Total</span><span class="ds-v">' + money(grand) + '</span></div><div class="ds-item"><span class="ds-l">Avg / Row</span><span class="ds-v">' + money(avgRow) + '</span></div></div><div style="padding: 12px 22px 0"><div class="drawer-sort-chip">' + chipHtml + '</div></div><div style="padding: 0 22px 24px;"><table class="drawer-dt"><colgroup><col style="width:8%"><col style="width:15%"><col style="width:14%"><col style="width:24%"><col style="width:15%"><col style="width:11%"><col style="width:7%"><col style="width:6%"></colgroup><thead><tr>' + headHtml + '</tr></thead><tbody>' + bodyHtml + '</tbody><tfoot><tr><td colspan="5" style="text-align:right;padding-right:14px">TOTAL</td><td class="amt">' + money2(grand) + '</td><td colspan="2"></td></tr></tfoot></table></div>';
  body.querySelectorAll('span[data-pill-loc]').forEach(span => { span.addEventListener('click', () => { const loc = span.getAttribute('data-pill-loc'); if (!loc) return; monthDrawerLoc = loc; monthDrawerColSort = 'amt'; monthDrawerColDir = 'desc'; renderMonthDrawer(document.getElementById('drawerSearch').value); }); });
  const backBtn = document.getElementById('monthDrawerBackBtn');
  if (backBtn) backBtn.addEventListener('click', (e) => { e.stopPropagation(); monthDrawerLoc = ''; monthDrawerColSort = 'amt'; monthDrawerColDir = 'desc'; renderMonthDrawer(document.getElementById('drawerSearch').value); });
  body.querySelectorAll('thead th[data-dkey]').forEach(th => { th.addEventListener('click', () => { const key = th.getAttribute('data-dkey'); const c = MONTH_DRAWER_COLS.find(x => x.key === key); if (monthDrawerColSort === key) monthDrawerColDir = monthDrawerColDir === 'asc' ? 'desc' : 'asc'; else { monthDrawerColSort = key; monthDrawerColDir = (c && c.sortAs === 'num') ? 'desc' : 'asc'; } renderMonthDrawer(document.getElementById('drawerSearch').value); }); });
}

function renderMonthlyBreakdown() {
  const thead = document.getElementById('monthlyHead'), tbody = document.getElementById('monthlyBody'), tfoot = document.getElementById('monthlyFoot'), subEl = document.getElementById('monthlySub'), searchEl = document.getElementById('monthSearch');
  const q = (searchEl.value || '').trim().toLowerCase();
  const map = {}; const keyMeta = {};
  records.forEach(r => { const k = monthKey(r); if (!map[k]) map[k] = { 'CRIUS': 0, 'CHIROS': 0, 'CRIUS FND': 0, tx: 0, total: 0 }; if (!keyMeta[k]) keyMeta[k] = { fy: r.financialYear, m: r.month }; const loc = String(r.locationKey || '').toUpperCase(); map[k][loc] = (map[k][loc] || 0) + r.expenseAmount; map[k].tx += 1; map[k].total += r.expenseAmount; });
  const chrono = Object.keys(map).sort(monthKeySort);
  const rows = chrono.map((k, i) => { const prevTotal = i > 0 ? map[chrono[i - 1]].total : 0; const mom = prevTotal > 0 ? ((map[k].total - prevTotal) / prevTotal) * 100 : null; const meta = keyMeta[k] || { fy: null, m: null }; return Object.assign({ month: k, mom, fy: meta.fy, m: meta.m }, map[k]); });
  let filtered = q ? rows.filter(r => r.month.toLowerCase().indexOf(q) !== -1) : rows;
  filtered = filtered.slice().sort((a, b) => { if (monthSortKey === 'month') { const cmp = monthKeySort(a.month, b.month); return monthSortDir === 'asc' ? cmp : -cmp; } const av = Number(a[monthSortKey]) || 0, bv = Number(b[monthSortKey]) || 0; return monthSortDir === 'asc' ? av - bv : bv - av; });
  const showCompanies = !currentLoc;
  const cols = [{ key: 'month', label: 'Month' }];
  if (showCompanies) { cols.push({ key: 'CRIUS', label: 'Crius', num: true }); cols.push({ key: 'CHIROS', label: 'Chiros', num: true }); cols.push({ key: 'CRIUS FND', label: 'Crius FND', num: true }); }
  cols.push({ key: 'total', label: 'Total', num: true }, { key: 'tx', label: 'Tx', num: true }, { key: 'mom', label: 'MoM', num: true });
  thead.innerHTML = cols.map(c => { const isActive = c.key === monthSortKey; const cls = isActive ? (monthSortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''; const arrow = isActive ? (monthSortDir === 'asc' ? '▲' : '▼') : '◇'; const align = c.num ? 'text-end' : ''; return '<th data-mkey="' + c.key + '" class="' + cls + ' ' + align + '">' + c.label + '<span class="sort-arrow">' + arrow + '</span></th>'; }).join('');
  thead.querySelectorAll('th[data-mkey]').forEach(th => { th.addEventListener('click', () => { const key = th.getAttribute('data-mkey'); if (monthSortKey === key) monthSortDir = monthSortDir === 'asc' ? 'desc' : 'asc'; else { monthSortKey = key; monthSortDir = 'desc'; } renderMonthlyBreakdown(); }); });
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="' + cols.length + '" class="text-center py-4" style="color:var(--text-muted)">No matching months</td></tr>'; tfoot.innerHTML = ''; subEl.textContent = '0 months'; return; }
  function companyCell(loc, amt, cls) { if (!(amt > 0)) return '<td class="cell-num ' + cls + ' company-cell company-cell-zero">' + money(amt) + '</td>'; return '<td class="cell-num ' + cls + ' company-cell" data-loc="' + loc + '" title="View only ' + esc(COMPANY_NAMES[loc] || loc) + ' for this month">' + money(amt) + '</td>'; }
  tbody.innerHTML = filtered.map(r => { const cells = []; cells.push('<td><span class="month-cell"><span class="month-dot"></span>' + esc(r.month) + '</span></td>'); if (showCompanies) { cells.push(companyCell('CRIUS', r['CRIUS'] || 0, 'amt-crius')); cells.push(companyCell('CHIROS', r['CHIROS'] || 0, 'amt-chiros')); cells.push(companyCell('CRIUS FND', r['CRIUS FND'] || 0, 'amt-fnd')); } cells.push('<td class="cell-num amt-total total-cell" title="Click to open month drawer (all companies)">' + money(r.total) + '</td>'); cells.push('<td class="cell-num">' + fmt.format(r.tx) + '</td>'); if (r.mom === null || !isFinite(r.mom)) cells.push('<td class="cell-num"><span class="mom-pill none">—</span></td>'); else { const up = r.mom >= 0; cells.push('<td class="cell-num"><span class="mom-pill ' + (up ? 'up' : 'down') + '">' + (up ? '↑' : '↓') + ' ' + Math.abs(r.mom).toFixed(1) + '%</span></td>'); } return '<tr data-month="' + esc(r.month) + '" data-fy="' + (r.fy || '') + '" data-m="' + (r.m || '') + '">' + cells.join('') + '</tr>'; }).join('');
  const totals = { 'CRIUS': 0, 'CHIROS': 0, 'CRIUS FND': 0, total: 0, tx: 0 };
  filtered.forEach(r => { totals['CRIUS'] += r['CRIUS'] || 0; totals['CHIROS'] += r['CHIROS'] || 0; totals['CRIUS FND'] += r['CRIUS FND'] || 0; totals.total += r.total; totals.tx += r.tx; });
  const foot = ['<td>TOTAL</td>'];
  if (showCompanies) { foot.push('<td class="cell-num amt-crius">' + money(totals['CRIUS']) + '</td>'); foot.push('<td class="cell-num amt-chiros">' + money(totals['CHIROS']) + '</td>'); foot.push('<td class="cell-num amt-fnd">' + money(totals['CRIUS FND']) + '</td>'); }
  foot.push('<td class="cell-num amt-total">' + money(totals.total) + '</td>');
  foot.push('<td class="cell-num">' + fmt.format(totals.tx) + '</td>');
  foot.push('<td></td>');
  tfoot.innerHTML = '<tr>' + foot.join('') + '</tr>';
  subEl.textContent = filtered.length + ' months · ' + money(totals.total) + ' total · Click a Total or a company amount to open the drawer · Sort by any column header';
}

let currentTab = 'dashboard';

function getDashMain() { return document.querySelector('main.page:not(#reportPage)'); }
function switchTab(tab) {
  tab = (tab === 'report') ? 'report' : 'dashboard';
  currentTab = tab;
  const dash = getDashMain(); const rep = document.getElementById('reportPage');
  if (!dash || !rep) return;
  if (tab === 'report') { dash.classList.add('d-none'); rep.classList.remove('d-none'); renderReport(); }
  else { rep.classList.add('d-none'); dash.classList.remove('d-none'); }
  document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  ['fyField', 'locField', 'resetBtn'].forEach(function (id) { const el = document.getElementById(id); if (el) el.style.display = (tab === 'report') ? 'none' : ''; });
  ['rptFyField', 'rptLocField', 'rptResetBtn'].forEach(function (id) { const el = document.getElementById(id); if (el) el.style.display = (tab === 'report') ? '' : 'none'; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderReport() {
  const rep = document.getElementById('reportPage');
  if (!rep || !rep.classList.contains('page')) return;
  const base = getReportRecords(false);
  const filtered = getReportRecords(true);
  renderReportFilterUI();
  renderInsights(filtered);
  renderExpenseAnalysisTable(filtered);
  // Keep all account groups visible in the selector; the expense table uses the filtered records.
  renderUnifiedComparison(base);
  renderSavingsSection(filtered);
  renderReviewSection(filtered);
  updateExpSelUI();
}

function genPlaceholderHtml(kind, icon, title, desc, label) {
  return '<div class="gen-box"><div class="gen-ico">' + icon + '</div><div class="gen-title">' + title + '</div><div class="gen-desc">' + desc + '</div>' +
         '<button type="button" class="btn-apply gen-btn" data-gen="' + kind + '">✨ ' + label + '</button></div>';
}
function renderSavingsSection(recs) {
  const grid = document.getElementById('rptSavingsGrid'), sub = document.getElementById('rptSavingsSub');
  if (!grid) return;
  if (!savingsGenerated) {
    grid.innerHTML = genPlaceholderHtml('savings', '💡', 'Savings plan not generated yet', 'Builds detailed, actionable savings plans from the current selection (' + fmt.format(recs.length) + ' transactions in scope).', 'Generate savings plan');
    if (sub) sub.textContent = 'Press Generate to analyse the current selection';
    return;
  }
  renderSavingsOpportunities(recs);
}
function renderReviewSection(recs) {
  const list = document.getElementById('rptYearReviewList'), sub = document.getElementById('rptYearReviewSub');
  if (!list) return;
  if (!reviewGenerated) {
    list.innerHTML = genPlaceholderHtml('review', '🔎', 'Yearly review not generated yet', 'Scans the current selection (' + fmt.format(recs.length) + ' transactions) for variances, spikes and documentation gaps, with an action plan for each.', 'Generate yearly review');
    if (sub) sub.textContent = 'Press Generate to run the review on the current selection';
    return;
  }
  renderYearlyReview(recs);
}

function renderInsights(recs) {
  const ul = document.getElementById('insightList');
  if (!ul) return;
  if (!recs || !recs.length) { ul.innerHTML = '<div class="insight-fact"><div class="insight-fact-icon">📭</div><div class="insight-fact-body"><div class="insight-fact-label">No data</div><div class="insight-fact-value">No records match the selected years.</div></div></div>'; return; }
  const total = recs.reduce((s, r) => s + r.expenseAmount, 0);
  const tx = recs.length;
  const cards = [];
  cards.push({ cls: 'if-total', icon: '💰', label: 'Total spend', value: money(total) + '<span class="if-sub">' + fmt.format(tx) + ' transactions</span>' });
  cards.push({ cls: 'if-avg', icon: '⌀', label: 'Average per entry', value: money(tx ? total / tx : 0) + '<span class="if-sub">across all entries</span>' });
  const mMap = {}; recs.forEach(r => { const k = monthKey(r); mMap[k] = (mMap[k] || 0) + r.expenseAmount; });
  const mKeys = Object.keys(mMap).sort(monthKeySort);
  if (mKeys.length) { const peak = mKeys.slice().sort((a, b) => mMap[b] - mMap[a])[0]; cards.push({ cls: 'if-peak', icon: '📈', label: 'Peak month', value: esc(peak) + '<span class="if-sub">' + money(mMap[peak]) + ' · ' + pct(total ? mMap[peak] / total * 100 : 0) + ' of total</span>' }); }
  const aMap = {}; recs.forEach(r => { const k = r.category || 'Uncategorized'; aMap[k] = (aMap[k] || 0) + r.expenseAmount; });
  const acctSorted = Object.entries(aMap).sort((a, b) => b[1] - a[1]);
  if (acctSorted.length) cards.push({ cls: 'if-top', icon: '🏆', label: 'Top account', value: esc(acctSorted[0][0]) + '<span class="if-sub">' + money(acctSorted[0][1]) + ' · ' + pct(total ? acctSorted[0][1] / total * 100 : 0) + ' of total</span>' });
  const FLAG = /advance|cash|adjust|revers|refund|urgent|temp/i;
  let flagged = 0, blank = 0;
  recs.forEach(r => { const txt = ((r.descr || '') + ' ' + (r.txnRemark || '')).trim(); if (!txt) blank++; else if (FLAG.test(txt)) flagged++; });
  cards.push({ cls: 'if-quality', icon: '🔍', label: 'Data quality', value: pct(tx ? blank / tx * 100 : 0) + ' missing remarks' + '<span class="if-sub">' + fmt.format(flagged) + ' entries contain flag words</span>' });
  ul.innerHTML = cards.map(c => '<div class="insight-fact ' + c.cls + '"><div class="insight-fact-icon">' + c.icon + '</div><div class="insight-fact-body"><div class="insight-fact-label">' + c.label + '</div><div class="insight-fact-value">' + c.value + '</div></div></div>').join('');
}

function renderExpenseAnalysisTable(recs) {
  const tbl = document.getElementById('expAnalysisTable');
  const subEl = document.getElementById('expTableSub');
  if (!tbl) return;
  if (!recs || !recs.length) { tbl.innerHTML = '<tbody><tr><td style="padding:40px;text-align:center;color:var(--text-muted)">No data for the selected years.</td></tr></tbody>'; if (subEl) subEl.textContent = 'No data in scope.'; return; }
  const monthSet = {};
  recs.forEach(r => { const k = monthKey(r); if (k === 'Unknown') return; monthSet[k] = true; });
  const months = Object.keys(monthSet).sort(monthKeySort);
  const groups = {};
  recs.forEach(r => {
    const rawGroup = (r.particulars || 'Uncategorized').trim();
    const isGenericExpense = /^(?:consumables?|expenses?\s*(?:\(\s*(?:direct|indirect)\s*\)|-?\s*(?:direct|indirect))?|(?:direct|indirect)\s+expenses?|(?:direct|indirect)\s+exp)$/i.test(rawGroup);
    const g = getExpenseTypeName(r);
    const a = isGenericExpense ? null : (r.category || 'Uncategorized');
    const m = monthKey(r);
    if (!groups[g]) groups[g] = { total: 0, accounts: {}, byMonth: {} };
    if (a) {
      if (!groups[g].accounts[a]) groups[g].accounts[a] = { total: 0, byMonth: {} };
      groups[g].accounts[a].byMonth[m] = (groups[g].accounts[a].byMonth[m] || 0) + r.expenseAmount;
      groups[g].accounts[a].total += r.expenseAmount;
    }
    groups[g].byMonth[m] = (groups[g].byMonth[m] || 0) + r.expenseAmount;
    groups[g].total += r.expenseAmount;
  });
  function changeFor(byMonth, mIdx) { if (mIdx === 0) return null; const prev = byMonth[months[mIdx - 1]] || 0; const cur = byMonth[months[mIdx]] || 0; if (prev <= 0 && cur > 0) return Infinity; if (prev <= 0 && cur <= 0) return null; return ((cur - prev) / prev) * 100; }
  let groupArr = Object.entries(groups).map(([name, data]) => ({ name, data }));
  const sortKey = expSortKey;
  if (sortKey === 'type') groupArr.sort((a, b) => { const cmp = a.name.localeCompare(b.name); return expSortDir === 'asc' ? cmp : -cmp; });
  else if (sortKey === 'total') groupArr.sort((a, b) => expSortDir === 'asc' ? a.data.total - b.data.total : b.data.total - a.data.total);
  else {
    const [monthLabel, field] = sortKey.split('|');
    const mIdx = months.indexOf(monthLabel);
    if (mIdx === -1) groupArr.sort((a, b) => b.data.total - a.data.total);
    else groupArr.sort((a, b) => { let va, vb; if (field === 'chg') { va = changeFor(a.data.byMonth, mIdx); vb = changeFor(b.data.byMonth, mIdx); if (va === null && vb === null) return 0; if (va === null) return 1; if (vb === null) return -1; } else { va = a.data.byMonth[monthLabel] || 0; vb = b.data.byMonth[monthLabel] || 0; } const cmp = va - vb; return expSortDir === 'asc' ? cmp : -cmp; });
  }
  const grandByMonth = {};
  months.forEach(m => { let sum = 0; groupArr.forEach(g => { sum += g.data.byMonth[m] || 0; }); grandByMonth[m] = sum; });
  const grandTotal = months.reduce((s, m) => s + grandByMonth[m], 0);
  const typeActive = expSortKey === 'type';
  const typeCls = 'sortable' + (typeActive ? ' sort-active' : '');
  const typeArrow = typeActive ? (expSortDir === 'asc' ? '▲' : '▼') : '◇';
  const totalActive = expSortKey === 'total';
  const totalCls = 'sortable' + (totalActive ? ' sort-active' : '');
  const totalArrow = totalActive ? (expSortDir === 'asc' ? '▲' : '▼') : '◇';
  let head1 = '<thead><tr>';
  head1 += '<th rowspan="2" class="exp-type-col ' + typeCls + '" data-exp-type="1" style="vertical-align:bottom;"><span class="exp-type-label">Expense Type</span><span class="exp-sort-arrow">' + typeArrow + '</span></th>';
  months.forEach(m => { head1 += '<th colspan="2" class="month-group-head">' + esc(m) + '</th>'; });
  head1 += '<th rowspan="2" class="' + totalCls + '" data-exp-total="1" style="vertical-align:bottom; min-width:120px;">Total<span class="exp-sort-arrow">' + totalArrow + '</span></th>';
  head1 += '</tr><tr>';
  months.forEach(m => {
    const amtKey = m + '|amt'; const chgKey = m + '|chg';
    const amtActive = (expSortKey === amtKey); const chgActive = (expSortKey === chgKey);
    const amtCls = 'sortable' + (amtActive ? ' sort-active' : ''); const chgCls = 'sortable' + (chgActive ? ' sort-active' : '');
    const amtArrow = amtActive ? (expSortDir === 'asc' ? '▲' : '▼') : '◇'; const chgArrow = chgActive ? (expSortDir === 'asc' ? '▲' : '▼') : '◇';
    head1 += '<th class="' + amtCls + '" data-exp-month="' + esc(m) + '" data-exp-field="amt">Amount<span class="exp-sort-arrow">' + amtArrow + '</span></th>';
    head1 += '<th class="' + chgCls + '" data-exp-month="' + esc(m) + '" data-exp-field="chg">% Change<span class="exp-sort-arrow">' + chgArrow + '</span></th>';
  });
  head1 += '</tr></thead>';
  function renderAmtChg(amt, prevAmt) {
    const amtStr = amt > 0 ? fmt.format(Math.round(amt)) : '';
    let chgHtml = '';
    if (prevAmt === null) chgHtml = '<span class="chg chg-none">—</span>';
    else if (prevAmt <= 0 && amt > 0) chgHtml = '<span class="chg chg-new">NEW</span>';
    else if (prevAmt > 0 && amt === 0) chgHtml = '<span class="chg chg-down">-100.00%</span>';
    else if (prevAmt > 0) { const chg = ((amt - prevAmt) / prevAmt) * 100; const cls = chg >= 0 ? 'chg-up' : 'chg-down'; const arrow = chg >= 0 ? '+' : ''; chgHtml = '<span class="chg ' + cls + '">' + arrow + chg.toFixed(2) + '%</span>'; }
    else chgHtml = '<span class="chg chg-none">—</span>';
    return '<td class="col-amount">' + amtStr + '</td><td class="col-change">' + chgHtml + '</td>';
  }
  const hasApplied = reportGroups.size > 0 || reportAccts.size > 0;
  function selClass(kind, key, groupName, acctNames) {
    let c = '';
    if ((kind === 'g' ? pendingGroups : pendingAccts).has(key)) c += ' row-sel';
    if (hasApplied) {
      const match = kind === 'g'
        ? (reportGroups.has(key) || acctNames.some(a => reportAccts.has(a)))
        : (reportAccts.has(key) || reportGroups.has(groupName));
      if (!match) c += ' row-dim';
    }
    return c;
  }
  let bodyHtml = '<tbody>';
  groupArr.forEach(({ name, data }, gi) => {
    bodyHtml += '<tr class="group-row' + selClass('g', name, name, Object.keys(data.accounts)) + '" data-group="' + gi + '" data-sel-kind="g" data-sel-key="' + esc(name) + '">';
    bodyHtml += '<td class="exp-type-col"><span class="sel-box"></span>' + esc(name) + '</td>';
    months.forEach((m, idx) => { const amt = data.byMonth[m] || 0; const prevAmt = idx > 0 ? (data.byMonth[months[idx - 1]] || 0) : null; bodyHtml += renderAmtChg(amt, prevAmt); });
    bodyHtml += '<td class="col-amount" style="font-weight:800;color:var(--accent)">' + money(data.total) + '</td>';
    bodyHtml += '</tr>';
    const sortedAccounts = Object.entries(data.accounts).sort((a, b) => b[1].total - a[1].total);
    sortedAccounts.forEach(([acctName, acctData]) => {
      bodyHtml += '<tr class="acct-row' + selClass('a', acctName, name, null) + '" data-group-parent="' + gi + '" data-sel-kind="a" data-sel-key="' + esc(acctName) + '">';
      bodyHtml += '<td class="exp-type-col"><span class="sel-box"></span>' + esc(acctName) + '</td>';
      months.forEach((m, idx) => { const amt = acctData.byMonth[m] || 0; const prevAmt = idx > 0 ? (acctData.byMonth[months[idx - 1]] || 0) : null; bodyHtml += renderAmtChg(amt, prevAmt); });
      bodyHtml += '<td class="col-amount">' + money(acctData.total) + '</td>';
      bodyHtml += '</tr>';
    });
  });
  bodyHtml += '<tr class="total-row"><td class="exp-type-col">TOTAL</td>';
  months.forEach((m, idx) => { const amt = grandByMonth[m]; const prevAmt = idx > 0 ? grandByMonth[months[idx - 1]] : null; bodyHtml += renderAmtChg(amt, prevAmt); });
  bodyHtml += '<td class="col-amount" style="font-weight:800;color:var(--accent)">' + money(grandTotal) + '</td>';
  bodyHtml += '</tr></tbody>';
  tbl.innerHTML = head1 + bodyHtml;
  if (subEl) { let sortLabel; if (expSortKey === 'type') sortLabel = 'Sorted by <b>Expense Type</b> (' + (expSortDir === 'asc' ? 'A → Z' : 'Z → A') + ')'; else if (expSortKey === 'total') sortLabel = 'Sorted by <b>Grand Total</b> (' + (expSortDir === 'asc' ? 'low → high' : 'high → low') + ')'; else { const [m, f] = expSortKey.split('|'); sortLabel = 'Sorted by <b>' + esc(m) + ' ' + (f === 'amt' ? 'Amount' : '% Change') + '</b> (' + (expSortDir === 'asc' ? 'asc' : 'desc') + ')'; } subEl.innerHTML = months.length + ' month' + (months.length === 1 ? '' : 's') + ' · ' + groupArr.length + ' expense group' + (groupArr.length === 1 ? '' : 's') + ' · ' + money(grandTotal) + ' total · ' + sortLabel + ' · Click headers to sort · Click a checkbox to select an expense type, then press <b>Apply selection</b>'; }
  const typeHeader = tbl.querySelector('thead th[data-exp-type]'); if (typeHeader) typeHeader.addEventListener('click', () => { if (expSortKey === 'type') expSortDir = expSortDir === 'asc' ? 'desc' : 'asc'; else { expSortKey = 'type'; expSortDir = 'asc'; } renderExpenseAnalysisTable(recs); });
  const totalHeader = tbl.querySelector('thead th[data-exp-total]'); if (totalHeader) totalHeader.addEventListener('click', () => { if (expSortKey === 'total') expSortDir = expSortDir === 'asc' ? 'desc' : 'asc'; else { expSortKey = 'total'; expSortDir = 'desc'; } renderExpenseAnalysisTable(recs); });
  tbl.querySelectorAll('thead th[data-exp-month]').forEach(th => { th.addEventListener('click', () => { const m = th.getAttribute('data-exp-month'), f = th.getAttribute('data-exp-field'), key = m + '|' + f; if (expSortKey === key) expSortDir = expSortDir === 'asc' ? 'desc' : 'asc'; else { expSortKey = key; expSortDir = 'desc'; } renderExpenseAnalysisTable(recs); }); });
  tbl.querySelectorAll('tr[data-sel-kind]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      const kind = tr.getAttribute('data-sel-kind'), key = tr.getAttribute('data-sel-key');

      if (!e.target.closest('.sel-box')) return;

      const set = kind === 'g' ? pendingGroups : pendingAccts;
      if (set.has(key)) set.delete(key); else set.add(key);
      refreshExpSelClasses();
      updateExpSelUI();
    });
  });
}

function renderUnifiedComparison(recs) {
  const head = document.getElementById('rptUnifiedHead'), body = document.getElementById('rptUnifiedBody'), foot = document.getElementById('rptUnifiedFoot'), sub = document.getElementById('rptUnifiedSub');
  if (!head || !body) return;
  const yearsInScope = reportYears.slice().sort((a, b) => a - b);
  if (!yearsInScope.length || !recs.length) { head.innerHTML = ''; body.innerHTML = '<tr><td style="text-align:center;padding:40px;color:var(--text-muted)">No data for the current selection.</td></tr>'; if (foot) foot.innerHTML = ''; if (sub) sub.textContent = 'No years selected.'; return; }
  const acctMap = {};
  recs.forEach(r => {
    const y = Number(r.financialYear); if (!y) return;
    const g = r.category || 'Uncategorized';
    const lk = String(r.locationKey || '').toUpperCase();
    if (!acctMap[g]) acctMap[g] = { name: g, fyTotals: {}, locTotals: { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0 }, total: 0 };
    acctMap[g].fyTotals[y] = (acctMap[g].fyTotals[y] || 0) + r.expenseAmount;
    if (lk) acctMap[g].locTotals[lk] = (acctMap[g].locTotals[lk] || 0) + r.expenseAmount;
    acctMap[g].total += r.expenseAmount;
  });
  let rows = Object.values(acctMap).map(a => ({ name: a.name, fyTotals: a.fyTotals, locTotals: a.locTotals, total: a.total, growth: (() => { if (yearsInScope.length < 2) return null; const first = a.fyTotals[yearsInScope[0]] || 0; const last  = a.fyTotals[yearsInScope[yearsInScope.length - 1]] || 0; if (first <= 0) return null; return ((last - first) / first) * 100; })() }));
  const key = rptUnifiedSortKey;
  rows.sort((a, b) => {
    let av, bv;
    if (key === 'name') { av = a.name; bv = b.name; }
    else if (key === 'total') { av = a.total; bv = b.total; }
    else if (key === 'growth') { av = a.growth === null ? -Infinity : a.growth; bv = b.growth === null ? -Infinity : b.growth; }
    else if (key === 'crius') { av = a.locTotals['CRIUS'] || 0; bv = b.locTotals['CRIUS'] || 0; }
    else if (key === 'chiros') { av = a.locTotals['CHIROS'] || 0; bv = b.locTotals['CHIROS'] || 0; }
    else if (key === 'fnd') { av = a.locTotals['CRIUS FND'] || 0; bv = b.locTotals['CRIUS FND'] || 0; }
    else if (key.indexOf('fy') === 0) { const y = parseInt(key.slice(2), 10); av = a.fyTotals[y] || 0; bv = b.fyTotals[y] || 0; }
    else { av = a.total; bv = b.total; }
    const cmp = (typeof av === 'string' && typeof bv === 'string') ? av.localeCompare(bv) : (Number(av) || 0) - (Number(bv) || 0);
    return rptUnifiedSortDir === 'asc' ? cmp : -cmp;
  });
  head.innerHTML = '<tr>' +
    '<th data-ukey="name" class="sortable' + (rptUnifiedSortKey === 'name' ? ' sort-active' : '') + '">Account Group<span class="rpt-sort-arrow">' + (rptUnifiedSortKey === 'name' ? (rptUnifiedSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>' +
    yearsInScope.map(y => { const k = 'fy' + y; const active = rptUnifiedSortKey === k; return '<th data-ukey="' + k + '" class="sortable' + (active ? ' sort-active' : '') + '" style="text-align:right">FY ' + y + '<span class="rpt-sort-arrow">' + (active ? (rptUnifiedSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>'; }).join('') +
    '<th data-ukey="total" class="sortable' + (rptUnifiedSortKey === 'total' ? ' sort-active' : '') + '" style="text-align:right">Total<span class="rpt-sort-arrow">' + (rptUnifiedSortKey === 'total' ? (rptUnifiedSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>' +
    '<th data-ukey="growth" class="sortable' + (rptUnifiedSortKey === 'growth' ? ' sort-active' : '') + '" style="text-align:right">Growth %<span class="rpt-sort-arrow">' + (rptUnifiedSortKey === 'growth' ? (rptUnifiedSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>' +
    '<th data-ukey="crius" class="sortable' + (rptUnifiedSortKey === 'crius' ? ' sort-active' : '') + '" style="text-align:right; color:' + COMPANY_COLORS.CRIUS + '">Crius<span class="rpt-sort-arrow">' + (rptUnifiedSortKey === 'crius' ? (rptUnifiedSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>' +
    '<th data-ukey="chiros" class="sortable' + (rptUnifiedSortKey === 'chiros' ? ' sort-active' : '') + '" style="text-align:right; color:' + COMPANY_COLORS.CHIROS + '">Chiros<span class="rpt-sort-arrow">' + (rptUnifiedSortKey === 'chiros' ? (rptUnifiedSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>' +
    '<th data-ukey="fnd" class="sortable' + (rptUnifiedSortKey === 'fnd' ? ' sort-active' : '') + '" style="text-align:right; color:' + COMPANY_COLORS['CRIUS FND'] + '">Crius FND<span class="rpt-sort-arrow">' + (rptUnifiedSortKey === 'fnd' ? (rptUnifiedSortDir === 'asc' ? '▲' : '▼') : '◇') + '</span></th>' +
  '</tr>';
  const selectedUnifiedAccount = reportAccts.size === 1 ? Array.from(reportAccts)[0] : null;
  const hasUnifiedSelection = !!selectedUnifiedAccount;
  body.innerHTML = rows.map(r => {
    const isSelected = selectedUnifiedAccount === r.name;
    const rowClass = hasUnifiedSelection ? (isSelected ? ' class="unified-selected"' : ' class="unified-dim"') : '';
    const growthHtml = (r.growth === null || !isFinite(r.growth)) ? '<span style="color:var(--text-faint)">—</span>' : '<span style="color:' + (r.growth >= 0 ? 'var(--rose)' : 'var(--emerald)') + '; font-weight:700">' + (r.growth >= 0 ? '▲' : '▼') + ' ' + Math.abs(r.growth).toFixed(1) + '%</span>';
    return '<tr' + rowClass + ' data-unified-account="' + esc(r.name) + '" tabindex="0" role="button" aria-pressed="' + isSelected + '" title="Select ' + esc(r.name) + ' to show its monthly details">' +
      '<td><div class="clamp unified-account-name" title="' + esc(r.name) + '">' + (isSelected ? '<span class="unified-check">✓</span>' : '<span class="unified-dot"></span>') + esc(r.name) + '</div></td>' +
      yearsInScope.map(y => { const v = r.fyTotals[y] || 0; return '<td class="cell-num">' + (v > 0 ? money(v) : '<span style="color:var(--text-faint)">—</span>') + '</td>'; }).join('') +
      '<td class="cell-num" style="font-weight:800;color:var(--accent)">' + money(r.total) + '</td>' +
      '<td class="cell-num">' + growthHtml + '</td>' +
      '<td class="cell-num" style="color:' + COMPANY_COLORS.CRIUS + '">' + (r.locTotals['CRIUS'] > 0 ? money(r.locTotals['CRIUS']) : '<span style="color:var(--text-faint)">—</span>') + '</td>' +
      '<td class="cell-num" style="color:' + COMPANY_COLORS.CHIROS + '">' + (r.locTotals['CHIROS'] > 0 ? money(r.locTotals['CHIROS']) : '<span style="color:var(--text-faint)">—</span>') + '</td>' +
      '<td class="cell-num" style="color:' + COMPANY_COLORS['CRIUS FND'] + '">' + (r.locTotals['CRIUS FND'] > 0 ? money(r.locTotals['CRIUS FND']) : '<span style="color:var(--text-faint)">—</span>') + '</td>' +
    '</tr>';
  }).join('');
  const yearTotals = yearsInScope.map(y => rows.reduce((s, r) => s + (r.fyTotals[y] || 0), 0));
  const grandTotal = yearTotals.reduce((s, v) => s + v, 0);
  const locTotals = { 'CRIUS':0, 'CHIROS':0, 'CRIUS FND':0 };
  rows.forEach(r => { locTotals['CRIUS'] += r.locTotals['CRIUS'] || 0; locTotals['CHIROS'] += r.locTotals['CHIROS'] || 0; locTotals['CRIUS FND'] += r.locTotals['CRIUS FND'] || 0; });
  let growthFoot = '—';
  if (yearsInScope.length >= 2) { const first = yearTotals[0] || 0; const last = yearTotals[yearTotals.length - 1] || 0; if (first > 0) { const g = ((last - first) / first) * 100; growthFoot = '<span style="color:' + (g >= 0 ? 'var(--rose)' : 'var(--emerald)') + ';font-weight:700">' + (g >= 0 ? '▲' : '▼') + ' ' + Math.abs(g).toFixed(1) + '%</span>'; } }
  if (foot) foot.innerHTML = '<tr><td style="font-weight:800">TOTAL</td>' + yearTotals.map(v => '<td class="cell-num" style="font-weight:800">' + money(v) + '</td>').join('') + '<td class="cell-num" style="font-weight:800;color:var(--accent)">' + money(grandTotal) + '</td><td class="cell-num">' + growthFoot + '</td><td class="cell-num" style="color:' + COMPANY_COLORS.CRIUS + ';font-weight:800">' + money(locTotals['CRIUS']) + '</td><td class="cell-num" style="color:' + COMPANY_COLORS.CHIROS + ';font-weight:800">' + money(locTotals['CHIROS']) + '</td><td class="cell-num" style="color:' + COMPANY_COLORS['CRIUS FND'] + ';font-weight:800">' + money(locTotals['CRIUS FND']) + '</td></tr>';
  if (sub) sub.textContent = rows.length + ' account group' + (rows.length === 1 ? '' : 's') + ' · ' + yearsInScope.length + ' year' + (yearsInScope.length === 1 ? '' : 's') + ' (' + yearsInScope.map(y => 'FY ' + y).join(', ') + ') · ' + money(grandTotal) + ' total in scope · Click any header to sort';
  head.querySelectorAll('th[data-ukey]').forEach(th => { th.addEventListener('click', () => { const k = th.getAttribute('data-ukey'); if (rptUnifiedSortKey === k) rptUnifiedSortDir = rptUnifiedSortDir === 'asc' ? 'desc' : 'asc'; else { rptUnifiedSortKey = k; rptUnifiedSortDir = (k === 'name') ? 'asc' : 'desc'; } renderUnifiedComparison(recs); }); });
  function selectUnifiedAccount(row) {
    if (!row) return;
    const name = row.getAttribute('data-unified-account');
    if (!name) return;
    const alreadySelected = reportAccts.size === 1 && reportAccts.has(name) && reportGroups.size === 0;
    reportGroups = new Set();
    pendingGroups = new Set();
    reportAccts = alreadySelected ? new Set() : new Set([name]);
    pendingAccts = new Set(reportAccts);
    renderReport();
    if (!alreadySelected) {
      const monthTable = document.getElementById('expAnalysisTable');
      if (monthTable) monthTable.closest('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  body.querySelectorAll('tr[data-unified-account]').forEach(row => {
    row.addEventListener('click', () => selectUnifiedAccount(row));
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectUnifiedAccount(row); } });
  });
}

function renderSavingsOpportunities(recs) {
  const grid = document.getElementById('rptSavingsGrid');
  const sub = document.getElementById('rptSavingsSub');
  if (!grid) return;
  if (!recs.length) {
    grid.innerHTML = '<div class="rpt-opp low"><div class="rpt-opp-head"><div class="rpt-opp-title-wrap"><div class="rpt-opp-eyebrow">ℹ️ No data</div><div class="rpt-opp-title">Nothing to analyse</div></div></div><div class="rpt-opp-body">No records match the selected years.</div></div>';
    if (sub) sub.textContent = 'No data in scope.'; return;
  }
  const total = recs.reduce((s, r) => s + r.expenseAmount, 0);
  const opps = [];

  const acctAll = {};
  recs.forEach(r => { const k = r.category || 'Uncategorized'; acctAll[k] = (acctAll[k] || 0) + r.expenseAmount; });
  const acctSorted = Object.entries(acctAll).sort((a, b) => b[1] - a[1]);
  if (acctSorted.length >= 3 && total > 0) {
    const top3 = acctSorted.slice(0, 3);
    const s3 = top3.reduce((s, e) => s + e[1], 0);
    const share = s3 / total * 100;
    if (share >= 50) {
      const names = top3.map(e => e[0]);
      const amounts = top3.map(e => e[1]);
      opps.push({
        sev: share >= 65 ? 'high' : 'med',
        tag: 'Concentration Risk',
        icon: '🎯',
        title: 'Top 3 accounts hold ' + share.toFixed(0) + '% of your spend',
        amt: s3 * 0.05,
        metrics: [
          { label: 'Concentration', value: share.toFixed(1) + '%' },
          { label: 'Top-3 total', value: money(s3) },
          { label: 'Biggest account', value: money(amounts[0]) },
          { label: 'Accounts tracked', value: acctSorted.length + '' }
        ],
        body: 'Your top three expense accounts — <b>' + esc(names[0]) + '</b> (' + money(amounts[0]) + '), <b>' + esc(names[1]) + '</b> (' + money(amounts[1]) + ') and <b>' + esc(names[2]) + '</b> (' + money(amounts[2]) + ') — together account for <span class="hl">' + share.toFixed(1) + '%</span> of your total spend. A savings of just 5% on these three would free up <b>' + money(s3 * 0.05) + '</b> in your budget.',
        actions: [
          'Set a hard monthly budget for each of the top 3 accounts and review at month-end.',
          'Re-negotiate vendor contracts on ' + esc(names[0]) + ' — even a 3–5% rate cut there is worth ' + money(amounts[0] * 0.04) + '.',
          'Ask budget owners of ' + esc(names[1]) + ' and ' + esc(names[2]) + ' to justify every invoice above ' + money(amounts[1] / 12) + ' (their monthly average).',
          'Consider splitting large single-vendor spend into two vendors to reduce single-source risk.'
        ]
      });
    }
  }

  const agg = rptYearlyAgg(recs);
  const years = agg.years, map = agg.map;
  if (years.length >= 2) {
    const last = years[years.length - 1], prev = years[years.length - 2];
    const aLast = map[last].acct, aPrev = map[prev].acct;
    const deltas = [];
    Object.keys(aLast).forEach(n => { const cur = aLast[n] || 0; const pv = aPrev[n] || 0; if (pv > 0 && cur > pv) deltas.push({ name: n, cur, prev: pv, delta: cur - pv, pct: ((cur - pv) / pv) * 100 }); });
    deltas.sort((a, b) => b.delta - a.delta);
    const top = deltas[0];
    if (top && top.pct >= 15) {
      opps.push({
        sev: top.pct >= 50 ? 'high' : 'med',
        tag: 'Fastest Growing',
        icon: '📈',
        title: esc(top.name) + ' grew ' + top.pct.toFixed(0) + '% year-on-year',
        amt: top.delta,
        metrics: [
          { label: 'FY ' + prev, value: money(top.prev) },
          { label: 'FY ' + last, value: money(top.cur) },
          { label: 'Increase', value: '+' + money(top.delta), up: true },
          { label: 'Growth %', value: '+' + top.pct.toFixed(1) + '%', up: true }
        ],
        body: 'The account <b>' + esc(top.name) + '</b> jumped from <b>' + money(top.prev) + '</b> in FY ' + prev + ' to <b>' + money(top.cur) + '</b> in FY ' + last + '. That is an increase of <span class="hl">' + money(top.delta) + '</span> in one year alone — the single biggest yearly jump in your entire ledger.',
        actions: [
          'Pull the month-wise drawer for ' + esc(top.name) + ' and identify which months spiked (likely a one-off or duplicate).',
          'Ask for the top 5 invoices by value under ' + esc(top.name) + ' and verify each against a purchase order.',
          'If it is recurring, cap it: set a monthly ceiling of ' + money(top.cur / 12) + ' — anything above needs CFO approval.',
          'Add this account to next quarter\'s vendor negotiation list — a 5% cut saves ' + money(top.cur * 0.05) + ' per year.'
        ]
      });
    }
  }

  const stats = rptTrendStats(years, map);
  if (stats.cagr !== null && isFinite(stats.cagr)) {
    const rising = stats.cagr > 0;
    if (Math.abs(stats.cagr) >= 5) {
      const firstY = years[0], lastY = years[years.length - 1];
      const firstTotal = map[firstY].total, lastTotal = map[lastY].total;
      opps.push({
        sev: rising ? (stats.cagr >= 15 ? 'high' : 'med') : 'low',
        tag: rising ? 'Compounding Upward' : 'Trending Down',
        icon: rising ? '🚀' : '📉',
        title: rising ? 'Spend is compounding at ' + stats.cagr.toFixed(1) + '% per year' : 'Spend is trending down at ' + Math.abs(stats.cagr).toFixed(1) + '% per year',
        amt: rising ? lastTotal - firstTotal : null,
        metrics: [
          { label: 'FY ' + firstY + ' total', value: money(firstTotal) },
          { label: 'FY ' + lastY + ' total', value: money(lastTotal) },
          { label: 'CAGR', value: (rising ? '+' : '') + stats.cagr.toFixed(1) + '%', up: rising, down: !rising },
          { label: 'Period length', value: years.length + ' years' }
        ],
        body: rising
          ? 'Your expense base has been growing at <span class="hl">' + stats.cagr.toFixed(1) + '%</span> year-over-year from FY ' + firstY + ' (' + money(firstTotal) + ') to FY ' + lastY + ' (' + money(lastTotal) + '). Left unchecked, at this rate your spend will roughly <b>double in ' + Math.max(1, Math.round(Math.log(2) / Math.log(1 + stats.cagr / 100))) + ' years</b>.'
          : 'Good news — total spend is <b>decreasing</b> at ' + Math.abs(stats.cagr).toFixed(1) + '% CAGR across FY ' + firstY + '–' + lastY + '. Keep the controls that made this happen.',
        actions: rising
          ? [
              'Introduce an annual budget cap and freeze discretionary spend once 80% is used.',
              'Rank every account by CAGR and put the top 5 under monthly review.',
              'Ask each budget owner for a 10% reduction plan in their fastest-growing line item.',
              'Re-forecast FY ' + (lastY + 1) + ' assuming the same growth — the projected number is ' + money(lastTotal * (1 + stats.cagr / 100)) + '.'
            ]
          : [
              'Document what changed — process, vendors, volumes — so it can be repeated next year.',
              'Confirm the reduction is real (not just delayed invoices) by checking payable ageing.',
              'Lock in the improved vendor terms with multi-year contracts where beneficial.',
              'Redirect the freed-up budget to growth areas rather than letting it lapse.'
            ]
      });
    }
  }

  const pMap = {};
  recs.forEach(r => { const k = r.particulars || 'Uncategorized'; pMap[k] = (pMap[k] || 0) + r.expenseAmount; });
  const pSorted = Object.entries(pMap).sort((a, b) => b[1] - a[1]);
  if (pSorted.length && total > 0) {
    const pName = pSorted[0][0], pAmt = pSorted[0][1];
    const pShare = pAmt / total * 100;
    if (pShare >= 15) {
      const pTxCount = recs.filter(r => (r.particulars || 'Uncategorized') === pName).length;
      const pAvg = pAmt / pTxCount;
      opps.push({
        sev: pShare >= 30 ? 'high' : 'med',
        tag: 'Category Concentration',
        icon: '🏷️',
        title: esc(pName) + ' is ' + pShare.toFixed(0) + '% of your entire budget',
        amt: pAmt * 0.03,
        metrics: [
          { label: 'Total spend', value: money(pAmt) },
          { label: 'Share of budget', value: pShare.toFixed(1) + '%' },
          { label: 'Transactions', value: fmt.format(pTxCount) },
          { label: 'Avg / transaction', value: money(pAvg) }
        ],
        body: 'The particular <b>' + esc(pName) + '</b> accounts for <span class="hl">' + pShare.toFixed(1) + '%</span> of all spend — ' + money(pAmt) + ' across ' + fmt.format(pTxCount) + ' transactions (avg ' + money(pAvg) + '). A modest 3% saving on this single line frees up <b>' + money(pAmt * 0.03) + '</b>.',
        actions: [
          'Break this particular down by vendor and identify the top 5 suppliers — 80% of the spend is usually concentrated there.',
          'Put the top 3 suppliers under competitive tender or re-negotiation this quarter.',
          'Tighten approval: any single invoice in ' + esc(pName) + ' above ' + money(pAvg * 3) + ' needs dual sign-off.',
          'Benchmark the average transaction value (' + money(pAvg) + ') against industry peers — if it is high, ask why.'
        ]
      });
    }
  }

  const mMap = {};
  recs.forEach(r => { const k = monthKey(r); mMap[k] = (mMap[k] || 0) + r.expenseAmount; });
  const mKeys = Object.keys(mMap).sort(monthKeySort);
  if (mKeys.length >= 4) {
    const vals = mKeys.map(k => mMap[k]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
    const spikes = mKeys.map((k, i) => ({ k, v: vals[i], z: sd > 0 ? (vals[i] - mean) / sd : 0 })).filter(x => x.z >= 1.8).sort((a, b) => b.z - a.z);
    if (spikes.length) {
      const s = spikes[0];
      opps.push({
        sev: s.z >= 2.5 ? 'high' : 'med',
        tag: 'Anomalous Month',
        icon: '⚡',
        title: esc(s.k) + ' was ' + s.z.toFixed(1) + 'σ above your monthly average',
        amt: s.v - mean,
        metrics: [
          { label: 'Spike month', value: esc(s.k) },
          { label: 'Month total', value: money(s.v) },
          { label: 'Monthly avg', value: money(mean) },
          { label: 'Excess', value: '+' + money(s.v - mean), up: true }
        ],
        body: esc(s.k) + ' recorded <b>' + money(s.v) + '</b> against your normal monthly average of <b>' + money(mean) + '</b>. That is an excess of <span class="hl">' + money(s.v - mean) + '</span> in a single month — usually the sign of a one-off purchase, an annual payment, or a duplicate posting.',
        actions: [
          'Open the month drawer for ' + esc(s.k) + ' and sort by amount (highest first).',
          'For every top-5 entry, verify it has a valid PO, invoice number and business justification.',
          'Confirm no duplicate: check if the same vendor / same amount appears in the adjacent month.',
          'If genuine, tag it as "annual / one-off" so it is excluded from future averages and MoM alerts.'
        ]
      });
    }
  }

  const sevRank = { high: 0, med: 1, low: 2 };
  opps.sort((a, b) => { const r = (sevRank[a.sev] || 3) - (sevRank[b.sev] || 3); return r !== 0 ? r : (b.amt || 0) - (a.amt || 0); });
  if (sub) sub.textContent = opps.length ? opps.length + ' detailed savings plan' + (opps.length === 1 ? '' : 's') + ' detected — highest impact first. Each card shows the numbers and a step-by-step action plan.' : 'No savings signals in the current selection.';

  grid.innerHTML = opps.slice(0, 6).map(o => {
    const amtHtml = (o.amt && o.amt > 0) ? '<div class="rpt-opp-amt-badge">save up to ' + money(o.amt) + '</div>' : '';
    const metricsHtml = o.metrics && o.metrics.length
      ? '<div class="rpt-opp-metrics">' + o.metrics.map(m => '<div class="rpt-opp-metric"><span class="rpt-opp-metric-label">' + esc(m.label) + '</span><span class="rpt-opp-metric-value' + (m.up ? ' up' : '') + (m.down ? ' down' : '') + '">' + m.value + '</span></div>').join('') + '</div>'
      : '';
    const actionsHtml = o.actions && o.actions.length
      ? '<div class="rpt-opp-section"><div class="rpt-opp-section-label"><span class="lbl-ico">✅</span> Action plan</div><ul class="rpt-opp-actions">' + o.actions.map(a => '<li>' + a + '</li>').join('') + '</ul></div>'
      : '';
    return '<div class="rpt-opp ' + o.sev + '">' +
      '<div class="rpt-opp-head">' +
        '<div class="rpt-opp-title-wrap">' +
          '<div class="rpt-opp-eyebrow">' + (o.icon || '') + ' ' + esc(o.tag) + '</div>' +
          '<div class="rpt-opp-title">' + o.title + '</div>' +
        '</div>' +
        amtHtml +
      '</div>' +
      metricsHtml +
      '<div class="rpt-opp-section">' +
        '<div class="rpt-opp-section-label"><span class="lbl-ico">📋</span> What we found</div>' +
        '<div class="rpt-opp-body">' + o.body + '</div>' +
      '</div>' +
      actionsHtml +
    '</div>';
  }).join('');
}

function rptYearlyAgg(recs) {
  const map = {};
  recs.forEach(r => { const y = Number(r.financialYear); if (!y) return; if (!map[y]) map[y] = { fy: y, total: 0, tx: 0, loc: {}, part: {}, acct: {}, months: {} }; const d = map[y]; const amt = r.expenseAmount; d.total += amt; d.tx += 1; const lk = String(r.locationKey || '').toUpperCase(); if (lk) d.loc[lk] = (d.loc[lk] || 0) + amt; const pk = r.particulars || 'Uncategorized'; d.part[pk] = (d.part[pk] || 0) + amt; const ak = r.category || 'Uncategorized'; d.acct[ak] = (d.acct[ak] || 0) + amt; const mk = monthKey(r); d.months[mk] = (d.months[mk] || 0) + amt; });
  const years = Object.keys(map).map(Number).sort((a, b) => a - b);
  return { map, years };
}
function rptTrendStats(years, map) {
  const yoy = {};
  years.forEach((y, i) => { if (i === 0) { yoy[y] = null; return; } const prev = map[years[i - 1]].total; yoy[y] = prev > 0 ? ((map[y].total - prev) / prev) * 100 : null; });
  let cagr = null;
  if (years.length >= 2) { const first = map[years[0]].total, last = map[years[years.length - 1]].total, n = years.length - 1; if (first > 0 && last > 0) cagr = (Math.pow(last / first, 1 / n) - 1) * 100; }
  return { yoy, cagr };
}

function renderYearlyReview(recs) {
  const listEl = document.getElementById('rptYearReviewList');
  const sub = document.getElementById('rptYearReviewSub');
  if (!listEl) return;
  const agg = rptYearlyAgg(recs);
  const years = agg.years, map = agg.map;
  const alerts = [];
  if (!years.length) {
    listEl.innerHTML = '<div class="rpt-review-empty">No yearly data for the current filters.</div>';
    if (sub) sub.textContent = 'Nothing to review.';
    return;
  }

  const stats = rptTrendStats(years, map);
  years.forEach((y, idx) => {
    const g = stats.yoy[y];
    if (g !== null && isFinite(g) && g >= 25 && idx > 0) {
      const prevY = years[idx - 1];
      const prevTotal = map[prevY].total, curTotal = map[y].total;
      alerts.push({
        sev: g >= 60 ? 'high' : 'med',
        type: 'Yearly Jump',
        scope: 'FY ' + y + ' vs FY ' + prevY,
        title: 'Total spend jumped ' + g.toFixed(1) + '% in FY ' + y,
        impact: curTotal - prevTotal,
        metrics: [
          { label: 'FY ' + prevY, value: money(prevTotal) },
          { label: 'FY ' + y, value: money(curTotal) },
          { label: 'Increase', value: '+' + money(curTotal - prevTotal) },
          { label: 'Growth', value: '+' + g.toFixed(1) + '%' }
        ],
        what: 'Total spend rose from <b>' + money(prevTotal) + '</b> in FY ' + prevY + ' to <b>' + money(curTotal) + '</b> in FY ' + y + ' — an increase of <span class="num">' + money(curTotal - prevTotal) + '</span> (' + g.toFixed(1) + '%).',
        why: 'Common causes: new headcount, new vendor contracts, one-off capex, or a pricing revision from an existing supplier. Review the top 3 growing accounts to pinpoint the driver.',
        solutions: [
          'Pull the top 5 accounts by increase between FY ' + prevY + ' and FY ' + y + ' — the driver is almost always in one of them.',
          'For each driver, confirm whether the increase is business-driven (approved) or price creep (renegotiable).',
          'Set an FY ' + (y + 1) + ' budget for these accounts at no more than FY ' + prevY + ' + 5%.',
          'Freeze all discretionary purchases until the growth driver is validated.'
        ]
      });
    }
  });

  if (years.length >= 2) {
    const last = years[years.length - 1], prev = years[years.length - 2];
    const aLast = map[last].acct, aPrev = map[prev].acct;
    const growths = [];
    Object.keys(aLast).forEach(a => {
      const cur = aLast[a] || 0, pv = aPrev[a] || 0;
      if (pv > 0 && cur > pv) growths.push({ name: a, cur, prev: pv, delta: cur - pv, pct: ((cur - pv) / pv) * 100 });
    });
    growths.sort((a, b) => b.delta - a.delta);
    growths.slice(0, 4).forEach(x => {
      if (x.pct >= 30 && x.delta > 0) {
        alerts.push({
          sev: x.pct >= 100 ? 'high' : 'med',
          type: 'Account Growth',
          scope: 'FY ' + last + ' · ' + x.name,
          title: x.name + ' grew ' + x.pct.toFixed(0) + '% year-on-year',
          impact: x.delta,
          metrics: [
            { label: 'FY ' + prev, value: money(x.prev) },
            { label: 'FY ' + last, value: money(x.cur) },
            { label: 'Increase', value: '+' + money(x.delta) },
            { label: 'Growth', value: '+' + x.pct.toFixed(1) + '%' }
          ],
          what: 'The account <b>' + esc(x.name) + '</b> moved from <b>' + money(x.prev) + '</b> in FY ' + prev + ' to <b>' + money(x.cur) + '</b> in FY ' + last + ' — a rise of <span class="num">' + money(x.delta) + '</span> (' + x.pct.toFixed(1) + '%).',
          why: 'Either a genuine volume increase (more work / more users) or a rate revision from the vendor. It is worth checking which.',
          solutions: [
            'Open the month drawer for ' + esc(x.name) + ' and sort by amount — the top 3 invoices usually contain the anomaly.',
            'For each of the top 3 entries, confirm a valid PO and justification exists.',
            'If it is a rate increase, request a written quote comparison from two alternative vendors.',
            'If it is recurring, cap this account at ' + money(x.cur / 12) + ' per month going forward.'
          ]
        });
      }
    });
  }

  const mMap = {};
  recs.forEach(r => { const k = monthKey(r); mMap[k] = (mMap[k] || 0) + r.expenseAmount; });
  const mKeys = Object.keys(mMap).sort(monthKeySort);
  if (mKeys.length >= 4) {
    const vals = mKeys.map(k => mMap[k]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
    mKeys.forEach(k => {
      const z = sd > 0 ? (mMap[k] - mean) / sd : 0;
      if (z >= 1.8) {
        alerts.push({
          sev: z >= 2.5 ? 'high' : 'med',
          type: 'Abnormal Month',
          scope: k,
          title: k + ' spend was ' + z.toFixed(1) + 'σ above normal',
          impact: mMap[k] - mean,
          metrics: [
            { label: 'Month total', value: money(mMap[k]) },
            { label: 'Monthly avg', value: money(mean) },
            { label: 'Excess', value: '+' + money(mMap[k] - mean) },
            { label: 'Std-devs', value: z.toFixed(2) + 'σ' }
          ],
          what: 'Spend in <b>' + esc(k) + '</b> was <b>' + money(mMap[k]) + '</b>, compared with your monthly average of <b>' + money(mean) + '</b>. That is <span class="num">' + z.toFixed(2) + 'σ</span> above normal, so it is statistically an outlier.',
          why: 'Likely reasons: an annual / quarterly payment fell due, a one-off purchase, or a duplicate posting. Needs eyeball verification.',
          solutions: [
            'Open the drawer for ' + esc(k) + ' and look at the top 5 largest transactions.',
            'Verify each against a purchase order; if any lacks one, escalate for approval.',
            'Cross-check adjacent months for an identical amount (a duplicate would match).',
            'Tag confirmed annual payments so they are excluded from future anomaly alerts.'
          ]
        });
      }
    });
  }

  years.forEach(y => {
    const fyRecs = recs.filter(r => Number(r.financialYear) === y);
    if (!fyRecs.length) return;
    let blank = 0;
    fyRecs.forEach(r => { const t = ((r.descr || '') + ' ' + (r.txnRemark || '')).trim(); if (!t) blank++; });
    const p = blank / fyRecs.length * 100;
    if (p >= 20) {
      alerts.push({
        sev: p >= 50 ? 'high' : 'low',
        type: 'Documentation Gap',
        scope: 'FY ' + y,
        title: pct(p) + ' of FY ' + y + ' transactions have no remark',
        impact: null,
        metrics: [
          { label: 'Total transactions', value: fmt.format(fyRecs.length) },
          { label: 'Missing remark', value: fmt.format(blank) },
          { label: 'Coverage gap', value: pct(p) },
          { label: 'With remarks', value: fmt.format(fyRecs.length - blank) }
        ],
        what: 'Out of <b>' + fmt.format(fyRecs.length) + '</b> transactions in FY ' + y + ', <b>' + fmt.format(blank) + '</b> (' + pct(p) + ') carry no DESCR or TXNREMARK. This makes audits, reviews and vendor comparisons unreliable.',
        why: 'Field entries without narration are the most common audit red flag — they also make it impossible to trace a payment back to a business purpose.',
        solutions: [
          'Make DESCR a mandatory field in the expense entry form (no save without it).',
          'Run a cleanup drive: backfill the top 50 missing entries by value with a short note.',
          'Send a short SOP to all budget owners explaining what a good narration looks like (vendor + purpose + PO number).',
          'Review again in 30 days; target < 5% missing.'
        ]
      });
    }
  });

  const sevRank = { high: 0, med: 1, low: 2 };
  alerts.sort((a, b) => { const r = (sevRank[a.sev] || 3) - (sevRank[b.sev] || 3); return r !== 0 ? r : (b.impact || 0) - (a.impact || 0); });

  if (sub) sub.textContent = alerts.length ? alerts.length + ' item' + (alerts.length === 1 ? '' : 's') + ' flagged — highest severity first. Each card shows what changed, why it matters, and what to do next.' : 'No issues found in this selection 🎉';

  if (!alerts.length) {
    listEl.innerHTML = '<div class="rpt-review-empty">Nothing to review for this filter selection 🎉</div>';
    return;
  }

  const sevPill = {
    high: '<span class="rpt-status over">High</span>',
    med:  '<span class="rpt-status warn">Medium</span>',
    low:  '<span class="rpt-status ok">Low</span>'
  };

  listEl.innerHTML = alerts.slice(0, 40).map(a => {
    const metricsHtml = a.metrics && a.metrics.length
      ? '<div class="rpt-review-body">' +
          '<div class="rpt-review-block"><div class="rpt-review-block-label"><span class="lbl-ico">📋</span> What changed</div><div class="rpt-review-block-body">' + a.what + '</div></div>' +
          '<div class="rpt-review-block"><div class="rpt-review-block-label"><span class="lbl-ico">🔍</span> Why it matters</div><div class="rpt-review-block-body">' + a.why + '</div></div>' +
        '</div>'
      : '<div class="rpt-review-body" style="grid-template-columns:1fr"><div class="rpt-review-block"><div class="rpt-review-block-label"><span class="lbl-ico">📋</span> What changed</div><div class="rpt-review-block-body">' + a.what + '</div></div></div>';
    const impactHtml = a.impact
      ? '<div class="rpt-review-impact"><div class="rpt-review-impact-label">Financial impact</div><div class="rpt-review-impact-value">' + money(a.impact) + '</div></div>'
      : '<div class="rpt-review-impact"><div class="rpt-review-impact-label">Financial impact</div><div class="rpt-review-impact-value muted">No direct cost</div></div>';
    return '<div class="rpt-review-card sev-' + a.sev + '">' +
      '<div class="rpt-review-head">' +
        '<div class="rpt-review-title-wrap">' +
          '<div class="rpt-review-meta">' +
            sevPill[a.sev] +
            '<span class="rpt-review-scope">' + esc(a.type) + '</span>' +
            '<span class="rpt-review-scope">📍 ' + esc(a.scope) + '</span>' +
          '</div>' +
          '<div class="rpt-review-title">' + esc(a.title) + '</div>' +
        '</div>' +
        impactHtml +
      '</div>' +
      metricsHtml +
      '<div class="rpt-review-solution">' +
        '<div class="rpt-review-solution-label"><span class="lbl-ico">💡</span> How to reduce this expense</div>' +
        '<ol>' + a.solutions.map(s => '<li>' + s + '</li>').join('') + '</ol>' +
      '</div>' +
    '</div>';
  }).join('');
}

function exportUnifiedComparisonCSV() {
  const recs = getReportRecords(true);
  const yearsInScope = reportYears.slice().sort((a, b) => a - b);
  const rows = [['Account Group', ...yearsInScope.map(y => 'FY ' + y), 'Total', 'Growth %', 'Crius', 'Chiros', 'Crius FND']];
  const acctMap = {};
  recs.forEach(r => { const y = Number(r.financialYear); if (!y) return; const g = r.category || 'Uncategorized'; const lk = String(r.locationKey || '').toUpperCase(); if (!acctMap[g]) acctMap[g] = { fyTotals: {}, locTotals: {'CRIUS':0,'CHIROS':0,'CRIUS FND':0}, total: 0 }; acctMap[g].fyTotals[y] = (acctMap[g].fyTotals[y] || 0) + r.expenseAmount; if (lk) acctMap[g].locTotals[lk] = (acctMap[g].locTotals[lk] || 0) + r.expenseAmount; acctMap[g].total += r.expenseAmount; });
  Object.entries(acctMap).sort((a, b) => b[1].total - a[1].total).forEach(([name, d]) => {
    let g = '';
    if (yearsInScope.length >= 2) { const first = d.fyTotals[yearsInScope[0]] || 0; const last  = d.fyTotals[yearsInScope[yearsInScope.length - 1]] || 0; if (first > 0) g = (((last - first) / first) * 100).toFixed(1); }
    rows.push([name, ...yearsInScope.map(y => d.fyTotals[y] || 0), d.total, g, d.locTotals['CRIUS'] || 0, d.locTotals['CHIROS'] || 0, d.locTotals['CRIUS FND'] || 0]);
  });
  downloadCSV('crius_unified_yearly_comparison_' + fyScopeTag() + '_' + csvTimestamp() + '.csv', rows);
}

function openCommandPalette() { const palette = document.getElementById('cmdPalette'), backdrop = document.getElementById('cmdBackdrop'), input = document.getElementById('cmdInput'); backdrop.classList.add('open'); palette.classList.add('open'); palette.setAttribute('aria-hidden', 'false'); input.value = ''; cmdActiveIndex = 0; cmdItems = buildCommandItems(); renderCommandResults(''); setTimeout(() => input.focus(), 40); }
function closeCommandPalette() { document.getElementById('cmdPalette').classList.remove('open'); document.getElementById('cmdBackdrop').classList.remove('open'); document.getElementById('cmdPalette').setAttribute('aria-hidden', 'true'); }
function buildCommandItems() {
  const items = [];
  items.push({ type:'action', icon:'⟲', label:'Reset all filters', hint:'Action', action: resetAllFilters });
  items.push({ type:'action', icon:'↻', label:'Refresh data from server', hint:'Action', action: () => { closeCommandPalette(); document.getElementById('refreshBtn').click(); } });
  items.push({ type:'action', icon:'🌙', label:'Toggle theme', hint:'Action', action: () => { closeCommandPalette(); document.getElementById('themeToggle').click(); } });
  items.push({ type:'action', icon:'⬇', label:'Export FY × Particular pivot as CSV', hint:'Action', action: () => { closeCommandPalette(); exportParticularsCSV(); } });
  items.push({ type:'action', icon:'⬇', label:'Export monthly breakdown as CSV', hint:'Action', action: () => { closeCommandPalette(); exportMonthlyCSV(); } });
  items.push({ type:'action', icon:'⬇', label:'Export FY breakdown as CSV', hint:'Action', action: () => { closeCommandPalette(); exportFYCSV(); } });
  const fys = [...new Set(allRecords.map(r => Number(r.financialYear)))].filter(y => y).sort((a,b) => b - a);
  fys.forEach(fy => items.push({ type:'fy', icon:'📅', label:'FY ' + fy, hint:'Year', action: () => { closeCommandPalette(); selFY = new Set([fy]); syncCurrent(); if (fyMs) fyMs.refresh(); applyClientFilters(); } }));
  items.push({ type:'fy', icon:'📅', label:'All Years', hint:'Year', action: () => { closeCommandPalette(); selFY = new Set(allFYs); syncCurrent(); if (fyMs) fyMs.refresh(); applyClientFilters(); } });
  [['__ALL__', 'All Companies'], ['CRIUS', 'Crius'], ['CHIROS', 'Chiros'], ['CRIUS FND', 'Crius FND']].forEach(([val, label]) => { items.push({ type:'company', icon:'🏢', label, hint:'Company', action: () => { closeCommandPalette(); selLoc = val === '__ALL__' ? new Set(ALL_COMPANIES) : new Set([val]); syncCurrent(); if (locMs) locMs.refresh(); applyClientFilters(); } }); });
  const partTotals = {};
  records.forEach(r => { const k = r.particulars || 'Uncategorized'; partTotals[k] = (partTotals[k] || 0) + r.expenseAmount; });
  const topParts = Object.entries(partTotals).sort((a,b) => b[1] - a[1]).slice(0, 12);
  const latestFy = currentFY === 'ALL' ? (records.length ? Math.max(...records.map(r => Number(r.financialYear))) : new Date().getFullYear()) : parseInt(currentFY, 10);
  topParts.forEach(([name, amt]) => items.push({ type:'particular', icon:'📊', label: name, hint: money(amt, true), action: () => { closeCommandPalette(); openParticularDrawer(name, latestFy); } }));
  return items;
}
function renderCommandResults(query) {
  const q = (query || '').trim().toLowerCase();
  cmdFiltered = q ? cmdItems.filter(it => it.label.toLowerCase().indexOf(q) !== -1) : cmdItems.slice();
  if (cmdActiveIndex >= cmdFiltered.length) cmdActiveIndex = 0;
  const results = document.getElementById('cmdResults');
  document.getElementById('cmdFooterCount').textContent = cmdFiltered.length + ' result' + (cmdFiltered.length === 1 ? '' : 's');
  if (!cmdFiltered.length) { results.innerHTML = '<div class="cmd-empty">No results for "' + esc(q) + '"</div>'; return; }
  const groups = { action:'Actions', fy:'Financial Year', company:'Company', particular:'Particulars' };
  const order = ['action','fy','company','particular'];
  let html = ''; let flatIndex = 0;
  order.forEach(type => {
    const group = cmdFiltered.filter(it => it.type === type);
    if (!group.length) return;
    html += '<div class="cmd-section">' + groups[type] + '</div>';
    group.forEach(it => { const idx = flatIndex++; const active = idx === cmdActiveIndex; html += '<div class="cmd-item' + (active ? ' active' : '') + '" data-index="' + idx + '"><span class="cmd-item-icon">' + it.icon + '</span><span class="cmd-item-label">' + esc(it.label) + '</span><span class="cmd-item-hint">' + esc(it.hint) + '</span></div>'; });
  });
  results.innerHTML = html;
  results.querySelectorAll('.cmd-item').forEach(el => { el.addEventListener('click', () => { const idx = parseInt(el.getAttribute('data-index'), 10); if (cmdFiltered[idx]) cmdFiltered[idx].action(); }); });
  const activeEl = results.querySelector('.cmd-item.active'); if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
}

/* ═══════════════════════════════════════════════════════════════════
   AI ASSISTANT
   ═══════════════════════════════════════════════════════════════════ */
function openAIAssistant() {
  const d = document.getElementById('aiDrawer');
  d.classList.add('open');
  document.getElementById('aiBackdrop').classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  setTimeout(() => { const inp = document.getElementById('aiInput'); if (inp) inp.focus(); }, 280);
}
function closeAIAssistant() {
  const d = document.getElementById('aiDrawer');
  d.classList.remove('open', 'fullscreen', 'history-mode');

  const expandBtn = document.getElementById('aiExpand');
  if (expandBtn) {
    expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    expandBtn.title = 'Maximize';
  }

  document.getElementById('aiBackdrop').classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
}
var AI_HISTORY_KEY = 'ai_chat_history_v1';
var AI_HISTORY_MAX = 200;

function aiHistoryLoad() {
  try {
    var raw = localStorage.getItem(AI_HISTORY_KEY);
    var list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch(e) { return []; }
}
function aiHistorySave(list) {
  try { localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(list)); } catch(e) {}
}
function aiHistoryAdd(q, a) {
  if (!q || !a) return;
  var list = aiHistoryLoad();
  list.unshift({
    id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    q: String(q),
    a: String(a),
    ts: Date.now()
  });
  if (list.length > AI_HISTORY_MAX) list = list.slice(0, AI_HISTORY_MAX);
  aiHistorySave(list);
  var panel = document.getElementById('aiHistoryPanel');
  if (panel && document.getElementById('aiDrawer').classList.contains('history-mode')) {
    aiHistoryRender();
  }
}
function aiHistoryDelete(id) {
  var list = aiHistoryLoad().filter(function(x){ return x.id !== id; });
  aiHistorySave(list);
  aiHistoryRender();
}
function aiHistoryClearAll() {
  if (!confirm('Delete the entire chat history? This cannot be undone.')) return;
  try { localStorage.removeItem(AI_HISTORY_KEY); } catch(e) {}
  aiHistoryRender();
}
function aiHistoryRender() {
  var list = aiHistoryLoad();
  var el = document.getElementById('aiHistoryList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="ai-history-empty">📭<br>No saved questions yet.<br>Every question you ask is saved here automatically.</div>';
    return;
  }
  el.innerHTML = list.map(function(item) {
    var d = new Date(item.ts);
    var dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
                  ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    var aPreview = String(item.a || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    return '<div class="ai-history-item" data-id="' + item.id + '">' +
             '<div class="hi-date">📅 ' + dateStr + '</div>' +
             '<div class="hi-q">' + esc(item.q) + '</div>' +
             '<div class="hi-a">' + esc(aPreview) + '</div>' +
             '<button class="hi-del" title="Delete this entry" data-del="' + item.id + '">×</button>' +
           '</div>';
  }).join('');

  el.querySelectorAll('.ai-history-item').forEach(function(row) {
    row.addEventListener('click', function(e) {
      if (e.target.closest('.hi-del')) return;
      var id = row.getAttribute('data-id');
      var item = aiHistoryLoad().find(function(x){ return x.id === id; });
      if (item) aiHistoryReplay(item);
    });
  });
  el.querySelectorAll('.hi-del').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      aiHistoryDelete(btn.getAttribute('data-del'));
    });
  });
}
function aiHistoryToggle() {
  var d = document.getElementById('aiDrawer');
  if (!d) return;
  var nowHistory = d.classList.toggle('history-mode');
  if (nowHistory) aiHistoryRender();
}
function aiHistoryReplay(item) {
  var body = document.getElementById('aiChatBody');
  var welcome = body.querySelector('.ai-welcome'); if (welcome) welcome.remove();

  var userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.innerHTML = '<div class="ai-bubble">' + esc(item.q) + '</div>';
  body.appendChild(userMsg);

  var botMsg = document.createElement('div');
  botMsg.className = 'ai-msg bot';
  botMsg.innerHTML = '<div class="ai-avatar">🤖</div><div class="ai-bubble">' + aiFormatAnswer(item.a) + '</div>';
  body.appendChild(botMsg);

  body.scrollTop = body.scrollHeight;
  lastAiQuestion = item.q;

  document.getElementById('aiDrawer').classList.remove('history-mode');
}
function aiNewChat() {
  var body = document.getElementById('aiChatBody');
  body.innerHTML =
    '<div class="ai-welcome">' +
      '<div class="ai-welcome-icon">🤖</div>' +
      '<div class="ai-welcome-title">New chat</div>' +
      '<div class="ai-welcome-sub">Ask anything about your expense data — totals, top months, biggest categories, company-wise spend, comparisons, trends and more.</div>' +
      '<div class="ai-suggestions">' +
        '<button class="ai-suggestion" data-q="What is the total expense this year?">Total expense this year</button>' +
        '<button class="ai-suggestion" data-q="Give me the highest month expenses in the current year">Highest month in current year</button>' +
        '<button class="ai-suggestion" data-q="Top 5 categories by amount">Top 5 categories</button>' +
        '<button class="ai-suggestion" data-q="Compare Crius vs Chiros spending">Compare Crius vs Chiros</button>' +
        '<button class="ai-suggestion" data-q="Top 5 vendors by amount">Top 5 vendors</button>' +
        '<button class="ai-suggestion" data-q="Average transaction amount">Average transaction</button>' +
      '</div>' +
    '</div>';
  lastAiQuestion = '';
  document.getElementById('aiDrawer').classList.remove('history-mode');
}

function aiFormatAnswer(text) {
  if (!text) return '';
  var s = String(text).trim();
  if (/^<div\b/i.test(s)) {
    return s;
  }
  var html = s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function aiSendQuestion(question) {
  if (!question || !question.trim()) return;
  if (!allRecords.length) {
    aiAppendBot('No expense data loaded yet. Please refresh the page so I can answer questions about your expenses.');
    return;
  }

  var raw = String(question).trim();
  var lower = raw.toLowerCase();

  var followUpRegex  = /\b(that|this|those|these|the above|previous|earlier|same|it|them)\b/i;
  var genericRegex   = /\b(details?|more|explain|why|breakdown|expand|elaborate|solution[s]?|reduce|cut|save|savings|recommend)\b/i;
  var isFollowUp = !!lastAiQuestion && (followUpRegex.test(lower) || genericRegex.test(lower));

  var finalQuestion = raw;
  var skipFast = false;

  if (isFollowUp) {
    finalQuestion =
      'You previously answered the question: "' + lastAiQuestion + '". ' +
      'The user now asks: "' + raw + '". ' +
      'Interpret the new question in the context of the previous one. ' +
      'Keep the same scope (same month / year / company / category unless the user changes it). ' +
      'Give a specific, data-driven answer with concrete numbers, top transactions, ' +
      'categories, or actionable steps as relevant.';
    skipFast = true;
  }
  lastAiQuestion = raw;

  var body = document.getElementById('aiChatBody');
  var welcome = body.querySelector('.ai-welcome'); if (welcome) welcome.remove();

  var userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.innerHTML = '<div class="ai-bubble">' + esc(raw) + '</div>';
  body.appendChild(userMsg);
  body.scrollTop = body.scrollHeight;

  var botMsg = document.createElement('div');
  botMsg.className = 'ai-msg bot';
  botMsg.innerHTML = '<div class="ai-avatar">🤖</div><div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>';
  body.appendChild(botMsg);
  body.scrollTop = body.scrollHeight;

  var sendBtn = document.getElementById('aiSend');
  if (sendBtn) sendBtn.disabled = true;

  var payload = allRecords.map(function(r) {
    return {
      fy: r.financialYear, month: r.month, month_year: r.monthYear,
      company: r.locationKey, location: r.locationKey,
      account: r.category, particulars: r.particulars,
      descr: r.descr, txn_remark: r.txnRemark, amount: r.expenseAmount
    };
  });

  askGemini(finalQuestion, payload, skipFast)
    .then(function(answer) {
      if (sendBtn) sendBtn.disabled = false;
      var safeAnswer = answer || 'No response.';
      botMsg.querySelector('.ai-bubble').innerHTML = aiFormatAnswer(safeAnswer);
      body.scrollTop = body.scrollHeight;
      try { aiHistoryAdd(raw, safeAnswer); } catch(e) { console.warn('History save failed', e); }
    })
    .catch(function(err) {
      if (sendBtn) sendBtn.disabled = false;
      var msg = (err && err.message) ? err.message : 'Unknown error.';
      botMsg.querySelector('.ai-bubble').innerHTML = '❌ <b>AI error:</b> ' + esc(msg);
      body.scrollTop = body.scrollHeight;
    });
}

function aiAppendBot(html) {
  const body = document.getElementById('aiChatBody');
  const welcome = body.querySelector('.ai-welcome'); if (welcome) welcome.remove();
  const botMsg = document.createElement('div');
  botMsg.className = 'ai-msg bot';
  botMsg.innerHTML = '<div class="ai-avatar">🤖</div><div class="ai-bubble">' + html + '</div>';
  body.appendChild(botMsg);
  body.scrollTop = body.scrollHeight;
}

document.addEventListener('DOMContentLoaded', function () {
  const aiBtn = document.getElementById('aiTabBtn');
  if (aiBtn) aiBtn.addEventListener('click', openAIAssistant);

  const aiClose = document.getElementById('aiClose');
  if (aiClose) aiClose.addEventListener('click', closeAIAssistant);

  const aiBackdrop = document.getElementById('aiBackdrop');
  if (aiBackdrop) aiBackdrop.addEventListener('click', closeAIAssistant);

  const aiHistoryBtn = document.getElementById('aiHistoryBtn');
  if (aiHistoryBtn) aiHistoryBtn.addEventListener('click', aiHistoryToggle);

  const aiNewChatBtn = document.getElementById('aiNewChatBtn');
  if (aiNewChatBtn) aiNewChatBtn.addEventListener('click', aiNewChat);

  const aiHistoryClearAllBtn = document.getElementById('aiHistoryClearAll');
  if (aiHistoryClearAllBtn) aiHistoryClearAllBtn.addEventListener('click', aiHistoryClearAll);

  const aiExpand = document.getElementById('aiExpand');
  if (aiExpand) {
    aiExpand.addEventListener('click', function() {
      const d = document.getElementById('aiDrawer');
      d.classList.toggle('fullscreen');
      const isFull = d.classList.contains('fullscreen');
      this.innerHTML = isFull
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="10" y1="14" x2="3" y2="21"></line><line x1="21" y1="3" x2="14" y2="10"></line></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
      this.title = isFull ? 'Minimize' : 'Maximize';
      const inp = document.getElementById('aiInput');
      if (inp) setTimeout(() => inp.focus(), 60);
    });
  }

  const aiInput = document.getElementById('aiInput');
  const aiSend = document.getElementById('aiSend');
  if (aiSend && aiInput) {
    aiSend.addEventListener('click', () => {
      const q = aiInput.value.trim();
      if (!q) return;
      aiSendQuestion(q);
      aiInput.value = '';
      aiInput.style.height = 'auto';
    });
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        aiSend.click();
      }
    });
    aiInput.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  const aiChatBody = document.getElementById('aiChatBody');
  if (aiChatBody) {
    aiChatBody.addEventListener('click', (e) => {
      const s = e.target.closest('.ai-suggestion');
      if (!s) return;
      const q = s.getAttribute('data-q');
      if (q) aiSendQuestion(q);
    });
  }
});

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.tab-btn[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); }); });
  new MutationObserver(function () { if (currentTab === 'report') { try { renderReport(); } catch (e) { console.warn(e); } } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
});

(function () {
  const _orig = applyClientFilters;
  applyClientFilters = function () {
    const r = _orig.apply(this, arguments);
    if (currentTab === 'report') { try { renderReport(); } catch (e) { console.warn('Report render failed', e); } }
    return r;
  };
})();


/* ═══════════════════════════════════════════════════════════════════
   REPORT TAB — filter / selection / generate wiring
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('rfJump', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  on('expApplyBtn', applyExpSelection);
  on('expClearBtn', clearExpSelection);

  const rep = document.getElementById('reportPage');
  if (rep) rep.addEventListener('click', function (e) {
    const b = e.target.closest('.gen-btn');
    if (!b || b.disabled) return;
    const kind = b.getAttribute('data-gen');
    b.disabled = true;
    b.innerHTML = '<span class="spinner"></span> Generating…';
    setTimeout(function () {
      const recs = getReportRecords(true);
      if (kind === 'savings') { savingsGenerated = true; renderSavingsSection(recs); }
      else { reviewGenerated = true; renderReviewSection(recs); }
    }, 60);
  });
});


/* Keep the frozen summary bar just under the (sticky) header */
document.addEventListener('DOMContentLoaded', function () {
  const tb = document.querySelector('.topbar');
  if (!tb) return;
  const setH = () => document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
  setH();
  window.addEventListener('resize', setH);
  window.addEventListener('load', setH);
  if (window.ResizeObserver) new ResizeObserver(setH).observe(tb);
});
