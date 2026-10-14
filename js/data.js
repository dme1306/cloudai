/* Replaces Code1.gs — the Worker reads the sheet and returns parsed JSON. */
(function () {
  async function getDashboardData(force) {
    const url = window.APP_CONFIG.DATA_URL + (force ? '?refresh=1' : '');
    const res = await fetch(url);
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  window.getDashboardData = getDashboardData;
})();
