/**
 * Indiana Expungement Assistant - Sidepanel Controller
 * Manages tab navigation, case display, profile persistence,
 * and orchestrates the scan → review → generate workflow.
 */

(() => {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────
  let currentCases = [];
  let currentReport = null;
  let searchBatches = [];
  let petitionerProfile = null;
  let backendOnline = false;
  const BACKEND_URLS = ['http://127.0.0.1:8000', 'http://localhost:8000'];
  let activeBackendUrl = BACKEND_URLS[0];

  // Holds the most recent scan result while the parity modal is displayed.
  // Cleared after confirmation or dismissal.
  let pendingScanResult = null;

  // ─── DOM References ────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Tab Navigation ────────────────────────────────────────────────
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ─── Date Utilities ────────────────────────────────────────────────
  /**
   * Safely convert a date value (Date object or ISO string) to an ISO string.
   * Handles the case where chrome.runtime.sendMessage serializes Date objects
   * to ISO strings, making .toISOString() throw a TypeError.
   */
  function safeISOString(dateValue) {
    if (!dateValue) return null;
    try {
      const d = new Date(dateValue);
      return d instanceof Date && !isNaN(d) ? d.toISOString() : null;
    } catch (_) {
      return null;
    }
  }

  // ─── Scraper Parity Modal ──────────────────────────────────────────
  /**
   * Show the parity confirmation modal after a scan.
   * Displays the extracted cases and asks the user to verify they match
   * what's on screen before merging into the accumulated batch.
   *
   * @param {Array}  cases        - Cases scraped from this scan
   * @param {string} searchContext - Human-readable label for this search (e.g. name/county)
   * @param {boolean} mergeMode   - Whether merge is enabled
   */
  function showParityModal(cases, searchContext, mergeMode) {
    pendingScanResult = { cases, searchContext, mergeMode };

    const countEl = $('#parityCaseCount');
    const listEl = $('#parityCaseList');

    if (countEl) countEl.textContent = cases.length;

    if (listEl) {
      listEl.innerHTML = '';
      if (cases.length === 0) {
        listEl.innerHTML = '<em style="font-size:0.7rem;color:var(--text-muted)">No cases found on this page.</em>';
      } else {
        cases.slice(0, 20).forEach(c => {
          const item = document.createElement('div');
          item.className = 'modal-case-item';
          item.innerHTML = `
            <span class="modal-case-num">${escapeHtml(c.case_number || 'Unknown')}</span>
            <span class="modal-case-type">${escapeHtml(c.case_type || '')}</span>
          `;
          listEl.appendChild(item);
        });
        if (cases.length > 20) {
          const overflow = document.createElement('div');
          overflow.style.fontSize = '0.68rem';
          overflow.style.color = 'var(--text-muted)';
          overflow.style.marginTop = '6px';
          overflow.textContent = `…and ${cases.length - 20} more case${cases.length - 20 === 1 ? '' : 's'}`;
          listEl.appendChild(overflow);
        }
      }
    }

    const modal = $('#parityModal');
    if (modal) modal.style.display = 'flex';
  }

  /**
   * Called when the user clicks "Go Back & Retry" in the parity modal.
   * Closes the modal and lets the user re-run the scan.
   */
  $('#btnParityRetry')?.addEventListener('click', () => {
    const modal = $('#parityModal');
    if (modal) modal.style.display = 'none';
    pendingScanResult = null;
    showToast('Re-run the scan when you\'re ready.', 'info', 3000);
  });

  /**
   * Called when the user confirms the cases match what they see on screen.
   * Merges the pending scan result into the accumulated case set.
   */
  $('#btnParityConfirm')?.addEventListener('click', () => {
    const modal = $('#parityModal');
    if (modal) modal.style.display = 'none';

    if (!pendingScanResult) return;
    const { cases: incomingCases, searchContext, mergeMode } = pendingScanResult;
    pendingScanResult = null;

    if (incomingCases.length === 0) return;

    if (mergeMode && currentCases.length > 0) {
      // Multi-search merge & de-duplication
      const existingMap = new Map();
      currentCases.forEach(c => {
        const k = (c.case_number || '').trim().toUpperCase();
        if (k) existingMap.set(k, c);
      });

      let newAdded = 0;
      let overlapped = 0;

      incomingCases.forEach(ic => {
        const k = (ic.case_number || '').trim().toUpperCase();
        if (!k) return;

        if (existingMap.has(k)) {
          const existing = existingMap.get(k);
          if (!existing.searchQueries) {
            existing.searchQueries = existing.searchContext ? [existing.searchContext] : [];
          }
          if (!existing.searchQueries.includes(searchContext)) {
            existing.searchQueries.push(searchContext);
          }
          if (!existing.charges && ic.charges) existing.charges = ic.charges;
          if (!existing.court && ic.court) existing.court = ic.court;
          if (!existing.status && ic.status) existing.status = ic.status;
          if (ic.caseToken && !existing.caseToken) existing.caseToken = ic.caseToken;
          overlapped++;
        } else {
          ic.searchQueries = [searchContext];
          currentCases.push(ic);
          existingMap.set(k, ic);
          newAdded++;
        }
      });

      searchBatches.push({
        query: searchContext,
        count: incomingCases.length,
        timestamp: Date.now()
      });

      if (window.IndianaExpungement?.analyzeAll) {
        currentReport = window.IndianaExpungement.analyzeAll(currentCases);
      }

      showToast(
        newAdded > 0
          ? `Parity confirmed. Merged ${newAdded} new cases (${overlapped} already in batch). Total: ${currentCases.length} cases.`
          : `Parity confirmed. All ${overlapped} cases already in batch. Total: ${currentCases.length} cases.`,
        'success',
        5000
      );
    } else {
      // Fresh scan (or merge disabled)
      currentCases = incomingCases;
      currentCases.forEach(c => {
        c.searchQueries = [searchContext];
      });
      searchBatches = [{
        query: searchContext,
        count: incomingCases.length,
        timestamp: Date.now()
      }];
      currentReport = window.IndianaExpungement?.analyzeAll
        ? window.IndianaExpungement.analyzeAll(currentCases)
        : null;

      showToast(`Parity confirmed. Found ${incomingCases.length} cases.`, 'success');
    }

    checkAndSuggestAlias(searchContext);
    updateBatchPanelUI();
    renderResults();

    chrome.runtime.sendMessage({
      action: 'saveScanResults',
      cases: currentCases,
      report: currentReport,
      searchBatches: searchBatches
    });

    $('#btnDeepScrape').disabled = false;
    switchTab('results');
    updateChecklist();
  });

  // ─── Toast Notifications ───────────────────────────────────────────
  function showToast(message, type = 'info', duration = 4000) {
    const container = $('#toastContainer');
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

  // ─── Multi-Search Batch & UI State ─────────────────────────────────
  function updateBatchPanelUI() {
    const batchPanel = $('#batchPanel');
    const badge = $('#batchBadge');
    const pagesCount = $('#batchPagesCount');
    const tagsContainer = $('#batchSearchTags');
    const resultsCountPill = $('#resultsCountPill');
    const resultsSearchesPill = $('#resultsSearchesPill');

    const totalCases = currentCases.length;
    const totalSearches = searchBatches.length;

    if (totalCases > 0 || totalSearches > 0) {
      if (batchPanel) batchPanel.style.display = 'block';
      if (badge) badge.textContent = `${totalCases} Cases Accumulated`;
      if (pagesCount) {
        pagesCount.textContent = totalSearches > 0
          ? `(across ${totalSearches} search${totalSearches === 1 ? '' : 'es'})`
          : '';
      }

      if (tagsContainer) {
        tagsContainer.innerHTML = '';
        searchBatches.forEach(b => {
          const tag = document.createElement('span');
          tag.className = 'batch-tag';
          tag.innerHTML = `🔍 ${escapeHtml(b.query)} <span class="batch-tag-count">${b.count}</span>`;
          tagsContainer.appendChild(tag);
        });
      }
    } else {
      if (batchPanel) batchPanel.style.display = 'none';
      if (tagsContainer) tagsContainer.innerHTML = '';
    }

    if (resultsCountPill) {
      resultsCountPill.textContent = `${totalCases} Cases`;
    }
    if (resultsSearchesPill) {
      resultsSearchesPill.textContent = totalSearches > 0
        ? `from ${totalSearches} search${totalSearches === 1 ? '' : 'es'}`
        : '';
    }
  }

  // Clear all accumulated scans
  $('#btnClearScans')?.addEventListener('click', () => {
    if (currentCases.length > 0 && !confirm('Clear all accumulated cases and searches to start fresh?')) {
      return;
    }
    currentCases = [];
    currentReport = null;
    searchBatches = [];

    chrome.runtime.sendMessage({
      action: 'saveScanResults',
      cases: [],
      report: null,
      searchBatches: []
    });

    updateBatchPanelUI();
    $('#resultsContent').style.display = 'none';
    $('#noResults').style.display = 'block';
    $('#resultsBadge').style.display = 'none';
    $('#btnDeepScrape').disabled = true;
    updateChecklist();
    showToast('Accumulated cases cleared. You can start a fresh search.', 'info', 3500);
  });

  // Jump from Results back to Scan to add another name / county
  $('#btnScanAnotherPage')?.addEventListener('click', () => {
    switchTab('scan');
    showToast('💡 Search MyCase for another maiden name, married name, or county, then click Scan.', 'info', 5000);
    const scanBtn = $('#btnScan');
    if (scanBtn) {
      scanBtn.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Auto-suggest aliases from search queries (IC § 35-38-9-8(b)(1))
  function checkAndSuggestAlias(query) {
    if (!query || query === 'MyCase Search' || query.length < 3) return;
    const aliasesInput = $('#aliases');
    const currentAliases = (aliasesInput?.value || petitionerProfile?.aliases || '').trim();
    const fullName = ($('#fullName')?.value || petitionerProfile?.fullName || '').trim().toLowerCase();

    // Clean query text
    const cleanQuery = query.replace(/[^\w\s,'-]/g, '').trim();
    if (!cleanQuery) return;

    // If query has comma, e.g. "Smith, Jane", convert to "Jane Smith"
    let naturalName = cleanQuery;
    if (cleanQuery.includes(',')) {
      const parts = cleanQuery.split(',').map(s => s.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        naturalName = `${parts[1]} ${parts[0]}`;
      }
    }

    const normNat = naturalName.toLowerCase();
    if (fullName && !fullName.includes(normNat) && !normNat.includes(fullName)) {
      if (!currentAliases.toLowerCase().includes(normNat)) {
        if (aliasesInput && !aliasesInput.value.trim()) {
          aliasesInput.value = naturalName;
          showToast(`💡 Suggested "${naturalName}" for Petitioner Aliases (IC § 35-38-9-8(b)(1))`, 'info', 5000);
        } else if (aliasesInput && !aliasesInput.value.includes(naturalName)) {
          aliasesInput.value = `${aliasesInput.value}, ${naturalName}`;
          showToast(`💡 Added "${naturalName}" to Petitioner Aliases`, 'info', 5000);
        }
      }
    }
  }

  // ─── Page Status Check ─────────────────────────────────────────────
  async function checkPageStatus() {
    const statusDot = $('#pageStatusIndicator .status-dot');
    const statusText = $('#pageStatusText');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url?.includes('public.courts.in.gov/mycase')) {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Navigate to mycase.in.gov to begin';
        return false;
      }

      // Try messaging the content script; reinject transparently if missing
      let response = null;
      try {
        response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageStatus' });
      } catch (e) {
        if (await ensureContentScript(tab.id)) {
          try {
            response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageStatus' });
          } catch (_) { /* fall through */ }
        }
      }

      if (response?.isSearchResults) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'MyCase search results detected ✓';
        return true;
      } else if (response?.isCaseSummary) {
        statusDot.className = 'status-dot checking';
        statusText.textContent = 'On case summary page — go to search results';
        return false;
      } else if (response) {
        statusDot.className = 'status-dot checking';
        statusText.textContent = 'On MyCase — navigate to search results';
        return false;
      } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Content script not loaded — refresh the MyCase page';
        return false;
      }
    } catch (e) {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Content script not loaded — refresh the MyCase page';
      return false;
    }
  }

  // ─── Backend Health Check ──────────────────────────────────────────
  async function checkBackend(showFeedback = false) {
    const statusEl = $('#backendStatus');
    const dot = statusEl.querySelector('.status-dot');
    const label = statusEl.querySelector('.status-label');
    dot.className = 'status-dot checking';
    if (label) label.textContent = 'Checking...';

    let online = false;
    let details = null;

    // 1. Try checking via background service worker
    try {
      const bgResult = await chrome.runtime.sendMessage({ action: 'checkBackend' });
      if (bgResult?.success) {
        online = true;
        details = bgResult.status;
        activeBackendUrl = bgResult.url || activeBackendUrl;
      }
    } catch (_) {
      // Service worker may be idle or transitioning
    }

    // 2. Direct fetch fallback from sidepanel (uses host_permissions for localhost)
    if (!online) {
      for (const host of ['http://127.0.0.1:8000', 'http://localhost:8000']) {
        try {
          const res = await fetch(`${host}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(1800)
          });
          if (res.ok) {
            online = true;
            details = await res.json();
            activeBackendUrl = host;
            break;
          }
        } catch (_) {}
      }
    }

    backendOnline = online;
    dot.className = `status-dot ${backendOnline ? 'online' : 'offline'}`;
    if (label) {
      label.textContent = backendOnline ? 'Backend Online' : 'Backend Offline';
    }
    statusEl.title = backendOnline
      ? 'Local Form Engine is running and ready (http://127.0.0.1:8000)'
      : 'Form Engine offline. Click to retry or launch: python backend/app.py';

    updateChecklist();

    if (showFeedback) {
      if (backendOnline) {
        showToast('✓ Form Engine detected at http://127.0.0.1:8000', 'success', 3000);
      } else {
        showToast('Backend offline. Run: python backend/app.py', 'error', 4000);
      }
    }

    return backendOnline;
  }

  async function generatePacketViaBackend(payload) {
    const healthCheck = await checkBackend(false);
    if (!healthCheck) {
      throw new Error('Backend offline. Run: python backend/app.py');
    }

    const targetUrl = activeBackendUrl;
    const response = await fetch(`${targetUrl}/api/generate-expungement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error ${response.status}: ${errorText}`);
    }

    return response.blob();
  }

  async function downloadPetition(blob, filename) {
    if (!chrome.downloads?.download) {
      throw new Error('Chrome downloads permission is unavailable.');
    }

    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url,
        filename,
        saveAs: true
      }, (downloadId) => {
        URL.revokeObjectURL(url);

        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(downloadId);
      });
    });
  }

  // Click on backend status pill to manually refresh / retry
  $('#backendStatus')?.addEventListener('click', () => {
    checkBackend(true);
  });
  $('#backendStatus')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      checkBackend(true);
    }
  });

  // ─── Helper: check content script is alive on the active MyCase tab ───
  async function ensureContentScript(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'getPageStatus' });
      return true;
    } catch (e) {
      // Content script missing — try to reinject via scripting API
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['eligibility.js', 'content.js']
        });
        // Poll until the content script's message listener is ready, or give up after ~3s
        const maxAttempts = 15;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 200));
          try {
            await chrome.tabs.sendMessage(tabId, { action: 'getPageStatus' });
            return true; // Content script is ready and responding
          } catch (_) {
            // Not ready yet — loop will retry
          }
        }
        console.warn(`ensureContentScript: content script did not respond after ${maxAttempts} attempts`);
        return false;
      } catch (_) {
        return false;
      }
    }
  }

  // ─── Scan Action (Supports Multi-Page Merge for Maiden/Aliases) ──────
  $('#btnScan').addEventListener('click', async () => {
    const btn = $('#btnScan');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Scanning...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      // Verify we're on a MyCase page
      if (!tab.url?.includes('public.courts.in.gov/mycase')) {
        throw new Error('Not on a MyCase page — navigate to https://public.courts.in.gov/mycase first');
      }

      // Ensure content script is loaded (auto-reinjects if necessary)
      const scriptReady = await ensureContentScript(tab.id);
      if (!scriptReady) {
        throw new Error('Could not load the content script — please refresh the MyCase page');
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'analyzeEligibility' });

      if (response?.success) {
        const incomingCases = response.cases || [];
        const searchContext = response.searchContext || 'MyCase Search';
        const mergeMode = $('#chkMergeCases')?.checked ?? true;

        if (incomingCases.length === 0) {
          showToast('No case records found on this MyCase page.', 'warning', 4000);
          return;
        }

        // Show parity modal so the user can verify extracted cases before merging.
        // Merge and UI update are deferred until the user confirms via #btnParityConfirm.
        showParityModal(incomingCases, searchContext, mergeMode);
        return;
      } else {
        throw new Error(response?.error || 'Scan failed');
      }
    } catch (e) {
      // Friendly message for the common "receiving end does not exist" case
      if (e.message?.includes('Receiving end does not exist') || e.message?.includes('Could not establish connection')) {
        showToast('Content script not responding — refresh the MyCase page and try again', 'error', 6000);
      } else {
        showToast(e.message, 'error');
      }
      console.error('[Sidepanel] Scan error:', e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Scan Page & Check Eligibility
      `;
    }
  });

  // ─── Deep Scrape Action ────────────────────────────────────────────
  $('#btnDeepScrape').addEventListener('click', async () => {
    const btn = $('#btnDeepScrape');
    btn.disabled = true;

    const progress = $('#scanProgress');
    const progressFill = $('#progressFill');
    const progressText = $('#progressText');
    progress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Starting deep scrape...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      if (!tab.url?.includes('public.courts.in.gov/mycase')) {
        throw new Error('Not on a MyCase page — navigate to https://public.courts.in.gov/mycase first');
      }

      const scriptReady = await ensureContentScript(tab.id);
      if (!scriptReady) {
        throw new Error('Could not load the content script — please refresh the MyCase page');
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'deepScrape' });

      if (response?.success) {
        currentCases = response.cases;
        currentReport = response.report;
        renderResults();
        showToast('Deep scrape complete — CCS details enriched', 'success');
        progressFill.style.width = '100%';
        progressText.textContent = 'Complete!';

        chrome.runtime.sendMessage({
          action: 'saveScanResults',
          cases: currentCases,
          report: currentReport
        });
      } else {
        throw new Error(response?.error || 'Deep scrape failed');
      }
    } catch (e) {
      if (e.message?.includes('Receiving end does not exist') || e.message?.includes('Could not establish connection')) {
        showToast('Content script not responding — refresh the MyCase page and try again', 'error', 6000);
      } else {
        showToast(e.message, 'error');
      }
    } finally {
      btn.disabled = false;
      setTimeout(() => { progress.style.display = 'none'; }, 2000);
    }
  });

  // ─── Deep Scrape Progress Listener ─────────────────────────────────
  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'deepScrapeProgress') {
        const pct = Math.round((request.current / request.total) * 100);
        $('#progressFill').style.width = `${pct}%`;
        $('#progressText').textContent = `Fetching CCS ${request.current}/${request.total}: ${request.caseNum}`;
      }
    });
  }

  // ─── Render Results ────────────────────────────────────────────────
  function renderResults() {
    if (!currentReport) return;

    $('#noResults').style.display = 'none';
    $('#resultsContent').style.display = 'block';

    const s = currentReport.summary;
    $('#summaryEligible').textContent = s.eligible;
    $('#summaryIneligible').textContent = s.ineligible;
    $('#summaryExcluded').textContent = s.excluded;
    $('#summaryFee').textContent = s.totalFilingFee ? `~$${s.totalFilingFee}` : '$0';

    // Update badge & results header pills
    const badge = $('#resultsBadge');
    badge.style.display = 'inline-flex';
    badge.textContent = currentCases.length;

    const resultsCountPill = $('#resultsCountPill');
    const resultsSearchesPill = $('#resultsSearchesPill');
    if (resultsCountPill) resultsCountPill.textContent = `${currentCases.length} Cases`;
    if (resultsSearchesPill) {
      const numSearches = searchBatches.length || 1;
      resultsSearchesPill.textContent = `from ${numSearches} search${numSearches === 1 ? '' : 'es'}`;
    }

    // Statute breakdown
    const breakdownEl = $('#statuteBreakdown');
    breakdownEl.innerHTML = '';
    for (const [statute, count] of Object.entries(s.byStatute)) {
      const tag = document.createElement('span');
      tag.className = 'statute-tag';
      tag.innerHTML = `${escapeHtml(statute)} <span class="statute-tag-count">${count}</span>`;
      breakdownEl.appendChild(tag);
    }

    // Multi-county detection & selector
    const countySelectCard = $('#countySelectCard');
    const countySelectDropdown = $('#selectCountyPacket');
    const counties = currentReport.counties ? Object.entries(currentReport.counties) : [];

    if (countySelectCard && countySelectDropdown) {
      if (counties.length > 1) {
        countySelectCard.style.display = 'block';
        countySelectDropdown.innerHTML = '';
        counties.forEach(([code, cData]) => {
          const eligCount = cData.cases.filter(c => c.eligibility?.eligible).length;
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = `${cData.courtName || ('County ' + code)} (${eligCount} eligible of ${cData.cases.length} cases)`;
          countySelectDropdown.appendChild(opt);
        });
      } else {
        countySelectCard.style.display = 'none';
      }
    }

    // Case list
    const listEl = $('#caseList');
    listEl.innerHTML = '';

    // Flatten all county cases
    const allCases = [];
    for (const county of Object.values(currentReport.counties)) {
      for (const c of county.cases) {
        allCases.push(c);
      }
    }

    // Sort: eligible first, then by case number
    allCases.sort((a, b) => {
      const aElig = a.eligibility?.eligible ? 0 : 1;
      const bElig = b.eligibility?.eligible ? 0 : 1;
      if (aElig !== bElig) return aElig - bElig;
      return (a.case_number || '').localeCompare(b.case_number || '');
    });

    for (const c of allCases) {
      listEl.appendChild(createCaseCard(c));
    }
  }

  function excludeCase(caseNum) {
    if (!caseNum) return;
    const idx = currentCases.findIndex(c => (c.case_number || '').trim().toUpperCase() === caseNum.trim().toUpperCase());
    if (idx === -1) return;

    currentCases.splice(idx, 1);

    if (window.IndianaExpungement?.analyzeAll) {
      currentReport = window.IndianaExpungement.analyzeAll(currentCases);
    }

    chrome.runtime.sendMessage({
      action: 'saveScanResults',
      cases: currentCases,
      report: currentReport,
      searchBatches: searchBatches
    });

    updateBatchPanelUI();
    renderResults();
    updateChecklist();
    showToast(`Excluded ${caseNum} from filing. Eligibility recalculated.`, 'info', 3500);
  }

  function createCaseCard(caseData) {
    const el = caseData.eligibility;
    const card = document.createElement('div');
    card.className = 'case-card';

    // Badge
    let badgeClass = 'excluded';
    let badgeText = 'EXCLUDED';
    if (el) {
      if (el.eligible) {
        badgeClass = 'eligible';
        badgeText = 'ELIGIBLE';
      } else if (el.statute === 'N/A') {
        badgeClass = 'excluded';
        badgeText = 'CIVIL';
      } else if (el.isPending) {
        badgeClass = 'pending';
        badgeText = 'PENDING';
      } else {
        badgeClass = 'ineligible';
        badgeText = 'NOT ELIGIBLE';
      }
    }

    const chargesDisplay = caseData.charges || caseData.case_type || 'No charges listed';
    const typeCode = el?.typeCode || '';
    const searchQueriesDisplay = caseData.searchQueries?.length
      ? caseData.searchQueries.join(' · ')
      : (caseData.searchContext || '');

    card.innerHTML = `
      <div class="case-card-header">
        <span class="case-number">${escapeHtml(caseData.case_number || '')}</span>
        <div class="case-card-header-actions">
          <span class="case-badge ${badgeClass}">${badgeText}</span>
          <button type="button" class="btn-remove-case" title="Exclude this case from petition (e.g. maiden name mismatch / not you)">&times; Exclude</button>
        </div>
      </div>
      ${searchQueriesDisplay ? `<div class="case-search-tag">🔍 Found via: ${escapeHtml(searchQueriesDisplay)}</div>` : ''}
      <div class="case-charges">${escapeHtml(chargesDisplay)}</div>
      <div class="case-meta">
        <span>${escapeHtml(typeCode)}</span>
        <span>Filed: ${escapeHtml(caseData.filed || 'N/A')}</span>
        <span>${escapeHtml(caseData.court || '')}</span>
      </div>
      <div class="case-detail">
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">${escapeHtml(caseData.status || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Statute</span>
          <span class="detail-value statute">${escapeHtml(el?.statute || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Years Elapsed</span>
          <span class="detail-value">${el?.yearsElapsed ?? 'N/A'} years</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Waiting Period</span>
          <span class="detail-value">${el?.waitingPeriod ? `≥${el.waitingPeriod} years` : 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Grant Type</span>
          <span class="detail-value">${escapeHtml(el?.grantType || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Reason</span>
          <span class="detail-value">${escapeHtml(el?.reason || '')}</span>
        </div>
        ${el?.warnings?.length ? `
          <div class="case-warnings">
            ${el.warnings.map(w => `<span class="warning-tag">⚠ ${escapeHtml(w)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    card.addEventListener('click', () => card.classList.toggle('expanded'));
    card.querySelector('.btn-remove-case')?.addEventListener('click', (e) => {
      e.stopPropagation();
      excludeCase(caseData.case_number);
    });

    return card;
  }

  // ─── Profile Form ──────────────────────────────────────────────────
  const profileForm = $('#profileForm');
  const addressContainer = $('#addressHistory');

  // Load saved profile
  async function loadProfile() {
    try {
      const result = await chrome?.runtime?.sendMessage?.({ action: 'loadPetitionerProfile' });
      if (result?.profile) {
        petitionerProfile = result.profile;
        fillProfileForm(result.profile);
      } else {
        addAddressEntry(); // Start with one empty entry
      }
    } catch (_) {
      addAddressEntry();
    }
    updateChecklist();
  }

  // ─── Input Formatting & Validation Helpers ─────────────────────────
  function formatSSN(val) {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  function formatDL(val) {
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
    if (clean.length <= 4) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6)}`;
  }

  function formatPhone(val) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function formatZIP(val) {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function setFieldError(fieldId, errorMsg) {
    const input = $(`#${fieldId}`);
    const errSpan = $(`#err-${fieldId}`);
    if (input) {
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
    }
    if (errSpan) {
      errSpan.textContent = errorMsg;
      errSpan.classList.add('active');
    }
  }

  function clearFieldError(fieldId) {
    const input = $(`#${fieldId}`);
    const errSpan = $(`#err-${fieldId}`);
    if (input) {
      input.classList.remove('is-invalid');
      if (input.value.trim().length > 0) {
        input.classList.add('is-valid');
      } else {
        input.classList.remove('is-valid');
      }
    }
    if (errSpan) {
      errSpan.textContent = '';
      errSpan.classList.remove('active');
    }
  }

  // Set up real-time mask formatters and toggle buttons
  function setupInputFormatting() {
    const ssnInput = $('#ssn');
    const dlInput = $('#driverLicense');
    const phoneInput = $('#phone');
    const dobInput = $('#dob');
    const zipInput = $('#zipCode');
    const toggleSSN = $('#btnToggleSSN');

    // DOB age constraint (at least 18 years old)
    if (dobInput) {
      const today = new Date();
      const maxYear = today.getFullYear() - 18;
      const maxMonth = String(today.getMonth() + 1).padStart(2, '0');
      const maxDay = String(today.getDate()).padStart(2, '0');
      dobInput.max = `${maxYear}-${maxMonth}-${maxDay}`;
      dobInput.min = '1900-01-01';

      dobInput.addEventListener('change', () => {
        validateField('dob');
      });
    }

    // SSN format as user types
    if (ssnInput) {
      ssnInput.addEventListener('input', (e) => {
        e.target.value = formatSSN(e.target.value);
        clearFieldError('ssn');
      });
      ssnInput.addEventListener('blur', () => validateField('ssn'));
    }

    // Toggle SSN visibility
    if (toggleSSN && ssnInput) {
      toggleSSN.addEventListener('click', () => {
        const isPass = ssnInput.type === 'password';
        ssnInput.type = isPass ? 'text' : 'password';
        toggleSSN.textContent = isPass ? '🔒' : '👁';
      });
    }

    // DL format as user types
    if (dlInput) {
      dlInput.addEventListener('input', (e) => {
        e.target.value = formatDL(e.target.value);
        clearFieldError('driverLicense');
      });
      dlInput.addEventListener('blur', () => validateField('driverLicense'));
    }

    // ZIP format as user types
    if (zipInput) {
      zipInput.addEventListener('input', (e) => {
        e.target.value = formatZIP(e.target.value);
        clearFieldError('zipCode');
      });
      zipInput.addEventListener('blur', () => validateField('zipCode'));
    }

    // Phone format as user types
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        e.target.value = formatPhone(e.target.value);
        clearFieldError('phone');
      });
      phoneInput.addEventListener('blur', () => validateField('phone'));
    }

    // Full name, street address, city, state, email live checks
    $('#fullName')?.addEventListener('blur', () => validateField('fullName'));
    $('#streetAddress')?.addEventListener('blur', () => validateField('streetAddress'));
    $('#city')?.addEventListener('blur', () => validateField('city'));
    $('#state')?.addEventListener('change', () => validateField('state'));
    $('#email')?.addEventListener('blur', () => validateField('email'));
  }

  function validateField(fieldId) {
    const input = $(`#${fieldId}`);
    if (!input) return true;
    const val = input.value.trim();

    if (fieldId === 'fullName') {
      if (!val) {
        setFieldError('fullName', 'Full legal name is required');
        return false;
      }
      const words = val.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        setFieldError('fullName', 'Please enter full first and last name');
        return false;
      }
      if (!/^[A-Za-z\s.'-]+$/.test(val)) {
        setFieldError('fullName', 'Name contains invalid characters');
        return false;
      }
      clearFieldError('fullName');
      return true;
    }

    if (fieldId === 'dob') {
      if (!val) {
        setFieldError('dob', 'Date of birth is required');
        return false;
      }
      const d = new Date(val + 'T00:00:00');
      if (isNaN(d.getTime())) {
        setFieldError('dob', 'Invalid date format');
        return false;
      }
      const today = new Date();
      if (d > today) {
        setFieldError('dob', 'DOB cannot be in the future');
        return false;
      }
      const ageYears = (today - d) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 18) {
        setFieldError('dob', 'Petitioner must be at least 18 years old');
        return false;
      }
      if (ageYears > 120) {
        setFieldError('dob', 'Please enter a valid birth year');
        return false;
      }
      clearFieldError('dob');
      return true;
    }

    if (fieldId === 'ssn') {
      if (!val) {
        setFieldError('ssn', 'SSN is required for the confidential ACR form');
        return false;
      }
      if (!/^\d{3}-\d{2}-\d{4}$/.test(val)) {
        setFieldError('ssn', 'Must be a 9-digit SSN (XXX-XX-XXXX)');
        return false;
      }
      if (val === '000-00-0000') {
        setFieldError('ssn', 'Invalid SSN');
        return false;
      }
      clearFieldError('ssn');
      return true;
    }

    if (fieldId === 'driverLicense') {
      if (!val) {
        clearFieldError('driverLicense');
        return true; // Optional on some pleadings
      }
      // Indiana DL: 10 digits formatted as XXXX-XX-XXXX or 9-10 alphanumeric
      const clean = val.replace(/[^A-Za-z0-9]/g, '');
      if (clean.length < 9 || clean.length > 10) {
        setFieldError('driverLicense', 'Indiana DL must be 9–10 digits (XXXX-XX-XXXX)');
        return false;
      }
      clearFieldError('driverLicense');
      return true;
    }

    if (fieldId === 'streetAddress') {
      if (!val) {
        setFieldError('streetAddress', 'Street address is required');
        return false;
      }
      if (val.length < 4) {
        setFieldError('streetAddress', 'Please enter a valid street address');
        return false;
      }
      clearFieldError('streetAddress');
      return true;
    }

    if (fieldId === 'city') {
      if (!val) {
        setFieldError('city', 'City is required');
        return false;
      }
      if (!/^[A-Za-z\s.'-]+$/.test(val)) {
        setFieldError('city', 'City contains invalid characters');
        return false;
      }
      clearFieldError('city');
      return true;
    }

    if (fieldId === 'state') {
      if (!val) {
        setFieldError('state', 'State is required');
        return false;
      }
      clearFieldError('state');
      return true;
    }

    if (fieldId === 'zipCode') {
      if (!val) {
        setFieldError('zipCode', 'ZIP code is required');
        return false;
      }
      const clean = val.replace(/\D/g, '');
      if (clean.length !== 5 && clean.length !== 9) {
        setFieldError('zipCode', 'Must be 5 or 9 digits (XXXXX or XXXXX-XXXX)');
        return false;
      }
      clearFieldError('zipCode');
      return true;
    }

    if (fieldId === 'phone') {
      if (!val) {
        clearFieldError('phone');
        return true; // Optional
      }
      if (!/^\(\d{3}\)\s\d{3}-\d{4}$/.test(val)) {
        setFieldError('phone', 'Must be a complete 10-digit number: (XXX) XXX-XXXX');
        return false;
      }
      clearFieldError('phone');
      return true;
    }

    if (fieldId === 'email') {
      if (!val) {
        clearFieldError('email');
        return true; // Optional
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        setFieldError('email', 'Please enter a valid email address');
        return false;
      }
      clearFieldError('email');
      return true;
    }

    return true;
  }

  function fillProfileForm(profile) {
    if (profile.fullName) $('#fullName').value = profile.fullName;
    if (profile.aliases) $('#aliases').value = profile.aliases;
    if (profile.dob) $('#dob').value = profile.dob;
    if (profile.ssn) $('#ssn').value = formatSSN(profile.ssn);
    if (profile.driverLicense) $('#driverLicense').value = formatDL(profile.driverLicense);
    if (profile.streetAddress) $('#streetAddress').value = profile.streetAddress;
    if (profile.city) $('#city').value = profile.city;
    if (profile.state) $('#state').value = profile.state;
    if (profile.zipCode) $('#zipCode').value = formatZIP(profile.zipCode);

    // Fallback if legacy profile only had single currentAddress
    if (!profile.streetAddress && profile.currentAddress) {
      const match = profile.currentAddress.match(/^([^,]+),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (match) {
        $('#streetAddress').value = match[1].trim();
        $('#city').value = match[2].trim();
        $('#state').value = match[3].toUpperCase().trim();
        $('#zipCode').value = match[4].trim();
      } else {
        $('#streetAddress').value = profile.currentAddress;
      }
    }

    if (profile.phone) $('#phone').value = formatPhone(profile.phone);
    if (profile.email) $('#email').value = profile.email;

    // Addresses
    addressContainer.innerHTML = '';
    if (profile.addresses && profile.addresses.length > 0) {
      profile.addresses.forEach(addr => addAddressEntry(addr));
    } else {
      addAddressEntry();
    }
  }

  function escapeAttr(value) {
    return escapeHtml(String(value ?? '')).replace(/"/g, '&quot;');
  }

  function parseAddressEntry(value = '') {
    if (typeof value === 'object' && value !== null) {
      return {
        street: value.street || value.streetAddress || '',
        city: value.city || '',
        state: value.state || 'IN',
        zipCode: value.zipCode || value.zip || '',
        fromDate: value.fromDate || value.from || '',
        toDate: value.toDate || value.to || ''
      };
    }

    const parsed = {
      street: '',
      city: '',
      state: 'IN',
      zipCode: '',
      fromDate: '',
      toDate: ''
    };
    let text = String(value || '').trim();
    const datesMatch = text.match(/\(([^)]*)\)\s*$/);

    if (datesMatch) {
      const dates = datesMatch[1].split(/\s*(?:-|to|through)\s*/i).filter(Boolean);
      parsed.fromDate = dates[0] || datesMatch[1];
      parsed.toDate = dates[1] || '';
      text = text.slice(0, datesMatch.index).trim();
    }

    const stateZipMatch = text.match(/,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
    if (!stateZipMatch) {
      parsed.street = text;
      return parsed;
    }

    parsed.state = stateZipMatch[1].toUpperCase();
    parsed.zipCode = stateZipMatch[2];

    const beforeState = text.slice(0, stateZipMatch.index).trim();
    const cityBreak = beforeState.lastIndexOf(',');
    if (cityBreak >= 0) {
      parsed.street = beforeState.slice(0, cityBreak).trim();
      parsed.city = beforeState.slice(cityBreak + 1).trim();
    } else {
      parsed.street = beforeState;
    }

    return parsed;
  }

  function getStateOptionsHtml(selectedState = 'IN') {
    const stateSelect = $('#state');
    const selected = String(selectedState || 'IN').toUpperCase();

    return Array.from(stateSelect?.options || []).map(option => {
      const value = option.value;
      const disabled = option.disabled ? ' disabled' : '';
      const isSelected = value === selected ? ' selected' : '';
      return `<option value="${escapeAttr(value)}"${disabled}${isSelected}>${escapeHtml(option.textContent)}</option>`;
    }).join('');
  }

  function formatAddressLine(address) {
    const street = address.street.trim();
    const city = address.city.trim();
    const state = address.state.trim();
    const zip = address.zipCode.trim();

    return [
      street,
      city,
      `${state} ${zip}`.trim()
    ].filter(Boolean).join(', ');
  }

  function addAddressEntry(value = '') {
    const address = parseAddressEntry(value);
    const entry = document.createElement('div');
    entry.className = 'address-entry';
    entry.innerHTML = `
      <div class="address-fields">
        <input type="text" class="address-street" placeholder="Street address" value="${escapeAttr(address.street)}" autocomplete="street-address">
        <div class="address-grid">
          <input type="text" class="address-city" placeholder="City" value="${escapeAttr(address.city)}" autocomplete="address-level2">
          <select class="address-state" autocomplete="address-level1">${getStateOptionsHtml(address.state)}</select>
          <input type="text" class="address-zip" placeholder="ZIP" maxlength="10" value="${escapeAttr(formatZIP(address.zipCode))}" autocomplete="postal-code">
          <input type="text" class="address-from" placeholder="From" value="${escapeAttr(address.fromDate)}">
          <input type="text" class="address-to" placeholder="To / Present" value="${escapeAttr(address.toDate)}">
        </div>
      </div>
      <button type="button" class="btn-remove" title="Remove">&times;</button>
    `;
    entry.querySelector('.address-zip')?.addEventListener('input', (e) => {
      e.target.value = formatZIP(e.target.value);
    });
    entry.querySelector('.btn-remove').addEventListener('click', () => {
      entry.remove();
    });
    addressContainer.appendChild(entry);
  }

  $('#btnAddAddress').addEventListener('click', () => addAddressEntry());

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Enforce validation on all fields
    const fieldsToValidate = [
      'fullName', 'dob', 'ssn', 'driverLicense',
      'streetAddress', 'city', 'state', 'zipCode',
      'phone', 'email'
    ];
    let firstInvalid = null;
    let hasError = false;

    for (const f of fieldsToValidate) {
      const isValid = validateField(f);
      if (!isValid) {
        hasError = true;
        if (!firstInvalid) firstInvalid = $(`#${f}`);
      }
    }

    if (hasError) {
      showToast('Please correct the highlighted form errors', 'error', 4000);
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const street = $('#streetAddress').value.trim();
    const city = $('#city').value.trim();
    const state = $('#state').value.trim();
    const zip = $('#zipCode').value.trim();
    const fullAddress = `${street}, ${city}, ${state} ${zip}`;

    const addresses = Array.from(addressContainer.querySelectorAll('.address-entry'))
      .map(entry => {
        const address = {
          street: entry.querySelector('.address-street')?.value.trim() || '',
          city: entry.querySelector('.address-city')?.value.trim() || '',
          state: entry.querySelector('.address-state')?.value.trim() || 'IN',
          zipCode: entry.querySelector('.address-zip')?.value.trim() || '',
          fromDate: entry.querySelector('.address-from')?.value.trim() || '',
          toDate: entry.querySelector('.address-to')?.value.trim() || ''
        };
        address.line = formatAddressLine(address);
        return address;
      })
      .filter(address => address.line.length > 0 || address.fromDate.length > 0 || address.toDate.length > 0);

    petitionerProfile = {
      fullName: $('#fullName').value.trim(),
      aliases: $('#aliases')?.value.trim() || '',
      dob: $('#dob').value,
      ssn: $('#ssn').value.trim(),
      driverLicense: $('#driverLicense').value.trim(),
      streetAddress: street,
      city: city,
      state: state,
      zipCode: zip,
      currentAddress: fullAddress,
      phone: $('#phone').value.trim(),
      email: $('#email').value.trim(),
      addresses
    };

    try {
      await chrome?.runtime?.sendMessage?.({ action: 'savePetitionerProfile', profile: petitionerProfile });
    } catch (_) {}

    showToast('✓ Profile validated & saved to secure local storage', 'success', 3500);
    updateChecklist();
  });

  // ─── Generate Packet ───────────────────────────────────────────────
  // ─── Legal Notice & Confirmation Modals ────────────────────────────
  const legalModal = $('#legalNoticeModal');
  const confirmModal = $('#confirmModal');

  $('#btnLegalNotice')?.addEventListener('click', () => {
    if (legalModal) legalModal.style.display = 'flex';
  });

  $('#btnNoticeClose')?.addEventListener('click', () => {
    if (legalModal) legalModal.style.display = 'none';
  });

  $('#btnModalCancel')?.addEventListener('click', () => {
    if (confirmModal) confirmModal.style.display = 'none';
  });

  $('#btnModalConfirm')?.addEventListener('click', async () => {
    if (confirmModal) confirmModal.style.display = 'none';
    await executePacketGeneration();
  });

  // Acknowledgment Checkbox Listeners
  ['ackOneShot', 'ackAllCounties', 'ackNotLawyer', 'ackProSe'].forEach(id => {
    $(`#${id}`)?.addEventListener('change', () => {
      updateChecklist();
    });
  });

  // ─── Generate Packet Trigger ───────────────────────────────────────
  $('#btnGenerate').addEventListener('click', () => {
    if (!petitionerProfile?.fullName) {
      showToast('Please fill in the Petitioner Profile first', 'error');
      switchTab('profile');
      return;
    }
    if (!currentReport || currentReport.summary.eligible === 0) {
      showToast('No eligible cases found. Scan a MyCase page first.', 'error');
      switchTab('scan');
      return;
    }

    const acksReady = $('#ackOneShot')?.checked &&
                      $('#ackAllCounties')?.checked &&
                      $('#ackNotLawyer')?.checked &&
                      $('#ackProSe')?.checked;

    if (!acksReady) {
      showToast('You must acknowledge all mandatory legal notices and the one-shot rule before generating.', 'error', 5000);
      return;
    }

    // Populate the case list in the confirm modal so the user sees exactly what will be filed
    const caseListEl = $('#confirmCaseList');
    const caseCountEl = $('#confirmCaseCount');
    if (caseListEl && caseCountEl && currentCases.length > 0) {
      caseCountEl.textContent = currentCases.length;
      caseListEl.innerHTML = currentCases.map(c => {
        const num = c.case_number || 'UNKNOWN';
        const type = c.case_type || c.type || '';
        return `<div class="modal-case-item">
          <span class="modal-case-num">${num}</span>
          <span class="modal-case-type">${type}</span>
        </div>`;
      }).join('');
    }

    // Display the final confirmation modal to prevent accidental filing
    if (confirmModal) {
      confirmModal.style.display = 'flex';
    } else {
      executePacketGeneration();
    }
  });

  // ─── Execute Packet Generation (Backend Call) ──────────────────────
  async function executePacketGeneration() {
    const btn = $('#btnGenerate');
    const statusEl = $('#generateStatus');
    const statusText = $('#generateStatusText');

    btn.disabled = true;
    statusEl.style.display = 'flex';
    statusText.textContent = 'Preparing verified payload...';

    try {
      if (!petitionerProfile?.fullName) {
        throw new Error('Please fill in the Petitioner Profile first');
      }
      if (!currentReport || currentReport.summary.eligible === 0) {
        throw new Error('No eligible cases found. Scan a MyCase page first.');
      }

      // Determine target county (supports multi-county filing selection)
      const countySelectCard = $('#countySelectCard');
      const countySelectDropdown = $('#selectCountyPacket');
      const selectedCountyCode = (countySelectCard?.style.display !== 'none' && countySelectDropdown?.value)
        ? countySelectDropdown.value
        : null;

      let targetCounty = null;
      if (selectedCountyCode && currentReport.counties[selectedCountyCode]) {
        targetCounty = currentReport.counties[selectedCountyCode];
      } else {
        targetCounty = Object.values(currentReport.counties)[0];
      }

      // Build payload for the backend (filtered to targetCounty if multi-county)
      const eligibleCases = [];
      const casesToInclude = targetCounty ? targetCounty.cases : currentCases;

      for (const c of casesToInclude) {
        if (c.eligibility?.eligible) {
          eligibleCases.push({
            caseNumber: c.case_number,
            type: c.eligibility.typeCode,
            statute: c.eligibility.statute,
            charges: c.charges || c.case_type,
            filed: c.filed,
            dispositionDate: safeISOString(c.eligibility.dispositionDate)?.split('T')[0] || c.filed,
            court: c.court,
            grantType: c.eligibility.grantType
          });
        }
      }

      if (eligibleCases.length === 0) {
        throw new Error(`No eligible cases in ${targetCounty?.courtName || 'the selected county'}.`);
      }

      const payload = {
        petitioner: petitionerProfile,
        county: targetCounty?.courtName?.replace(/\s*(Superior|Circuit|Court)\s*/gi, '').trim() || 'Unknown',
        court: targetCounty?.courtName || 'Unknown Court',
        courtCode: targetCounty?.courtCode || 'XXXXX',
        cases: eligibleCases,
        includeFeeWaiver: $('#includeFeeWaiver')?.checked ?? true,
        includeAddressSupplement: $('#includeAddressSupplement')?.checked ?? true,
        acknowledgedOneShot: $('#ackOneShot')?.checked ?? true,
        acknowledgedNotLawyer: $('#ackNotLawyer')?.checked ?? true,
        acknowledgedAllCases: $('#ackAllCounties')?.checked ?? true,
        acknowledgedProSeLiability: $('#ackProSe')?.checked ?? true
      };

      statusText.textContent = 'Generating court documents & warnings (JS PoC)...';

      // --- PoC: Use JS PDF Generator ---
      const pdfBytes = await window.PdfGenerator.generateAppearanceForm(payload);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const countyName = payload.county || 'expungement';
      const petitionerLast = (payload.petitioner?.fullName || 'packet').split(' ').pop();
      const filename = `${petitionerLast}_${countyName}_Appearance_Form.pdf`;

      await downloadPetition(blob, filename);
      showToast(`Form 01 generated: ${filename}`, 'success', 6000);
      statusText.textContent = `✓ Download started: ${filename}`;
    } catch (e) {
      showToast(e.message, 'error');
      statusText.textContent = `✗ ${e.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
    }
  }

  // ─── Checklist Updates ─────────────────────────────────────────────
  function updateChecklist() {
    const profileReady = Boolean(
      petitionerProfile?.fullName?.length > 0 &&
      (petitionerProfile?.streetAddress || petitionerProfile?.currentAddress)
    );
    const casesReady = Boolean(currentReport && currentReport.summary.eligible > 0);
    const acksReady = Boolean(
      $('#ackOneShot')?.checked &&
      $('#ackAllCounties')?.checked &&
      $('#ackNotLawyer')?.checked &&
      $('#ackProSe')?.checked
    );

    setChecklistItem('checkProfile', profileReady);
    setChecklistItem('checkCases', casesReady);
    setChecklistItem('checkBackendReady', true); // Overridden for JS PoC
    setChecklistItem('checkAcknowledgments', acksReady);

    // Enable generate button only when ALL checks pass including legal acknowledgments
    $('#btnGenerate').disabled = !(profileReady && casesReady && acksReady);
  }

  function setChecklistItem(id, ready) {
    const el = $(`#${id}`);
    if (!el) return;
    el.classList.toggle('ready', ready);
    const icon = el.querySelector('.check-icon');
    if (icon) icon.textContent = ready ? '✓' : '○';
  }

  // ─── Utilities ─────────────────────────────────────────────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Initialization ────────────────────────────────────────────────
  async function init() {
    // Load saved state & bind formatters
    setupInputFormatting();
    await loadProfile();
    await checkBackend();
    await checkPageStatus();

    // Load last scan results
    try {
      const lastScan = await chrome?.runtime?.sendMessage?.({ action: 'loadLastScan' });
      if (lastScan?.scan) {
        currentCases = lastScan.scan.cases || [];
        currentReport = lastScan.scan.report || null;
        searchBatches = lastScan.scan.searchBatches || [];
        updateBatchPanelUI();
        if (currentReport) {
          renderResults();
        }
      }
    } catch (_) {}

    updateChecklist();

    // Periodic checks: poll rapidly (every 4s) when offline so newly launched backend is caught instantly
    setInterval(checkPageStatus, 5000);
    setInterval(() => {
      // If offline, check frequently to catch when user runs python backend/app.py
      checkBackend(false);
    }, backendOnline ? 12000 : 4000);
  }

  init();

})();
