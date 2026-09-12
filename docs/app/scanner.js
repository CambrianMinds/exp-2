import { AppState } from './state.js';
import { $, $$, escapeHtml, AuditLogger, downloadJsonFile, saveDraftSession, loadDraftSession, clearDraftSession } from './utils.js';
import { showToast, updateChecklist, switchTab } from './ui.js';

// URL detection helper for Indiana MyCase
export function isMyCaseUrl(url) {
  if (!url) return false;
  return url.includes('courts.in.gov/mycase') || url.includes('mycase.in.gov');
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
export function showParityModal(cases, searchContext, mergeMode) {
  let hasBarredCase = false;
  if (cases && Array.isArray(cases)) {
    cases.forEach(c => {
      if (c.ccs && Array.isArray(c.ccs.charges) && c.ccs.charges.length > 0) {
        if (!c.charges || c.charges.toUpperCase().includes('SEE CCS ENTRY')) {
          c.charges = c.ccs.charges.map(ch => `${ch.count ? 'Count ' + ch.count + ': ' : ''}${ch.offense} (${ch.level || ''})`).join('; ');
        }
      }

      // Check for statutorily barred offenses at import time
      if (window.IndianaExpungement?.checkIneligibility) {
        const barred = window.IndianaExpungement.checkIneligibility(c.charges, c);
        if (barred && barred.mitigationType === 'strictly_excluded') {
          c._isStatutorilyBarred = true;
          c._barredCategory = barred.reason;
          hasBarredCase = true;
        }
      }
    });
  }

  AppState.pendingScanResult = { cases, searchContext, mergeMode };

  const countEl = $('#parityCaseCount');
  const listEl = $('#parityCaseList');

  if (countEl) countEl.textContent = cases.length;

  if (listEl) {
    listEl.innerHTML = '';
    if (cases.length === 0) {
      listEl.innerHTML = '<tr><td colspan="4"><em style="font-size:0.7rem;color:var(--text-muted)">No cases found on this page.</em></td></tr>';
    } else {
      cases.slice(0, 20).forEach(c => {
        const item = document.createElement('tr');
        item.className = 'modal-case-item';
        const barredTag = c._isStatutorilyBarred
          ? ' <span class="badge-barred-mini" style="background:#fee2e2;color:#991b1b;border:1px solid #ef4444;font-size:0.65rem;padding:1px 4px;border-radius:3px;font-weight:700;">⛔ BARRED</span>'
          : '';
        item.innerHTML = `
          <td><span class="modal-case-num">${escapeHtml(c.case_number || 'Unknown')}${barredTag}</span></td>
          <td><span class="modal-case-type">${escapeHtml(c.case_type || '')}</span></td>
          <td><span class="modal-case-charges">${escapeHtml(c.charges || 'None')}</span></td>
          <td><span class="modal-case-date">${escapeHtml(c.filed || '')}</span></td>
        `;
        listEl.appendChild(item);
      });
      if (cases.length > 20) {
        const overflow = document.createElement('tr');
        overflow.innerHTML = `<td colspan="4" style="font-size:0.68rem;color:var(--text-muted);margin-top:6px;">…and ${cases.length - 20} more case${cases.length - 20 === 1 ? '' : 's'}</td>`;
        listEl.appendChild(overflow);
      }
    }
  }

  const modal = $('#parityModal');
  if (modal) modal.style.display = 'flex';

  if (hasBarredCase) {
    showToast('⚠️ Statutorily barred offense detected (e.g. Murder/Sex Offense). Barred cases cannot be expunged under IC § 35-38-9.', 'warning', 6000);
  }
}

/**
 * Called when the user clicks "Go Back & Retry" in the parity modal.
 * Closes the modal and lets the user re-run the scan.
 */
$('#btnParityRetry')?.addEventListener('click', () => {
  const modal = $('#parityModal');
  if (modal) modal.style.display = 'none';
  AppState.pendingScanResult = null;
  showToast('Re-run the scan when you\'re ready.', 'info', 3000);
});

/**
 * Called when the user confirms the cases match what they see on screen.
 * Merges the pending scan result into the accumulated case set.
 */
$('#btnParityConfirm')?.addEventListener('click', () => {
  const modal = $('#parityModal');
  if (modal) modal.style.display = 'none';

  if (!AppState.pendingScanResult) return;
  const { cases: incomingCases, searchContext, mergeMode } = AppState.pendingScanResult;
  AppState.pendingScanResult = null;

  if (incomingCases.length === 0) return;

  if (mergeMode && AppState.currentCases.length > 0) {
    // Multi-search merge & de-duplication
    const existingMap = new Map();
    AppState.currentCases.forEach(c => {
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
        AppState.currentCases.push(ic);
        existingMap.set(k, ic);
        newAdded++;
      }
    });

    AppState.searchBatches.push({
      query: searchContext,
      count: incomingCases.length,
      timestamp: Date.now()
    });

    if (window.IndianaExpungement?.analyzeAll) {
      AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
    }

    showToast(
      newAdded > 0
        ? `Parity confirmed. Merged ${newAdded} new cases (${overlapped} already in batch). Total: ${AppState.currentCases.length} cases.`
        : `Parity confirmed. All ${overlapped} cases already in batch. Total: ${AppState.currentCases.length} cases.`,
      'success',
      5000
    );
  } else {
    // Fresh scan (or merge disabled)
    AppState.currentCases = incomingCases;
    AppState.currentCases.forEach(c => {
      c.searchQueries = [searchContext];
    });
    AppState.searchBatches = [{
      query: searchContext,
      count: incomingCases.length,
      timestamp: Date.now()
    }];
    AppState.currentReport = window.IndianaExpungement?.analyzeAll
      ? window.IndianaExpungement.analyzeAll(AppState.currentCases)
      : null;

    showToast(`Parity confirmed. Found ${incomingCases.length} cases.`, 'success');
  }

  if (AppState.currentReport?.summary?.statutorilyBarred > 0) {
    setTimeout(() => {
      showToast('⚠️ Note: 1 or more imported records are statutorily barred from expungement under IC § 35-38-9.', 'warning', 5500);
    }, 1000);
  }

  checkAndSuggestAlias(searchContext);
  updateBatchPanelUI();
  renderResults();

  persistScanResults();

  const deepBtn = $('#btnDeepScrape');
  if (deepBtn) deepBtn.disabled = false;
  switchTab('results');
  updateChecklist();
});

export function persistScanResults() {
  try {
    if (typeof chrome !== 'undefined') {
      chrome?.runtime?.sendMessage?.({
        action: 'saveScanResults',
        cases: AppState.currentCases,
        report: AppState.currentReport,
        searchBatches: AppState.searchBatches
      });
    }
  } catch (_) { /* chrome.runtime not available (e.g. devtools reload) — ignore */ }
  try {
    localStorage.setItem('lastScanResults', JSON.stringify({
      cases: AppState.currentCases,
      report: AppState.currentReport,
      searchBatches: AppState.searchBatches
    }));
  } catch (_) { /* localStorage unavailable in this context — ignore */ }

  saveDraftSession(AppState.currentCases, AppState.petitionerProfile);
  AuditLogger.log('scan_results_persisted', {
    caseCount: AppState.currentCases.length,
    eligibleCount: AppState.currentReport?.summary?.eligible || 0
  });
}

