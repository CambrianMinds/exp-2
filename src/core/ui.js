import { AppState } from './state.js';
import { $, $$ } from './utils.js';

// Tab Navigation
export function switchTab(tabName) {
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  $$('.tab-panel').forEach(p => p.classList.remove('active'));
  const btn = $(`[data-tab="${tabName}"]`);
  const panel = $(`#tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');
}

// Bind click events on tab buttons
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Toast Notifications
export function showToast(message, type = 'info', duration = 4000) {
  const container = $('#toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  toast.addEventListener('click', () => toast.remove());
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Checklist Updates
export function updateChecklist() {
  const profileReady = Boolean(
    AppState.petitionerProfile?.fullName?.length > 0 &&
    (AppState.petitionerProfile?.streetAddress || AppState.petitionerProfile?.currentAddress)
  );
  const casesReady = Boolean(AppState.currentReport && AppState.currentReport.summary?.eligible > 0);
  const acksReady = Boolean(
    $('#ackOneShot')?.checked &&
    $('#ackAllCounties')?.checked &&
    $('#ackNotLawyer')?.checked &&
    $('#ackProSe')?.checked
  );
  const preflightReady = Boolean(
    (!$('#chkPreflight92Counties') || $('#chkPreflight92Counties').checked) &&
    (!$('#chkPreflightISP') || $('#chkPreflightISP').checked) &&
    (!$('#chkPreflightFines') || $('#chkPreflightFines').checked) &&
    (!$('#chkPreflightPending') || $('#chkPreflightPending').checked)
  );

  setChecklistItem('checkProfile', profileReady);
  setChecklistItem('checkCases', casesReady);
  setChecklistItem('checkBackendReady', true); // In-browser engine active
  setChecklistItem('checkAcknowledgments', acksReady);
  setChecklistItem('checkPreflight', preflightReady);

  // Enable generate and preview buttons only when ALL checks pass including legal acknowledgments and preflight checklist
  const allReady = profileReady && casesReady && acksReady && preflightReady;
  const generateBtn = $('#btnGenerate');
  if (generateBtn) {
    generateBtn.disabled = !allReady;
  }
  const previewBtn = $('#btnPreview');
  if (previewBtn) {
    previewBtn.disabled = !allReady;
  }

  updatePriorFilingsVisibility();
}

export function updatePriorFilingsVisibility() {
  const section1Callout = $('#priorFilingSection1Callout');
  const questionnaire = $('#priorFilingQuestionnaire');
  if (!section1Callout || !questionnaire) return;

  const selectedCountyCode = $('#selectCountyPacket')?.value;
  let casesToCheck = AppState.currentCases || [];
  if (selectedCountyCode && AppState.currentReport?.counties?.[selectedCountyCode]) {
    casesToCheck = AppState.currentReport.counties[selectedCountyCode].cases;
  }

  const eligibleCases = casesToCheck.filter(c => c.eligibility?.eligible);

  if (eligibleCases.length > 0) {
    const hasConvictions = eligibleCases.some(c => c.eligibility?.statute && c.eligibility.statute !== 'IC § 35-38-9-1');
    if (!hasConvictions) {
      // Exclusively Section 1 non-convictions!
      section1Callout.style.display = 'block';
      questionnaire.style.display = 'none';
      return;
    }
  }

  // Conviction tiers present or pending scan
  section1Callout.style.display = 'none';
  questionnaire.style.display = 'block';
}

export function setChecklistItem(id, ready) {
  const el = $(`#${id}`);
  if (!el) return;
  el.classList?.toggle('ready', ready);
  const icon = el.querySelector?.('.check-icon');
  if (icon) icon.textContent = ready ? '✓' : '○';
}
