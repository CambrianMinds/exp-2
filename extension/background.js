/**
 * Indiana Expungement Assistant - Background Service Worker
 * Manages sidepanel lifecycle, extension badge, and local API communication.
 */

// ─── Side Panel Configuration ──────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ─── Extension Icon Click: Open Side Panel ─────────────────────────────
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ─── Badge Management ──────────────────────────────────────────────────
function updateBadge(tabId, text, color = '#22c55e') {
  chrome.action.setBadgeText({ text: String(text), tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

// ─── Message Routing ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Content script loaded notification
  if (request.action === 'contentScriptLoaded') {
    if (sender.tab) {
      updateBadge(sender.tab.id, '✓', '#3b82f6');
    }
    return;
  }

  // Deep scrape progress relay (content → sidepanel)
  if (request.action === 'deepScrapeProgress') {
    // Forward to sidepanel (catch if sidepanel not open)
    try {
      chrome.runtime.sendMessage(request);
    } catch (e) {
      // Sidepanel may be closed, ignore silently
      console.debug('[Background] Sidepanel not available for deepScrapeProgress');
    }
    return;
  }

  // Check engine availability (in-browser client-side engine)
  if (request.action === 'checkBackend') {
    sendResponse({ success: true, clientSide: true });
    return;
  }

  // Save/load petitioner profile
  if (request.action === 'savePetitionerProfile') {
    chrome.storage.local.set({ petitionerProfile: request.profile }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'loadPetitionerProfile') {
    chrome.storage.local.get('petitionerProfile', (result) => {
      sendResponse({ success: true, profile: result.petitionerProfile || null });
    });
    return true;
  }

  // Save/load last scan results
  if (request.action === 'saveScanResults') {
    chrome.storage.local.set({
      lastScan: {
        timestamp: new Date().toISOString(),
        cases: request.cases,
        report: request.report,
        searchBatches: request.searchBatches || []
      }
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'loadLastScan') {
    chrome.storage.local.get('lastScan', (result) => {
      sendResponse({ success: true, scan: result.lastScan || null });
    });
    return true;
  }
});


// ─── Tab Update Listener ───────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('public.courts.in.gov/mycase')) {
    updateBadge(tabId, '', '#3b82f6');
  }
});

// ─── First Install: Open Site Guide ────────────────────────────────────
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'https://cambrianminds.github.io/expunger/#instructions'
    });
    chrome.storage.local.set({ hasSeenWelcomeGuide: true });
  }
});