// ─── Multi-Search Batch & UI State ─────────────────────────────────
export function updateBatchPanelUI() {
  const batchPanel = $('#batchPanel');
  const badge = $('#batchBadge');
  const pagesCount = $('#batchPagesCount');
  const tagsContainer = $('#batchSearchTags');
  const resultsCountPill = $('#resultsCountPill');
  const resultsSearchesPill = $('#resultsSearchesPill');

  const totalCases = AppState.currentCases.length;
  const totalSearches = AppState.searchBatches.length;

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
      AppState.searchBatches.forEach(b => {
        const tag = document.createElement('span');
        tag.className = 'batch-tag';
        tag.innerHTML = `${escapeHtml(b.query)} <span class="batch-tag-count">${b.count}</span>`;
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
  if (AppState.currentCases.length > 0 && !confirm('Clear all accumulated cases and searches to start fresh?')) {
    return;
  }
  AppState.currentCases = [];
  AppState.currentReport = null;
  AppState.searchBatches = [];

  persistScanResults();

  updateBatchPanelUI();
  const rc = $('#resultsContent');
  if (rc) rc.style.display = 'none';
  const nr = $('#noResults');
  if (nr) nr.style.display = 'block';
  const rb = $('#resultsBadge');
  if (rb) rb.style.display = 'none';
  const db = $('#btnDeepScrape');
  if (db) db.disabled = true;
  updateChecklist();
  showToast('Accumulated cases cleared. You can start a fresh search.', 'info', 3500);
});

// Jump from Results back to Scan to add another name / county
$('#btnScanAnotherPage')?.addEventListener('click', () => {
  switchTab('scan');
  showToast('Upload another MyCase file or drag and drop to combine with existing records.', 'info', 5000);
  const target = $('#dropZone') || $('#btnSelectFiles') || $('#btnScan');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
});

// ─── Export Case Records & Audit Manifest ────────────────────────────
$('#btnExportCases')?.addEventListener('click', () => {
  if (!AppState.currentCases.length) {
    showToast('No case data to export. Import court records first.', 'info');
    return;
  }
  AuditLogger.log('cases_exported', { count: AppState.currentCases.length });
  downloadJsonFile(AppState.currentCases, `mycase_records_${Date.now()}.json`);
  showToast('Exported case records (JSON)', 'success');
});

$('#btnExportAudit')?.addEventListener('click', () => {
  AuditLogger.log('manifest_exported');
  const manifest = AuditLogger.generateManifest(AppState.currentCases, AppState.currentReport, AppState.petitionerProfile);
  downloadJsonFile(manifest, `expungement_manifest_${Date.now()}.json`);
  showToast('Exported audit log & statutory manifest (JSON)', 'success');
});

// ─── Manual Case Entry ─────────────────────────────────────────────
function openManualEntryModal() {
  $('#manualEntryForm')?.reset();
  const modal = $('#manualEntryModal');
  if (modal) modal.style.display = 'flex';
}

['#btnManualEntry', '#btnManualEntryEmpty', '#btnManualEntryDropzone', '.btn-open-manual-entry'].forEach(sel => {
  $$(sel).forEach(btn => btn.addEventListener('click', openManualEntryModal));
});

$('#btnManualCancel')?.addEventListener('click', () => {
  $('#manualEntryModal').style.display = 'none';
});

$('#btnManualSave')?.addEventListener('click', () => {
  const form = $('#manualEntryForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  const caseNumber = $('#manualCaseNumber').value.trim().toUpperCase();
  const caseType = ($('#manualCaseType')?.value || '').trim().toUpperCase();
  const offenseTier = $('#manualOffenseTier')?.value || '';
  const dispositionDate = $('#manualDispositionDate')?.value || '';
  const sentenceCompletedDate = $('#manualSentenceCompletedDate')?.value || '';
  const title = $('#manualCaseTitle')?.value?.trim() || '';
  const charges = $('#manualCharges')?.value?.trim() || '';
  const balanceDue = parseFloat($('#manualBalanceDue')?.value || '0') || 0;
  const restitutionSatisfied = $('#manualRestitutionSatisfied')?.checked ?? true;
  const ackCompleteness = $('#manualAckCompleteness')?.checked;

  if ($('#manualAckCompleteness') && !ackCompleteness) {
    showToast('You must confirm that all counts and cases have been entered under the one-shot rule.', 'error', 4500);
    return;
  }

  // Validate Indiana cause number format XXDXX-YYMM-CC-NNNNNN
  if (!caseNumber.includes('-')) {
    showToast('Case number must be in the format XXDXX-YYMM-CC-NNNNNN (e.g. 49D01-1605-FD-000123)', 'error', 4500);
    return;
  }
  
  const countyCode = caseNumber.substring(0, 2);

  const newCase = {
    case_number: caseNumber,
    case_type: caseType || (offenseTier ? offenseTier.replace(/^IC\s*§?\s*/i, '') : 'CM'),
    filed: dispositionDate,
    dispositionDate: dispositionDate,
    sentenceCompletedDate: sentenceCompletedDate || null,
    title: title || `State of Indiana v. ${AppState.petitionerProfile?.fullName || 'Petitioner'}`,
    charges: charges || (offenseTier ? `Tier: ${offenseTier}` : 'Criminal Charge'),
    court: countyCode ? `County ${countyCode}` : 'Unknown Court',
    status: 'Decided',
    financials: {
      balanceDue: balanceDue,
      balanceFormatted: `$${balanceDue.toFixed(2)}`,
      restitutionSatisfied: restitutionSatisfied
    },
    searchContext: 'Manual Entry',
    searchQueries: ['Manual Entry'],
    isManualEntry: true,
    manualOffenseTier: offenseTier
  };

  if (window.IndianaExpungement?.validateCaseRecord) {
    const valResult = window.IndianaExpungement.validateCaseRecord(newCase);
    if (!valResult.isValid && valResult.errors?.length) {
      showToast(`Notice: ${valResult.errors[0]}`, 'warning', 4000);
    }
  }

  if (window.IndianaExpungement?.checkIneligibility) {
    const barredCheck = window.IndianaExpungement.checkIneligibility(charges, newCase);
    if (barredCheck && barredCheck.mitigationType === 'strictly_excluded') {
      showToast(`Notice: Case ${caseNumber} matches a statutorily barred category (${barredCheck.reason}) under IC § 35-38-9.`, 'warning', 6000);
    }
  }

  AppState.currentCases.push(newCase);
  
  if (window.IndianaExpungement?.analyzeAll) {
    AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
  }

  persistScanResults();
  updateBatchPanelUI();
  renderResults();
  updateChecklist();
  
  $('#manualEntryModal').style.display = 'none';
  switchTab('results');
  showToast(`Successfully added case ${caseNumber} manually.`, 'success', 4000);
});

// Auto-suggest aliases from search queries (IC § 35-38-9-8(b)(1))
function checkAndSuggestAlias(query) {
  if (!query || query === 'MyCase Search' || query.length < 3) return;
  const aliasesInput = $('#aliases');
  const currentAliases = (aliasesInput?.value || AppState.petitionerProfile?.aliases || '').trim();
  const fullName = ($('#fullName')?.value || AppState.petitionerProfile?.fullName || '').trim().toLowerCase();

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
        showToast(`Suggested "${naturalName}" for Petitioner Aliases (IC § 35-38-9-8(b)(1))`, 'info', 5000);
      } else if (aliasesInput && !aliasesInput.value.includes(naturalName)) {
        aliasesInput.value = `${aliasesInput.value}, ${naturalName}`;
        showToast(`Added "${naturalName}" to Petitioner Aliases`, 'info', 5000);
      }
    }
  }
}

