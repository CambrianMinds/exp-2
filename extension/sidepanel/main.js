import { AppState } from './state.js';
import { setupInputFormatting, loadProfile } from './profile.js';
import { checkBackend } from './generator.js';
import { checkPageStatus, updateBatchPanelUI, renderResults } from './scanner.js';
import { updateChecklist } from './ui.js';


export const SITE_GUIDE_URL = 'https://cambrianminds.github.io/expunger/#instructions';

// Auto-open site guide tab on first launch / first open of the extension
async function checkWelcomeGuide() {
  try {
    const data = await chrome?.storage?.local?.get('hasSeenWelcomeGuide');
    if (!data?.hasSeenWelcomeGuide) {
      await chrome?.storage?.local?.set({ hasSeenWelcomeGuide: true });
      chrome?.tabs?.create?.({ url: SITE_GUIDE_URL });
    }
  } catch (err) {
    console.debug('[Guide Auto-Open]', err);
  }
}

// Setup guide button click listeners
function setupGuideListeners() {
  const openGuide = () => {
    chrome?.tabs?.create?.({ url: SITE_GUIDE_URL });
  };
  document.getElementById('btnUserGuide')?.addEventListener('click', openGuide);
  document.getElementById('btnOpenGuideBanner')?.addEventListener('click', openGuide);
}

// Setup theme toggle listener with chrome.storage.local persistence
async function setupThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  async function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ theme });
      }
    } catch (e) {
      console.warn('Failed to save theme to storage:', e);
    }
    toggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    toggleBtn.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  }

  try {
    let savedTheme = localStorage.getItem('theme');
    if (!savedTheme && chrome?.storage?.local) {
      const stored = await chrome.storage.local.get('theme');
      if (stored?.theme) savedTheme = stored.theme;
    }
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch (e) {
    console.warn('Failed to retrieve theme from storage:', e);
  }

  toggleBtn.addEventListener('click', async () => {
    const current = getActiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    await setTheme(next);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
    let hasSaved = localStorage.getItem('theme');
    if (!hasSaved && chrome?.storage?.local) {
      const stored = await chrome.storage.local.get('theme');
      if (stored?.theme) hasSaved = stored.theme;
    }
    if (!hasSaved) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}

// ─── Initialization ────────────────────────────────────────────────
async function init() {
  // Bind guide and theme actions
  setupGuideListeners();
  await setupThemeToggle();
  await checkWelcomeGuide();

  // Load saved state & bind formatters
  setupInputFormatting();
  await loadProfile();
  await checkBackend();
  await checkPageStatus();

  // Load last scan results
  try {
    let lastScan = null;
    try {
      lastScan = await chrome?.runtime?.sendMessage?.({ action: 'loadLastScan' });
    } catch (e) {
      console.warn('Failed to request last scan from runtime:', e);
    }
    if (!lastScan?.scan) {
      const stored = localStorage.getItem('lastScanResults');
      if (stored) lastScan = { scan: JSON.parse(stored) };
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
  } catch (e) {
    console.warn('Failed to parse or apply last scan data:', e);
  }

  updateChecklist();

  // Periodic checks: poll page status to detect when user navigates MyCase tabs
  setInterval(checkPageStatus, 5000);
}

init();


