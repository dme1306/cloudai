/* Savings UI: always return to the initial Generate solution state after filter changes. */
(function () {
  function resetSavingsView() {
    savingsGenerated = false;
    const results = document.getElementById('rptSavingsResults');
    const grid = document.getElementById('rptSavingsGrid');
    const button = document.querySelector('.gen-btn[data-gen="savings"]');
    if (results) results.hidden = true;
    if (grid) grid.innerHTML = '';
    if (button) {
      button.disabled = false;
      button.textContent = 'Generate solution';
    }

    // Yearly Review follows the same generate/reset lifecycle.
    reviewGenerated = false;
    const reviewResults = document.getElementById('rptYearReviewResults');
    const reviewList = document.getElementById('rptYearReviewList');
    const reviewButton = document.querySelector('.gen-btn[data-gen="review"]');
    if (reviewResults) reviewResults.hidden = true;
    if (reviewList) reviewList.innerHTML = '';
    if (reviewButton) {
      reviewButton.disabled = false;
      reviewButton.textContent = 'Generate review';
    }
  }

  function renderSavingsSection(recs) {
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
  }

  // Replace the original renderer with the simple one-button version.
  window.renderSavingsSection = renderSavingsSection;

  // Reset immediately whenever a year/company checkbox changes.
  document.addEventListener('change', function (event) {
    if (event.target.matches('.ms-panel input[type="checkbox"]')) {
      resetSavingsView();
    }
  }, true);

  // Reset for both Reset buttons and expense/account-group selection changes.
  document.addEventListener('click', function (event) {
    if (event.target.closest('#brandHome, #rptResetBtn, #resetBtn, #expApplyBtn, #expClearBtn, [data-unified-account], #expAnalysisTable tr[data-sel-kind]')) {
      resetSavingsView();
    }
  }, true);

  // If the report rerenders after a filter update, keep the initial state hidden.
  document.addEventListener('click', function (event) {
    if (event.target.closest('.gen-btn[data-gen="savings"]')) return;
  }, true);
})();