import { AppState } from './state.js';
import { setupInputFormatting, loadProfile } from './profile.js';
import { checkBackend } from './generator.js';
import { updateBatchPanelUI, renderResults } from './scanner.js';
import { updateChecklist } from './ui.js';

export const SITE_GUIDE_URL = 'https://cambrianminds.github.io/expunger/#instructions';

// Setup guide button click listeners
function setupGuideListeners() {
  const openGuide = () => {
    window.open(SITE_GUIDE_URL, '_blank', 'noopener,noreferrer');
  };
  document.getElementById('btnUserGuide')?.addEventListener('click', openGuide);
  document.getElementById('btnOpenGuideBanner')?.addEventListener('click', openGuide);
}

// Setup theme toggle listener (synchronizes with main landing page)
function setupThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    toggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    toggleBtn.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  }

  toggleBtn.addEventListener('click', () => {
    const current = getActiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}

// Setup Pro Se Disclaimer Entry Gate
function setupDisclaimerGate() {
  const gate = document.getElementById('disclaimerGate');
  const ackCheck = document.getElementById('gateAckCheck');
  const acceptBtn = document.getElementById('btnAcceptGate');
  if (!gate) return;

  const isAccepted = localStorage.getItem('expungement_pro_se_acknowledged');
  if (!isAccepted) {
    gate.style.display = 'flex';
  }

  ackCheck?.addEventListener('change', () => {
    if (acceptBtn) {
      acceptBtn.disabled = !ackCheck.checked;
    }
  });

  acceptBtn?.addEventListener('click', () => {
    if (!ackCheck?.checked) return;
    try {
      localStorage.setItem('expungement_pro_se_acknowledged', 'true');
    } catch (e) {
      console.warn('Unable to persist disclaimer acknowledgment in localStorage:', e);
    }
    gate.style.display = 'none';
  });
}

// ─── Initialization ────────────────────────────────────────────────
async function init() {
  // Bind guide, theme, and entry disclaimer actions
  setupGuideListeners();
  setupThemeToggle();
  setupDisclaimerGate();

  // Load saved state & bind formatters
  setupInputFormatting();
  await loadProfile();
  await checkBackend();

  // Load last imported/scan results from localStorage
  try {
    let lastScan = null;
    const stored = localStorage.getItem('lastScanResults');
    if (stored) {
      lastScan = { scan: JSON.parse(stored) };
    }
    if (lastScan?.scan) {
      AppState.currentCases = lastScan.scan.cases || [];
      AppState.currentReport = lastScan.scan.report || null;
      AppState.searchBatches = lastScan.scan.searchBatches || [];
      updateBatchPanelUI();
      if (AppState.currentReport) {
        renderResults();
      }
    }
  } catch (err) {
    console.debug('[Storage Init]', err);
  }

  updateChecklist();
}

init();
