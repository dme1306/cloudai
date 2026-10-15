/* Savings UI: keep the section minimal and require a fresh generation after filter changes. */
(function () {
  function resetSavingsView() {
    if (typeof savingsGenerated !== 'undefined') savingsGenerated = false;
    const results = document.getElementById('rptSavingsResults');
    const grid = document.getElementById('rptSavingsGrid');
    const button = document.querySelector('.gen-btn[data-gen="savings"]');
    if (results) results.hidden = true;
    if (grid) grid.innerHTML = '';
    if (button) {
      button.disabled = false;
      button.textContent = 'Generate solution';
    }
  }

  // Override the original renderer so the button label stays simple.
  if (typeof renderSavingsSection === 'function') {
    renderSavingsSection = function (recs) {
      const grid = document.getElementById('rptSavingsGrid');
      const results = document.getElementById('rptSavingsResults');
      const button = document.querySelector('.gen-btn[data-gen="savings"]');
      if (!grid) return;
      if (!savingsGenerated) {
        if (results) results.hidden = true;
        grid.innerHTML = '';
        if (button) {
          button.disabled = false;
          button.textContent = 'Generate solution';
        }
        return;
      }
      if (results) results.hidden = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Generate solution';
      }
      renderSavingsOpportunities(recs);
    };
  }

  // Capture filter and expense-type changes before the dashboard's own handlers run.
  document.addEventListener('change', function (event) {
    if (event.target.closest('#rptFyMs, #rptLocMs, #fyMs, #locMs')) resetSavingsView();
  }, true);

  document.addEventListener('click', function (event) {
    if (event.target.closest('#rptResetBtn, #resetBtn, #expApplyBtn, #expClearBtn, #rptUnifiedBody tr[data-unified-account], #expAnalysisTable tr')) {
      resetSavingsView();
    }
  }, true);
})();