// ─── Page Status Check ─────────────────────────────────────────────
export async function checkPageStatus() {
  const statusDot = $('#pageStatusIndicator .status-dot');
  const statusText = $('#pageStatusText');
  if (!statusDot || !statusText) return false;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !isMyCaseUrl(tab.url)) {
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
      statusText.textContent = 'MyCase search results detected';
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

// ─── Helper: check content script is alive on the active MyCase tab ───
export async function ensureContentScript(tabId) {
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

// ─── Scrape & Import Progress Helpers ───────────────────────────────
export function setScanStatus(message, pct = null) {
  const progress = $('#scanProgress');
  const fill = $('#progressFill');
  const text = $('#progressText');
  const uploadStatus = $('#uploadStatus');
  const uploadStatusText = $('#uploadStatusText');

  if (progress) progress.style.display = 'block';
  if (fill && pct !== null) fill.style.width = `${pct}%`;
  if (text) text.textContent = message;

  if (uploadStatus) uploadStatus.style.display = 'flex';
  if (uploadStatusText) uploadStatusText.textContent = message;
}

export function clearScanStatus(delayMs = 2000) {
  setTimeout(() => {
    const progress = $('#scanProgress');
    const uploadStatus = $('#uploadStatus');
    if (progress) progress.style.display = 'none';
    if (uploadStatus) uploadStatus.style.display = 'none';
  }, delayMs);
}

// ─── Scan Action (Supports Multi-Page Merge for Maiden/Aliases) ──────
const scanBtn = $('#btnScan');
if (scanBtn) {
  scanBtn.addEventListener('click', async () => {
    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Scanning...';
    setScanStatus('Connecting to MyCase page...', 25);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      // Verify we're on a MyCase page
      if (!isMyCaseUrl(tab.url)) {
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
          clearScanStatus(0);
          showToast('No case records found on this MyCase page.', 'warning', 4000);
          return;
        }

        setScanStatus(`Found ${incomingCases.length} case${incomingCases.length === 1 ? '' : 's'} → Verifying court codes & statutory levels...`, 70);

        setTimeout(() => {
          setScanStatus(`Found ${incomingCases.length} cases → Court codes verified → Checking financial fee summaries...`, 100);
          clearScanStatus(2000);
          showParityModal(incomingCases, searchContext, mergeMode);
        }, 150);
        return;
      } else {
        throw new Error(response?.error || 'Scan failed');
      }
    } catch (e) {
      clearScanStatus(0);
      if (e.message?.includes('Receiving end does not exist') || e.message?.includes('Could not establish connection')) {
        showToast('Content script not responding — refresh the MyCase page and try again', 'error', 6000);
      } else {
        showToast(e.message, 'error');
      }
      console.error('[Sidepanel] Scan error:', e);
    } finally {
      scanBtn.disabled = false;
      scanBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        Scan Page & Check Eligibility
      `;
    }
  });
}

// ─── Helpers: HTML and String Cleaning ──────────────────────────────
function cleanHtml(html) {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || '').trim();
  }
  return html.replace(/<[^>]*>/g, '').trim();
}

function cleanCharges(charges) {
  if (!charges) return '';
  let clean = charges.replace(/\*{3}\s*REFERENCE CCS ENTRY\s*\*{3}/gi, '').trim();
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

// ─── Demo Cases for Instant Pro Se Preview & Testing ───────────────
export const DEMO_CASES = [
  {
    index: 1,
    case_number: '49D01-1804-CM-014920',
    title: 'State of Indiana v. John Doe',
    court: 'Marion Superior Court, Criminal Division 1',
    case_type: 'CM - Criminal Misdemeanor',
    filed: '04/15/2018',
    status: '05/10/2018, Disposed - Conviction',
    dispositionDate: '05/10/2018',
    charges: 'Operating a Vehicle While Intoxicated - Class A Misdemeanor',
    parties: 'Doe, John (Defendant)',
    attorneys: 'Public Defender',
    searchContext: 'Demo Cases (Marion & Hamilton County)',
    _source: 'demo'
  },
  {
    index: 2,
    case_number: '29D03-1509-F6-007812',
    title: 'State of Indiana v. John Doe',
    court: 'Hamilton Superior Court 3',
    case_type: 'F6 - Level 6 Felony, Theft',
    filed: '09/01/2015',
    status: '11/20/2015, Disposed - Conviction',
    dispositionDate: '11/20/2015',
    charges: 'Theft - Prior Conviction (Level 6 Felony)',
    parties: 'Doe, John (Defendant)',
    attorneys: 'Private Counsel',
    searchContext: 'Demo Cases (Marion & Hamilton County)',
    _source: 'demo'
  },
  {
    index: 3,
    case_number: '49G01-2001-F5-000100',
    title: 'State of Indiana v. John Doe',
    court: 'Marion Superior Court, Criminal Division 1',
    case_type: 'F5 - Level 5 Felony',
    filed: '01/15/2020',
    status: '08/20/2021, Disposed - Dismissed',
    dispositionDate: '08/20/2021',
    charges: 'Battery Resulting in Bodily Injury - Dismissed',
    parties: 'Doe, John (Defendant)',
    attorneys: 'Public Defender',
    searchContext: 'Demo Cases (Marion & Hamilton County)',
    _source: 'demo'
  },
  {
    index: 4,
    case_number: '49D01-2001-IF-001234',
    title: 'State of Indiana v. John Doe',
    court: 'Marion Superior Court, Civil Division',
    case_type: 'IF - Infraction',
    filed: '01/01/2024',
    status: '01/15/2024, Disposed',
    dispositionDate: '01/15/2024',
    charges: 'Speeding - Exceeding Maximum Speed Limit',
    parties: 'Doe, John (Defendant)',
    attorneys: 'None',
    searchContext: 'Demo Cases (Marion & Hamilton County)',
    _source: 'demo'
  }
];

// ─── Case Content Parser (Supports JSON and HTML) ───────────────────
export async function parseCaseData(text, filename = '') {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid file content.');
  }

  let incomingCases;
  let searchContext = filename ? `File: ${filename}` : 'MyCase Import';
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  const isJson = (filename && filename.toLowerCase().endsWith('.json')) || trimmed.startsWith('{') || trimmed.startsWith('[');

  if (isJson) {
    try {
      const parsed = JSON.parse(trimmed);
      let rawList = [];
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && Array.isArray(parsed.cases)) {
        rawList = parsed.cases;
        searchContext = parsed.searchContext || searchContext;
      } else if (parsed && Array.isArray(parsed.currentCases)) {
        rawList = parsed.currentCases;
        searchContext = parsed.searchContext || searchContext;
      } else if (parsed && parsed.scan && Array.isArray(parsed.scan.cases)) {
        rawList = parsed.scan.cases;
        searchContext = parsed.scan.searchContext || searchContext;
      } else if (parsed && Array.isArray(parsed.Results)) {
        rawList = parsed.Results;
      } else if (parsed && parsed.ob && Array.isArray(parsed.ob.Results)) {
        rawList = parsed.ob.Results;
      } else if (parsed && (parsed.case_number || parsed.CaseNumber || parsed.caseNumber || parsed.causeNumber || parsed.CauseNumber)) {
        rawList = [parsed];
      } else {
        throw new Error('JSON does not contain a recognized case list structure.');
      }

      incomingCases = rawList.map((c, idx) => {
        const rawCaseNum = c.case_number || c.CaseNumber || c.caseNumber || c.causeNumber || c.CauseNumber || c.cause_number || '';
        const caseNum = rawCaseNum.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, '').toUpperCase();
        const status = c.status || c.CaseStatus || c.statusDate || c.CaseStatusDate || c.caseStatus || '';
        let dispDate = c.dispositionDate || c.DispositionDate || c.dispDate || '';
        if (!dispDate && status) {
          const mUs = status.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
          if (mUs) {
            dispDate = `${mUs[1].padStart(2, '0')}/${mUs[2].padStart(2, '0')}/${mUs[3]}`;
          } else {
            const mIso = status.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
            if (mIso) dispDate = `${mIso[2]}/${mIso[3]}/${mIso[1]}`;
          }
        }
        let caseType = c.case_type || c.CaseType || c.caseType || '';
        if (c.CaseSubType || c.caseSubType) {
          const sub = c.CaseSubType || c.caseSubType;
          caseType = caseType ? `${caseType}, ${sub}` : sub;
        }
        if (!caseType && caseNum) {
          const parts = caseNum.split('-');
          if (parts.length >= 3 && parts[2]) caseType = parts[2];
        }

        return {
          index: c.index || idx + 1,
          case_number: caseNum,
          title: cleanHtml(c.title || c.Style || c.caseTitle || c.style || ''),
          court: c.court || c.Court || '',
          case_type: caseType,
          filed: c.filed || c.FileDate || c.fileDate || '',
          status: status,
          dispositionDate: dispDate,
          charges: cleanCharges(c.charges || c.Charges || ''),
          parties: c.parties || c.Parties || '',
          attorneys: c.attorneys || c.Attorneys || '',
          caseToken: c.caseToken || c.CaseToken || c.CaseID || '',
          ccs: c.ccs || null,
          financials: c.financials || null,
          searchContext: c.searchContext || searchContext,
          _source: c._source || 'json-upload'
        };
      }).filter(c => Boolean(c.case_number));
    } catch (jsonErr) {
      throw new Error('Invalid JSON format: ' + jsonErr.message, { cause: jsonErr });
    }
  } else {
    // HTML parsing
    let parsedDoc = null;
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      parsedDoc = parser.parseFromString(trimmed, 'text/html');
    }

    if (parsedDoc && window.MyCaseScraper && window.MyCaseScraper.isSearchResultsPage && window.MyCaseScraper.isSearchResultsPage(parsedDoc)) {
      incomingCases = window.MyCaseScraper.scrapeSearchResults(parsedDoc);
      searchContext = (window.MyCaseScraper.getSearchContext && window.MyCaseScraper.getSearchContext(parsedDoc)) || searchContext;
    } else if (parsedDoc && window.MyCaseScraper && window.MyCaseScraper._tryScrapeDOM) {
      const domCases = window.MyCaseScraper._tryScrapeDOM(parsedDoc);
      if (domCases.length > 0) {
        incomingCases = domCases;
        searchContext = (window.MyCaseScraper.getSearchContext && window.MyCaseScraper.getSearchContext(parsedDoc)) || searchContext;
      }
    }

    // Ultimate fallback: check for Indiana cause numbers in raw text or CSV
    if (!incomingCases || incomingCases.length === 0) {
      const causeMatches = trimmed.match(/\b\d{2}[A-Z]\d{1,2}\s*[-–—\u2010-\u2015\u2212]\s*\d{4}\s*[-–—\u2010-\u2015\u2212]\s*[A-Z0-9]{2,3}\s*[-–—\u2010-\u2015\u2212]\s*\d{4,7}\b/gi);
      if (causeMatches && causeMatches.length > 0) {
        const uniqueCauses = Array.from(new Set(causeMatches.map(m => m.replace(/[\u2010-\u2015\u2212\s–—]/g, '-').replace(/-+/g, '-').toUpperCase())));
        const lines = trimmed.split(/\r?\n/);

        incomingCases = uniqueCauses.map((cn, idx) => {
          const parts = cn.split('-');
          const caseType = parts[2] || '';
          const matchingLine = lines.find(l => l.toUpperCase().includes(cn)) || '';
          let lineDispDate = '';
          const mDateUs = matchingLine.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
          if (mDateUs) {
            lineDispDate = `${mDateUs[1].padStart(2, '0')}/${mDateUs[2].padStart(2, '0')}/${mDateUs[3]}`;
          } else {
            const mDateIso = matchingLine.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
            if (mDateIso) lineDispDate = `${mDateIso[2]}/${mDateIso[3]}/${mDateIso[1]}`;
          }

          return {
            index: idx + 1,
            case_number: cn,
            title: 'Extracted Case ' + cn,
            court: '',
            case_type: caseType,
            filed: '',
            status: lineDispDate ? `${lineDispDate}, Disposed` : 'Decided',
            dispositionDate: lineDispDate,
            charges: 'Extracted from text',
            parties: '',
            attorneys: '',
            caseToken: '',
            searchContext: searchContext,
            _source: 'text-fallback'
          };
        });
      } else {
        throw new Error('The uploaded file does not appear to contain MyCase search results or Indiana cause numbers.');
      }
    }
  }

  return { cases: incomingCases, searchContext };
}

// ─── Unified Multi-File Upload & Drag-and-Drop Handler ─────────────
export async function handleFiles(files) {
  if (!files || files.length === 0) return;

  const selectBtns = [$('#btnSelectFiles'), $('#btnUploadHtml')].filter(Boolean);

  selectBtns.forEach(btn => {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;"></span> Reading...';
  });

  setScanStatus(files.length === 1
    ? `Reading ${files[0].name}...`
    : `Processing ${files.length} files...`, 20);

  let allIncomingCases = [];
  let combinedContexts = [];
  let parseErrors = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (files.length > 1) {
        setScanStatus(`Reading file ${i + 1} of ${files.length}: ${file.name}... → Verifying court codes`, 20 + Math.round((i / files.length) * 50));
      }
      try {
        const text = await file.text();
        const result = await parseCaseData(text, file.name);
        if (result.cases && result.cases.length > 0) {
          allIncomingCases.push(...result.cases);
          if (result.searchContext && !combinedContexts.includes(result.searchContext)) {
            combinedContexts.push(result.searchContext);
          }
        }
      } catch (fileErr) {
        console.warn(`[Scanner] Error reading ${file.name}:`, fileErr);
        parseErrors.push(`${file.name}: ${fileErr.message}`);
      }
    }

    if (allIncomingCases.length === 0) {
      clearScanStatus(0);
      if (parseErrors.length > 0) {
        showToast(parseErrors[0], 'error', 6000);
      } else {
        showToast('No case records found in the uploaded file(s).', 'warning', 4000);
      }
      return;
    }

    // De-duplicate cases across multiple uploaded files
    const existingKeySet = new Set();
    const uniqueIncoming = [];
    allIncomingCases.forEach(c => {
      const key = (c.case_number || '').trim().toUpperCase();
      if (key) {
        if (!existingKeySet.has(key)) {
          existingKeySet.add(key);
          uniqueIncoming.push(c);
        }
      } else {
        uniqueIncoming.push(c);
      }
    });

    setScanStatus(`Found ${uniqueIncoming.length} cases → Court codes verified → Checking financial fee summaries...`, 95);
    clearScanStatus(2000);

    const searchContext = combinedContexts.length > 0 ? combinedContexts.join(' · ') : 'MyCase Import';
    const mergeMode = $('#chkMergeCases')?.checked ?? true;

    showParityModal(uniqueIncoming, searchContext, mergeMode);

    if (parseErrors.length > 0) {
      showToast(`Imported ${uniqueIncoming.length} cases with warning: ${parseErrors.join('; ')}`, 'warning', 6000);
    }
  } catch (err) {
    clearScanStatus(0);
    showToast(err.message || 'Error processing uploaded files.', 'error', 6000);
    console.error('[Scanner] Upload handler error:', err);
  } finally {
    clearScanStatus(1500);
    selectBtns.forEach(btn => {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
    });
    // Reset file input values so the same file can be re-uploaded
    const fileInputs = [$('#fileUpload'), $('#htmlUpload')].filter(Boolean);
    fileInputs.forEach(inp => { inp.value = ''; });
  }
}

// ─── Attach File Chooser and Dropzone Listeners ─────────────────────
const selectBtns = [$('#btnSelectFiles'), $('#btnUploadHtml')].filter(Boolean);
const fileInputs = [$('#fileUpload'), $('#htmlUpload')].filter(Boolean);

selectBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const primaryInput = fileInputs[0];
    primaryInput?.click();
  });
});

fileInputs.forEach(input => {
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
  });
});

// Dropzone drag-and-drop
const dropZone = $('#dropZone');
if (dropZone) {
  let dragCounter = 0;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (eventName === 'dragenter') dragCounter++;
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      dropZone.classList.add('drag-active');
    });
  });

  ['dragleave', 'dragend'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        dropZone.classList.remove('drag-active');
      }
    });
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropZone.classList.remove('drag-active');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
  });

  // Clicking empty area inside dropzone opens file dialog
  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, textarea, label')) return;
    const primaryInput = fileInputs[0];
    primaryInput?.click();
  });
}

// Prevent browser from opening files dropped outside dropzone
window.addEventListener('dragover', (e) => { e.preventDefault(); }, false);
window.addEventListener('drop', (e) => { e.preventDefault(); }, false);

// ─── Attach Paste Drawer Listeners ─────────────────────────────────
const pasteToggle = $('#btnPasteToggle');
const pasteContainer = $('#pasteContainer');
const pasteInput = $('#pasteInput');
const btnProcessPaste = $('#btnProcessPaste');

if (pasteToggle && pasteContainer) {
  pasteToggle.addEventListener('click', () => {
    const isHidden = pasteContainer.style.display === 'none' || !pasteContainer.style.display;
    pasteContainer.style.display = isHidden ? 'block' : 'none';
    if (isHidden && pasteInput) {
      pasteInput.focus();
    }
  });
}

if (btnProcessPaste && pasteInput) {
  btnProcessPaste.addEventListener('click', async () => {
    const text = pasteInput.value.trim();
    if (!text) {
      showToast('Please paste HTML source or JSON text first.', 'warning', 3500);
      pasteInput.focus();
      return;
    }

    btnProcessPaste.disabled = true;
    btnProcessPaste.textContent = 'Verifying court codes...';
    setScanStatus('Parsing pasted content → Verifying court codes & statutory types...', 50);

    try {
      const result = await parseCaseData(text, 'Pasted Content');
      if (!result.cases || result.cases.length === 0) {
        clearScanStatus(0);
        showToast('No case records found in the pasted content.', 'warning', 4000);
        return;
      }
      setScanStatus(`Found ${result.cases.length} cases → Court codes verified → Checking financial fee summaries...`, 100);
      clearScanStatus(2000);
      const mergeMode = $('#chkMergeCases')?.checked ?? true;
      showParityModal(result.cases, result.searchContext || 'Pasted MyCase Data', mergeMode);
    } catch (err) {
      clearScanStatus(0);
      showToast(err.message, 'error', 6000);
      console.error('[Scanner] Paste error:', err);
    } finally {
      btnProcessPaste.disabled = false;
      btnProcessPaste.textContent = 'Import Pasted Data';
    }
  });
}

// ─── Attach Demo Cases Loader ──────────────────────────────────────
const btnLoadDemo = $('#btnLoadDemo');
if (btnLoadDemo) {
  btnLoadDemo.addEventListener('click', () => {
    const mergeMode = $('#chkMergeCases')?.checked ?? true;
    showToast('Loaded demo cases across Marion & Hamilton counties.', 'info', 3000);
    showParityModal(DEMO_CASES.map(c => ({ ...c })), 'Demo Cases (Marion & Hamilton County)', mergeMode);
  });
}

// ─── Bookmarklet Copy Action ───────────────────────────────────────
$('#btnCopyAppBookmarklet')?.addEventListener('click', async () => {
  const code = "javascript:(function(){const s=document.createElement('script');s.src='https://cambrianminds.github.io/exp-2/bookmarklet.js?v='+Date.now();document.body.appendChild(s);})();";
  try {
    await navigator.clipboard.writeText(code);
    showToast('Bookmarklet code copied to clipboard!', 'success', 3000);
  } catch (_) {
    showToast('Please drag the blue button to your bookmarks bar.', 'info', 3000);
  }
});

// ─── Deep Scrape Action ────────────────────────────────────────────
const deepScrapeBtn = $('#btnDeepScrape');
if (deepScrapeBtn) {
  deepScrapeBtn.addEventListener('click', async () => {
    deepScrapeBtn.disabled = true;
    setScanStatus('Connecting to MyCase... → Verifying court codes', 10);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab');

      if (!isMyCaseUrl(tab.url)) {
        throw new Error('Not on a MyCase page — navigate to https://public.courts.in.gov/mycase first');
      }

      const scriptReady = await ensureContentScript(tab.id);
      if (!scriptReady) {
        throw new Error('Could not load the content script — please refresh the MyCase page');
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'deepScrape' });

      if (response?.success) {
        AppState.currentCases = response.cases;
        AppState.currentReport = response.report;
        renderResults();
        showToast('Deep scrape complete — CCS details enriched', 'success');
        setScanStatus(`Found ${AppState.currentCases.length} cases → Court codes verified → Fee check complete!`, 100);
        clearScanStatus(2500);

        chrome.runtime.sendMessage({
          action: 'saveScanResults',
          cases: AppState.currentCases,
          report: AppState.currentReport,
          searchBatches: AppState.searchBatches
        });
      } else {
        throw new Error(response?.error || 'Deep scrape failed');
      }
    } catch (e) {
      clearScanStatus(0);
      if (e.message?.includes('Receiving end does not exist') || e.message?.includes('Could not establish connection')) {
        showToast('Content script not responding — refresh the MyCase page and try again', 'error', 6000);
      } else {
        showToast(e.message, 'error');
      }
    } finally {
      deepScrapeBtn.disabled = false;
    }
  });
}

// ─── Deep Scrape Progress Listener ─────────────────────────────────
if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'deepScrapeProgress') {
      const pct = request.total ? Math.round((request.current / request.total) * 100) : 0;
      const msg = request.message || `Found ${request.total} cases → Verifying court codes (${request.current}/${request.total}: ${request.caseNum}) → Checking financial fee summaries...`;
      setScanStatus(msg, Math.max(pct, 15));
    }
  });
}

// ─── Render Results ────────────────────────────────────────────────
export function renderResults() {
  if (!AppState.currentReport) return;

  const noResults = $('#noResults');
  const resultsContent = $('#resultsContent');
  if (noResults) noResults.style.display = 'none';
  if (resultsContent) resultsContent.style.display = 'block';

  const s = AppState.currentReport.summary;
  const elEligible = $('#summaryEligible');
  const elIneligible = $('#summaryIneligible');
  const elExcluded = $('#summaryExcluded');
  const elFee = $('#summaryFee');

  if (elEligible) elEligible.textContent = s.eligible;
  if (elIneligible) elIneligible.textContent = s.ineligible;
  if (elExcluded) elExcluded.textContent = s.excluded;
  if (elFee) elFee.textContent = s.totalFilingFee ? `~$${s.totalFilingFee}` : '$0';

  // Update badge & results header pills
  const badge = $('#resultsBadge');
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.textContent = AppState.currentCases.length;
  }

  const resultsCountPill = $('#resultsCountPill');
  const resultsSearchesPill = $('#resultsSearchesPill');
  if (resultsCountPill) resultsCountPill.textContent = `${AppState.currentCases.length} Cases`;
  if (resultsSearchesPill) {
    const numSearches = AppState.searchBatches.length || 1;
    resultsSearchesPill.textContent = `from ${numSearches} search${numSearches === 1 ? '' : 'es'}`;
  }

  // Statute breakdown
  const breakdownEl = $('#statuteBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = '';
    for (const [statute, count] of Object.entries(s.byStatute || {})) {
      const tag = document.createElement('span');
      tag.className = 'statute-tag';
      tag.innerHTML = `${escapeHtml(statute)} <span class="statute-tag-count">${count}</span>`;
      breakdownEl.appendChild(tag);
    }
  }

  // Multi-county detection & selector
  const countySelectCard = $('#countySelectCard');
  const countySelectDropdown = $('#selectCountyPacket');
  const counties = AppState.currentReport.counties ? Object.entries(AppState.currentReport.counties) : [];

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
  if (!listEl) return;

  // Render function scoped to handle dropdown filtering
  const renderCaseList = (selectedCountyCode) => {
    listEl.innerHTML = '';

    // Streamlined Cross-County Lifetime Forfeiture Warning
    const block = AppState.currentReport.crossCountyBlock;
    if (block && !block.isSafe) {
      const banner = document.createElement('div');
      banner.className = 'financial-warning-box cross-county-warning';
      banner.id = 'bannerCrossCounty';
      const confCounties = (block.conflictingCounties || []).join(', ') || 'other counties';
      banner.innerHTML = `
        <div class="statutory-banner-header">
          <span class="statutory-banner-badge">IC § 35-38-9-9(d) Multi-County Rule</span>
        </div>
        <p class="statutory-banner-rule">
          Filing your eligible convictions today permanently forfeits convictions in ${escapeHtml(confCounties)} that are waiting on future eligibility dates.
        </p>
        <div class="statutory-banner-actions">
          <button type="button" class="btn-banner-action" id="btnReviewConflictingCases">
            Review Waiting Cases (${escapeHtml(confCounties)})
          </button>
        </div>
      `;
      listEl.appendChild(banner);

      banner.querySelector('#btnReviewConflictingCases')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const firstConflict = (block.conflictingCounties || [])[0];
        if (countySelectDropdown && firstConflict) {
          const matchingOpt = Array.from(countySelectDropdown.options).find(o => o.textContent.includes(firstConflict));
          if (matchingOpt) {
            countySelectDropdown.value = matchingOpt.value;
            renderCaseList(matchingOpt.value);
            return;
          }
        }
        const firstIneligible = listEl.querySelector('.case-card:not(.case-eligible)');
        if (firstIneligible) {
          firstIneligible.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstIneligible.style.outline = '2px solid #dc2626';
          setTimeout(() => { firstIneligible.style.outline = ''; }, 3000);
        }
      });
    }

    // Streamlined Active Pending Criminal Charges Statutory Bar
    const pendingBlock = AppState.currentReport.pendingChargesBlock;
    if (pendingBlock && !pendingBlock.isSafe) {
      const banner = document.createElement('div');
      banner.className = 'financial-warning-box pending-charges-warning';
      banner.id = 'bannerPendingCharges';
      const pendingCasesStr = (pendingBlock.pendingCases || []).join(', ');
      banner.innerHTML = `
        <div class="statutory-banner-header">
          <span class="statutory-banner-badge" style="background:rgba(220,38,38,0.15); color:#dc2626; border-color:rgba(220,38,38,0.4);">Active Pending Criminal Charges</span>
        </div>
        <p class="statutory-banner-rule">
          Under IC § 35-38-9, expungement petitions are strictly barred while open criminal charges (${escapeHtml(pendingCasesStr)}) remain pending in any court.
        </p>
        <div class="statutory-banner-actions">
          <button type="button" class="btn-banner-action" id="btnReviewPendingCases">
            Review Open Cases (${escapeHtml(pendingCasesStr)})
          </button>
        </div>
      `;
      listEl.appendChild(banner);

      banner.querySelector('#btnReviewPendingCases')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetCase = (pendingBlock.pendingCases || [])[0];
        const allCards = listEl.querySelectorAll('.case-card');
        for (const card of allCards) {
          if (card.textContent.includes(targetCase)) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline = '3px solid #dc2626';
            setTimeout(() => { card.style.outline = ''; }, 3500);
            return;
          }
        }
      });
    }

    // Statutorily Barred Offense Statutory Bar Banner
    const barredBlock = AppState.currentReport.statutorilyBarredBlock;
    if (barredBlock && !barredBlock.isSafe) {
      const banner = document.createElement('div');
      banner.className = 'financial-warning-box statutorily-barred-warning';
      banner.id = 'bannerStatutorilyBarred';
      const barredCasesStr = (barredBlock.barredCases || []).join(', ');
      banner.innerHTML = `
        <div class="statutory-banner-header">
          <span class="statutory-banner-badge" style="background:rgba(220,38,38,0.15); color:#dc2626; border-color:rgba(220,38,38,0.4);">Statutorily Barred Offense (IC § 35-38-9-3(b))</span>
        </div>
        <p class="statutory-banner-rule">
          Indiana law permanently excludes certain severe offenses from expungement (${escapeHtml(barredCasesStr)}). While other eligible records can still be petitioned, barred offenses cannot be sealed or expunged.
        </p>
        <div class="statutory-banner-actions">
          <button type="button" class="btn-banner-action" id="btnReviewBarredCases">
            Review Barred Cases (${escapeHtml(barredCasesStr)})
          </button>
        </div>
      `;
      listEl.appendChild(banner);

      banner.querySelector('#btnReviewBarredCases')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetCase = (barredBlock.barredCases || [])[0];
        const allCards = listEl.querySelectorAll('.case-card');
        for (const card of allCards) {
          if (card.textContent.includes(targetCase)) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline = '3px solid #dc2626';
            setTimeout(() => { card.style.outline = ''; }, 3500);
            return;
          }
        }
      });
    }

    let casesToRender = [];
    if (selectedCountyCode && AppState.currentReport.counties[selectedCountyCode]) {
      casesToRender = AppState.currentReport.counties[selectedCountyCode].cases;
    } else {
      // Fallback: render all if no selection
      for (const county of Object.values(AppState.currentReport.counties || {})) {
        casesToRender.push(...county.cases);
      }
    }

    // Sort: eligible first, then by case number
    casesToRender.sort((a, b) => {
      const aElig = a.eligibility?.eligible ? 0 : 1;
      const bElig = b.eligibility?.eligible ? 0 : 1;
      if (aElig !== bElig) return aElig - bElig;
      return (a.case_number || '').localeCompare(b.case_number || '');
    });

    renderEligibilityMatrix(casesToRender);

    for (const c of casesToRender) {
      listEl.appendChild(createCaseCard(c));
    }
  };

  if (countySelectCard && countySelectDropdown && counties.length > 1) {
    // Attach listener to instantly filter cases on change
    countySelectDropdown.onchange = (e) => {
      renderCaseList(e.target.value);
    };
    // Initial render based on the first dropdown item
    renderCaseList(countySelectDropdown.value);
  } else {
    // Initial render for single-county or no dropdown scenarios
    renderCaseList(null);
  }
}

function excludeCase(caseNum) {
  if (!caseNum) return;
  const idx = AppState.currentCases.findIndex(c => (c.case_number || '').trim().toUpperCase() === caseNum.trim().toUpperCase());
  if (idx === -1) return;

  AppState.currentCases.splice(idx, 1);

  if (window.IndianaExpungement?.analyzeAll) {
    AppState.currentReport = window.IndianaExpungement.analyzeAll(AppState.currentCases);
  }

  persistScanResults();

  updateBatchPanelUI();
  renderResults();
  updateChecklist();
  showToast(`Excluded ${caseNum} from filing. Eligibility recalculated.`, 'info', 3500);
}

// ─── Statutory Eligibility Matrix ──────────────────────────────────
export function renderEligibilityMatrix(casesToRender) {
  let container = $('#eligibilityMatrixCard');
  const resultsContent = $('#resultsContent');
  if (!resultsContent) return;

  if (!container) {
    container = document.createElement('div');
    container.id = 'eligibilityMatrixCard';
    container.className = 'eligibility-matrix-card';
    const breakdownEl = $('#statuteBreakdown');
    if (breakdownEl && breakdownEl.parentNode) {
      breakdownEl.parentNode.insertBefore(container, breakdownEl.nextSibling);
    } else {
      resultsContent.appendChild(container);
    }
  }

  if (!casesToRender || casesToRender.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  const rowsHtml = casesToRender.map(c => {
    const el = c.eligibility || {};
    const statute = el.statute || 'N/A';
    const statuteUrl = el.statuteUrl || 'https://iga.in.gov/laws/2024/ic/titles/35#35-38-9';

    // Relief Type
    let reliefBadge = '<span class="matrix-badge badge-neutral">Civil / N/A</span>';
    let tierDesc = 'Civil / Non-Criminal';
    if (el.isStatutorilyBarred) {
      reliefBadge = '<span class="matrix-badge badge-barred">❌ Statutorily Barred</span>';
      tierDesc = 'Barred (IC § 35-38-9-3(b))';
    } else if (statute === 'IC § 35-38-9-1') {
      reliefBadge = '<span class="matrix-badge badge-fullseal">Full Sealing</span>';
      tierDesc = 'Section 1: Non-Conviction';
    } else if (statute === 'IC § 35-38-9-2') {
      reliefBadge = '<span class="matrix-badge badge-mandatory">Mandatory Seal</span>';
      tierDesc = 'Section 2: Misdemeanor';
    } else if (statute === 'IC § 35-38-9-3') {
      reliefBadge = '<span class="matrix-badge badge-mandatory">Mandatory Seal</span>';
      tierDesc = 'Section 3: Level 6 Felony';
    } else if (statute === 'IC § 35-38-9-4') {
      reliefBadge = '<span class="matrix-badge badge-discretionary">Discretionary (Marked)</span>';
      tierDesc = 'Section 4: Major Felony';
    } else if (statute === 'IC § 35-38-9-5') {
      reliefBadge = '<span class="matrix-badge badge-consent">Prosecutor Consent</span>';
      tierDesc = 'Section 5: Serious Felony';
    }

    // Waiting Period
    let waitHtml = '<span class="wait-met">No wait required</span>';
    if (el.isStatutorilyBarred) {
      waitHtml = '<span class="wait-waiting" style="color:#dc2626; font-weight:700;">Permanently Barred</span>';
    } else if (el.waitingPeriod) {
      if (el.yearsElapsed >= el.waitingPeriod) {
        waitHtml = `<span class="wait-met">✓ Met (${el.yearsElapsed} yrs ≥ ${el.waitingPeriod} yrs)</span>`;
      } else {
        const remaining = (el.waitingPeriod - el.yearsElapsed).toFixed(1);
        waitHtml = `<span class="wait-waiting">⏳ Waiting (${el.yearsElapsed} / ${el.waitingPeriod} yrs · ${remaining} yrs left)</span>`;
      }
    }

    // Exclusions & Balance
    const balance = c.financials?.balanceDue || c.ccs?.financials?.balanceDue || 0;
    let balanceHtml = '<span class="bal-ok">✓ No Exclusions · $0 Balance</span>';
    if (el.isStatutorilyBarred) {
      balanceHtml = `<span class="bal-warn" style="color:#dc2626; font-weight:700;">⛔ ${escapeHtml(el.barredCategory || 'Statutorily Barred')}</span>`;
    } else if (balance > 0) {
      balanceHtml = `<span class="bal-warn">⚠️ $${balance.toFixed(2)} Balance Due</span>`;
    } else if (el.exclusionReason) {
      balanceHtml = `<span class="bal-warn">⚠️ ${escapeHtml(el.exclusionReason)}</span>`;
    }

    // Filing Fee & Waiver
    let feeHtml = '<span class="fee-free">$0 (Free Filing)</span>';
    if (statute !== 'IC § 35-38-9-1' && statute !== 'N/A') {
      feeHtml = '<span class="fee-standard">$157 Standard · Form 08 Fee Waiver</span>';
    }

    const countyName = c.court || (c.case_number ? `County ${c.case_number.substring(0, 2)}` : 'Indiana');

    return `
      <tr>
        <td class="matrix-cell-case">
          <strong>${escapeHtml(c.case_number || 'Unknown')}</strong>
          <span class="matrix-court-sub">${escapeHtml(countyName)}</span>
        </td>
        <td class="matrix-cell-tier">
          <span class="tier-title">${escapeHtml(tierDesc)}</span>
        </td>
        <td class="matrix-cell-relief">${reliefBadge}</td>
        <td class="matrix-cell-wait">${waitHtml}</td>
        <td class="matrix-cell-bal">${balanceHtml}</td>
        <td class="matrix-cell-fee">${feeHtml}</td>
        <td class="matrix-cell-cite">
          <a href="${escapeHtml(statuteUrl)}" target="_blank" rel="noopener" class="statute-link-out" title="View statutory text on Indiana General Assembly">
            ${escapeHtml(statute)} ↗
          </a>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="matrix-card-header">
      <div class="matrix-header-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <div>
          <h5 style="margin:0; font-size:0.95rem; font-weight:700;" data-i18n="matrix_title">Statutory Eligibility &amp; Relief Matrix (IC § 35-38-9)</h5>
          <span style="font-size:0.75rem; color:var(--text-secondary);" data-i18n="matrix_subtitle">Summary of statutory waiting periods, legal remedies, filing fees, and exclusion checks</span>
        </div>
      </div>
      <span class="badge badge-pill" style="font-size:0.75rem;">${casesToRender.length} Case${casesToRender.length === 1 ? '' : 's'} Evaluated</span>
    </div>
    <div class="matrix-table-responsive" style="overflow-x:auto; margin-top:8px;">
      <table class="matrix-table" style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:left;">
        <thead>
          <tr style="border-bottom:1px solid var(--border-color); background:var(--bg-subtle, rgba(0,0,0,0.03));">
            <th style="padding:8px 10px;" data-i18n="matrix_th_case">Case Number</th>
            <th style="padding:8px 10px;" data-i18n="matrix_th_tier">Statutory Tier</th>
            <th style="padding:8px 10px;" data-i18n="matrix_th_relief">Relief Type</th>
            <th style="padding:8px 10px;" data-i18n="matrix_th_wait">Waiting Period</th>
            <th style="padding:8px 10px;" data-i18n="matrix_th_balance">Exclusions &amp; Balance</th>
            <th style="padding:8px 10px;" data-i18n="matrix_th_feewaiver">Filing Fee &amp; Waiver</th>
            <th style="padding:8px 10px;" data-i18n="matrix_th_statute">Statute Citation</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  try {
    const curLang = localStorage.getItem('user_lang') || 'en';
    if (curLang === 'es' && window.IndianaI18n?.translateDOM) {
      window.IndianaI18n.translateDOM('es');
    }
  } catch (_) {}
}

function createCaseCard(caseData) {
  const el = caseData.eligibility;
  const card = document.createElement('div');
  card.className = 'case-card';

  // Badge
  let badgeClass = 'excluded';
  let badgeText = 'EXCLUDED';
  if (el) {
    if (el.isStatutorilyBarred) {
      badgeClass = 'barred';
      badgeText = 'STATUTORILY BARRED';
    } else if (el.eligible) {
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

  const feeStatusText = el?.statute === 'IC § 35-38-9-1'
    ? '$0 filing fee (Section 1 non-convictions are exempt from filing fees under IC § 35-38-9-1)'
    : '$157 civil filing fee applies (Fee Waiver Request Form 08 can be included if indigent)';

  const statuteUrl = el?.statuteUrl || 'https://iga.in.gov/laws/2024/ic/titles/35#35-38-9';

  card.innerHTML = `
    <div class="case-card-header">
      <span class="case-number">${escapeHtml(caseData.case_number || '')}</span>
      <div class="case-card-header-actions">
        <span class="case-badge ${badgeClass}">${badgeText}</span>
        <button type="button" class="btn-remove-case" title="Exclude this case from petition (e.g. maiden name mismatch / not you)">&times; Exclude</button>
      </div>
    </div>
    ${searchQueriesDisplay ? `<div class="case-search-tag">Found via: ${escapeHtml(searchQueriesDisplay)}</div>` : ''}
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
        <span class="detail-value statute">
          ${escapeHtml(el?.statute || 'N/A')}
          <a href="${escapeHtml(statuteUrl)}" target="_blank" rel="noopener" class="statute-inline-link" style="margin-left:6px; font-size:0.75rem;">(View Text ↗)</a>
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Years Elapsed</span>
        <span class="detail-value">${el?.yearsElapsed ?? 'N/A'} years</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Waiting Period</span>
        <span class="detail-value">${el?.waitingPeriod ? `≥${el.waitingPeriod} years (${el?.yearsElapsed >= el?.waitingPeriod ? 'Met ✓' : 'Waiting'})` : 'N/A'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Grant Type</span>
        <span class="detail-value">${escapeHtml(el?.grantType || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Filing Fee</span>
        <span class="detail-value">${escapeHtml(feeStatusText)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reason</span>
        <span class="detail-value">${escapeHtml(el?.reason || '')}</span>
      </div>
      ${el?.exclusionReason ? `
        <div class="ineligible-mitigation-box ${el.mitigationType === 'consent_required' ? 'consent-required' : 'strictly-excluded'}">
          <div class="mitigation-title">Statutory Exclusion (IC § 35-38-9)</div>
          <p><strong>Rule:</strong> ${escapeHtml(el.exclusionReason)}</p>
          <p><strong>Mitigation:</strong> ${escapeHtml(el.mitigationSteps)}</p>
        </div>
      ` : ''}
      ${el?.warnings?.length ? `
        <div class="case-warnings">
          ${el.warnings.map(w => `<span class="warning-tag">${escapeHtml(w)}</span>`).join('')}
        </div>
      ` : ''}
      ${(caseData.financials?.balanceDue > 0 || caseData.ccs?.financials?.balanceDue > 0) ? `
        <div class="financial-warning-box" style="background:rgba(220,38,38,0.08); border-left:3px solid #dc2626; padding:8px 12px; margin-top:8px; border-radius:4px; font-size:0.75rem;">
          <strong style="color:#dc2626;">UNPAID COURT BALANCE: $${(caseData.financials?.balanceDue || caseData.ccs?.financials?.balanceDue || 0).toFixed(2)}</strong>
          <p style="margin:2px 0 0 0; color:var(--text-secondary);">Under Indiana Code § 35-38-9, all fines, fees, and restitution must be paid in full before an expungement petition can be granted.</p>
        </div>
      ` : ''}
      ${((caseData.financials?.restitutionOrdered && !caseData.financials?.restitutionSatisfied) || (caseData.ccs?.financials?.restitutionOrdered && !caseData.ccs?.financials?.restitutionSatisfied)) ? `
        <div class="financial-warning-box" style="background:rgba(217,119,6,0.08); border-left:3px solid #d97706; padding:8px 12px; margin-top:8px; border-radius:4px; font-size:0.75rem;">
          <strong style="color:#d97706;">RESTITUTION ORDER DETECTED</strong>
          <p style="margin:2px 0 0 0; color:var(--text-secondary);">Verify that a formal Satisfaction of Restitution or clerk payment receipt is on file prior to filing.</p>
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
