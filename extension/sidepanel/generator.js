import { AppState } from './state.js';
import { $, safeISOString } from './utils.js';
import { showToast, updateChecklist, switchTab } from './ui.js';
import { generateCompletePacket, generateAppearanceForm } from './pdf-generator.js';
import { getCountyInfo, STATEWIDE_AGENCIES, getAvailableCounties } from './county-directory.js';



  // ─── Engine Health & Readiness ──────────────────────────────────────
  export async function checkBackend(showFeedback = false) {
    const statusEl = $('#backendStatus');
    if (!statusEl) return true;
    const dot = statusEl.querySelector('.status-dot');
    const label = statusEl.querySelector('.status-label');

    AppState.backendOnline = true;
    if (dot) dot.className = 'status-dot online';
    if (label) label.textContent = 'Engine Ready';
    statusEl.title = 'In-Browser PDF Generator is active and ready (pdf-lib)';

    updateChecklist();

    if (showFeedback) {
      showToast('✓ In-Browser PDF Engine is active and ready', 'success', 3000);
    }

    return true;
  }


  export async function downloadPetition(blob, filename) {
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

  // Prior Filings County Population
  export function populatePriorFilingCounties() {
    const select = $('#priorFilingCounty');
    if (!select || select.options.length > 1) return;
    const counties = (typeof window !== 'undefined' && window.IndianaExpungement?.INDIANA_COUNTIES)
      ? Object.values(window.IndianaExpungement.INDIANA_COUNTIES).sort()
      : [];
    counties.forEach(countyName => {
      const opt = document.createElement('option');
      opt.value = countyName;
      opt.textContent = `${countyName} County`;
      select.appendChild(opt);
    });
  }

  // Prior Filings Radio Listeners
  document.querySelectorAll('input[name="hasPriorFiling"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const box = $('#priorFilingDateBox');
      if (box) {
        box.style.display = e.target.value === 'yes' ? 'block' : 'none';
      }
      populatePriorFilingCounties();
    });
  });


  // ─── Generate Packet Trigger ───────────────────────────────────────
  $('#btnGenerate').addEventListener('click', () => {
    if (!AppState.petitionerProfile?.fullName) {
      showToast('Please fill in the Petitioner Profile first', 'error');
      switchTab('profile');
      return;
    }
    if (!AppState.currentReport || AppState.currentReport.summary.eligible === 0) {
      showToast('No eligible cases found. Scan a MyCase page first.', 'error');
      switchTab('scan');
      return;
    }
    
    if (AppState.currentReport.crossCountyBlock && AppState.currentReport.crossCountyBlock.isSafe === false) {
      showToast('Cannot generate: Multi-county petitions must be filed within 365 days of each other (IC § 35-38-9-9(d)). Adjust dates or exclude cases.', 'error', 6000);
      return;
    }

    if (AppState.currentReport.pendingChargesBlock && AppState.currentReport.pendingChargesBlock.isSafe === false) {
      showToast('Cannot generate: Expungement petitions cannot be filed while criminal charges are pending against you (IC § 35-38-9). Resolve all pending cases first.', 'error', 8000);
      return;
    }

    // Determine target county and active cases for statutory validation
    const countySelectCard = $('#countySelectCard');
    const countySelectDropdown = $('#selectCountyPacket');
    const selectedCountyCode = (countySelectCard?.style.display !== 'none' && countySelectDropdown?.value)
      ? countySelectDropdown.value
      : null;

    let targetCountyCheck;
    if (selectedCountyCode && AppState.currentReport.counties[selectedCountyCode]) {
      targetCountyCheck = AppState.currentReport.counties[selectedCountyCode];
    } else {
      targetCountyCheck = Object.values(AppState.currentReport.counties)[0];
    }

    const casesForValidation = targetCountyCheck ? targetCountyCheck.cases : AppState.currentCases;
    const eligibleCasesForValidation = casesForValidation.filter(c => c.eligibility?.eligible);
    const hasConvictionTiers = eligibleCasesForValidation.some(c => c.eligibility?.statute && c.eligibility.statute !== 'IC § 35-38-9-1');

    // Prior Filings 365-Day Enforcement (IC § 35-38-9-9(d) applies strictly to conviction tiers)
    if (hasConvictionTiers) {
      const priorFilingYes = document.querySelector('input[name="hasPriorFiling"]:checked')?.value === 'yes';
      if (priorFilingYes) {
        const priorCounty = $('#priorFilingCounty')?.value;
        const priorDateStr = $('#priorFilingDate')?.value;
        if (!priorCounty) {
          showToast('Please select the Indiana county of your prior expungement filing.', 'error');
          return;
        }
        if (!priorDateStr) {
          showToast('Please enter the date of your prior county expungement filing.', 'error');
          return;
        }
        const priorDate = new Date(priorDateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - priorDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
        
        if (diffDays < 0) {
          showToast('Prior filing date cannot be in the future.', 'error');
          return;
        }
        
        if (diffDays > 365) {
          showToast('Cannot generate: Under IC § 35-38-9-9(d), all conviction expungement petitions in separate counties must be filed within 365 days of the first filing. Your 365-day consolidation window has expired.', 'error', 8000);
          return;
        }
        
        const daysRemaining = 365 - diffDays;
        const deadlineDate = new Date(priorDate.getTime() + 365 * 24 * 60 * 60 * 1000);
        const deadlineStr = deadlineDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        let tr6Note = '';
        if (daysRemaining <= 14) {
          tr6Note = `<br><br><em>Indiana Trial Rule 6(A) Computation Note:</em> If day 365 (${deadlineStr}) falls on a Saturday, Sunday, legal holiday, or day the clerk's office is closed, the statutory filing deadline extends to the next business day.`;
        }

        const multiCountyEl = $('#confirmMultiCountyNotice');
        const multiCountyText = $('#confirmMultiCountyText');
        if (multiCountyEl && multiCountyText) {
          multiCountyText.innerHTML = `Under IC § 35-38-9-9(d), you have <strong>${daysRemaining} day(s) remaining</strong> (until <strong>${deadlineStr}</strong>) to complete filing with the Court Clerk following your prior county filing.<br><br><strong>Critical File-Stamp Requirement:</strong> The statutory 365-day clock only stops on the date the Court Clerk file-stamps your petition—NOT the date you download this PDF packet.${tr6Note}`;
          multiCountyEl.style.display = 'block';
        }
      } else {
        const multiCountyEl = $('#confirmMultiCountyNotice');
        if (multiCountyEl) multiCountyEl.style.display = 'none';
      }
    } else {
      const multiCountyEl = $('#confirmMultiCountyNotice');
      if (multiCountyEl) multiCountyEl.style.display = 'none';
    }

    // Audit for unpaid restitution or court balance due (IC § 35-38-9 requirement)
    const casesWithUnpaidFees = casesForValidation.filter(c => {
      const bal = c.financials?.balanceDue || c.ccs?.financials?.balanceDue || 0;
      return bal > 0;
    });

    const feesEl = $('#confirmFeesNotice');
    const feesText = $('#confirmFeesText');
    if (casesWithUnpaidFees.length > 0) {
      const totalUnpaid = casesWithUnpaidFees.reduce((sum, c) => sum + (c.financials?.balanceDue || c.ccs?.financials?.balanceDue || 0), 0);
      if (feesEl && feesText) {
        feesText.innerHTML = `Our statutory audit detected an outstanding court balance or unpaid restitution of <strong>$${totalUnpaid.toFixed(2)}</strong> on case(s): <strong>${casesWithUnpaidFees.map(c => c.case_number).join(', ')}</strong>.<br><br>Under Indiana Code § 35-38-9, a court cannot grant an expungement unless all fines, fees, and restitution are fully paid. In your petition, you must affirm under penalties of perjury that all court obligations are satisfied.`;
        feesEl.style.display = 'block';
      }
    } else if (feesEl) {
      feesEl.style.display = 'none';
    }

    const acksReady = $('#ackOneShot')?.checked &&
                      $('#ackAllCounties')?.checked &&
                      $('#ackNotLawyer')?.checked &&
                      $('#ackProSe')?.checked;

    if (!acksReady) {
      showToast('You must acknowledge all mandatory legal notices and the one-shot rule before generating.', 'error', 5000);
      return;
    }

    const courtEl = $('#confirmCourtCounty');
    if (courtEl) {
      const courtName = targetCountyCheck?.courtName || (targetCountyCheck?.countyName ? `${targetCountyCheck.countyName} County Court` : (AppState.petitionerProfile?.county ? `${AppState.petitionerProfile.county} County Court` : 'Indiana Circuit / Superior Court'));
      courtEl.textContent = courtName;
    }

    // Populate the case list in the confirm modal so the user sees exactly what will be filed
    const casesToInclude = (targetCountyCheck ? targetCountyCheck.cases : AppState.currentCases).filter(c => c.eligibility?.eligible !== false);
    const caseListEl = $('#confirmCaseList');
    const caseCountEl = $('#confirmCaseCount');
    if (caseCountEl) {
      caseCountEl.textContent = casesToInclude.length;
    }
    if (caseListEl && casesToInclude.length > 0) {
      caseListEl.innerHTML = casesToInclude.map(c => {
        const num = c.case_number || 'UNKNOWN';
        const type = c.case_type || c.type || '';
        const statute = c.eligibility?.statute || '';
        return `<div class="modal-case-item">
          <span class="modal-case-num">${num}</span>
          <span class="modal-case-type">${type ? type + ' · ' : ''}${statute}</span>
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


  // ─── Build Verified Packet Payload ───────────────────────────────────
  export function buildPacketPayload() {
    if (!AppState.petitionerProfile?.fullName) {
      throw new Error('Please fill in the Petitioner Profile first');
    }
    if (!AppState.currentReport || AppState.currentReport.summary.eligible === 0) {
      throw new Error('No eligible cases found. Scan a MyCase page first.');
    }
    
    if (AppState.currentReport.crossCountyBlock && AppState.currentReport.crossCountyBlock.isSafe === false) {
      throw new Error('Cannot generate: Multi-county petitions must be filed within 365 days of each other (IC § 35-38-9-9(d)).');
    }

    if (AppState.currentReport.pendingChargesBlock && AppState.currentReport.pendingChargesBlock.isSafe === false) {
      throw new Error('Cannot generate: Criminal charges are actively pending against petitioner (IC § 35-38-9). All pending cases must be resolved before filing.');
    }

    // Determine target county (supports multi-county filing selection)
    const countySelectCard = $('#countySelectCard');
    const countySelectDropdown = $('#selectCountyPacket');
    const selectedCountyCode = (countySelectCard?.style.display !== 'none' && countySelectDropdown?.value)
      ? countySelectDropdown.value
      : null;

    const targetCounty = (selectedCountyCode && AppState.currentReport.counties[selectedCountyCode])
      ? AppState.currentReport.counties[selectedCountyCode]
      : Object.values(AppState.currentReport.counties)[0];

    // Build payload for the backend (filtered to targetCounty if multi-county)
    const eligibleCases = [];
    const casesToInclude = targetCounty ? targetCounty.cases : AppState.currentCases;

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

    const hasConvictionTiers = eligibleCases.some(c => c.statute && c.statute !== 'IC § 35-38-9-1');

    // Re-verify the prior filings check to ensure safety in executePacketGeneration
    let priorFilingPayload = { hasPrior: false };
    const priorFilingYesEx = document.querySelector('input[name="hasPriorFiling"]:checked')?.value === 'yes';
    if (hasConvictionTiers && priorFilingYesEx) {
      const priorCounty = $('#priorFilingCounty')?.value;
      const priorDateStr = $('#priorFilingDate')?.value;
      if (!priorCounty) throw new Error('Please select the Indiana county of your prior expungement filing.');
      if (!priorDateStr) throw new Error('Please enter the date of your prior county expungement filing.');
      const priorDate = new Date(priorDateStr + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24)); 
      if (diffDays > 365) {
        throw new Error('Cannot generate: Under IC § 35-38-9-9(d), all conviction expungement petitions in separate counties must be filed within 365 days of the first filing. Your 365-day window has expired.');
      }
      const priorCauseNumber = $('#priorFilingCauseNumber')?.value?.trim() || null;
      priorFilingPayload = {
        hasPrior: true,
        county: priorCounty,
        date: priorDateStr,
        causeNumber: priorCauseNumber
      };
    }

    const serviceMethod = $('#serviceMethod')?.value || ($('#eSignDocuments')?.checked ? 'iefs' : 'certified_mail');

    return {
      petitioner: AppState.petitionerProfile,
      county: targetCounty?.courtName?.replace(/\s*(Superior|Circuit|Court)\s*/gi, '').trim() || 'Unknown',
      court: targetCounty?.courtName || 'Unknown Court',
      courtCode: targetCounty?.courtCode || 'XXXXX',
      cases: eligibleCases,
      priorFiling: priorFilingPayload,
      serviceMethod: serviceMethod,
      includeFeeWaiver: $('#includeFeeWaiver')?.checked ?? true,
      includeAddressSupplement: $('#includeAddressSupplement')?.checked ?? true,
      eSignDocuments: $('#eSignDocuments')?.checked ?? false,
      acknowledgedOneShot: $('#ackOneShot')?.checked ?? true,
      acknowledgedNotLawyer: $('#ackNotLawyer')?.checked ?? true,
      acknowledgedProSeLiability: $('#ackProSe')?.checked ?? true
    };
  }

  // ─── Execute Packet Generation (Backend Call) ──────────────────────
  async function executePacketGeneration() {
    const btn = $('#btnGenerate');
    const statusEl = $('#generateStatus');
    const statusText = $('#generateStatusText');

    btn.disabled = true;
    statusEl.style.display = 'flex';
    statusText.textContent = 'Preparing verified payload...';

    try {
      const payload = buildPacketPayload();

      statusText.textContent = 'Generating complete expungement packet (Forms 00–08)...';

      const pdfBytes = await generateCompletePacket(payload);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const countyName = (payload.county || 'expungement').replace(/\s+/g, '_');
      const petitionerLast = (payload.petitioner?.fullName || 'packet').split(/\s+/).pop();
      const filename = `${petitionerLast}_${countyName}_Expungement_Packet.pdf`;

      await downloadPetition(blob, filename);
      showToast(`Complete court packet generated: ${filename}`, 'success', 6000);
      statusText.textContent = `✓ Download started: ${filename}`;
    } catch (e) {
      showToast(e.message, 'error');
      statusText.textContent = `✗ ${e.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => { statusEl.style.display = 'none'; }, 6000);
    }
  }

  // ─── PDF Preview Mode (In-App Document Viewer) ─────────────────────
  let activePreviewBlobUrl = null;
  let activePreviewBlob = null;
  let activePreviewFilename = '';

  export function closePdfPreview() {
    const modal = $('#pdfPreviewModal');
    if (modal) modal.style.display = 'none';
    if (activePreviewBlobUrl) {
      URL.revokeObjectURL(activePreviewBlobUrl);
      activePreviewBlobUrl = null;
    }
    activePreviewBlob = null;
  }

  export async function openPdfPreview(targetForm = 'all') {
    const modal = $('#pdfPreviewModal');
    const iframe = $('#pdfPreviewFrame');
    const loading = $('#previewLoadingState');
    const titleEl = $('#previewModalTitle');
    const subtitleEl = $('#previewModalSubtitle');
    const selector = $('#previewDocSelector');

    if (!modal) return;

    try {
      const payload = buildPacketPayload();
      payload.targetForm = targetForm;

      modal.style.display = 'flex';
      if (loading) loading.style.display = 'flex';
      if (iframe) iframe.style.display = 'none';
      if (selector) selector.value = targetForm;

      const formTitles = {
        all: 'Complete Expungement Petition Packet (Forms 00–08)',
        form00: 'Form 00 — Instructions & Warnings Cover Sheet',
        form01: 'Form 01 — Appearance Form (Trial Rule 3.1)',
        form02: 'Form 02 — Notice of Exclusion of Confidential Information (ACR)',
        form03: 'Form 03 — Confidential Information & 10-Year Address Supplement',
        form04: 'Form 04 — Verified Petition for Expungement of Records',
        form05: 'Form 05 — Notice of Filing to Prosecuting Attorney',
        form06: 'Form 06 — Certificate of Service',
        form07: 'Form 07 — Proposed Order Granting Expungement',
        form08: 'Form 08 — Verified Motion to Proceed In Forma Pauperis (Fee Waiver)'
      };

      if (titleEl) {
        titleEl.textContent = formTitles[targetForm] || 'Court Document Preview';
      }
      if (subtitleEl) {
        const countyName = payload.court || payload.county || 'Indiana Court';
        subtitleEl.textContent = `${countyName} · Petitioner: ${payload.petitioner?.fullName || 'Pro Se'}`;
      }

      const pdfBytes = await generateCompletePacket(payload);
      activePreviewBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      if (activePreviewBlobUrl) {
        URL.revokeObjectURL(activePreviewBlobUrl);
        activePreviewBlobUrl = null;
      }
      activePreviewBlobUrl = URL.createObjectURL(activePreviewBlob);

      const countyClean = (payload.county || 'expungement').replace(/\s+/g, '_');
      const petitionerLast = (payload.petitioner?.fullName || 'packet').split(/\s+/).pop();
      const suffix = targetForm === 'all' ? 'Packet' : targetForm.toUpperCase();
      activePreviewFilename = `${petitionerLast}_${countyClean}_${suffix}.pdf`;

      if (iframe) {
        iframe.src = `${activePreviewBlobUrl}#toolbar=1&navpanes=1`;
        iframe.style.display = 'block';
      }
      if (loading) loading.style.display = 'none';
    } catch (err) {
      if (loading) loading.style.display = 'none';
      showToast(err.message, 'error');
      if (modal) modal.style.display = 'none';
    }
  }

  function initPdfPreviewControls() {
    $('#btnPreview')?.addEventListener('click', () => {
      openPdfPreview('all');
    });

    $('#previewDocSelector')?.addEventListener('change', (e) => {
      openPdfPreview(e.target.value);
    });

    $('#btnPreviewClose')?.addEventListener('click', closePdfPreview);
    $('#btnPreviewCloseFooter')?.addEventListener('click', closePdfPreview);

    $('#btnPreviewPrint')?.addEventListener('click', () => {
      const iframe = $('#pdfPreviewFrame');
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          if (activePreviewBlobUrl) {
            const printWin = window.open(activePreviewBlobUrl, '_blank');
            if (printWin) printWin.focus();
          }
        }
      }
    });

    $('#btnPreviewDownload')?.addEventListener('click', async () => {
      if (activePreviewBlob && activePreviewFilename) {
        await downloadPetition(activePreviewBlob, activePreviewFilename);
        showToast(`Downloaded: ${activePreviewFilename}`, 'success');
      }
    });

    // Close preview on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = $('#pdfPreviewModal');
        if (modal && modal.style.display !== 'none') {
          closePdfPreview();
        }
      }
    });

    // Close on backdrop click
    $('#pdfPreviewModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'pdfPreviewModal') {
        closePdfPreview();
      }
    });
  }

  // ─── Filing & Service Address Directory ───────────────────────────
  export function renderServiceDirectory(countyName) {
    const container = $('#serviceDirBody');
    if (!container) return;

    const countyInfo = getCountyInfo(countyName);
    const isp = STATEWIDE_AGENCIES.isp;
    const bmv = STATEWIDE_AGENCIES.bmv;

    const agencies = [
      {
        title: countyInfo.clerk.title,
        badge: 'Filing Court',
        badgeClass: 'clerk',
        addr: `${countyInfo.clerk.address}, ${countyInfo.clerk.city}, ${countyInfo.clerk.state} ${countyInfo.clerk.zip}`,
        phone: countyInfo.clerk.phone,
        method: 'File original verified petition in person or via Odyssey E-Filing'
      },
      {
        title: countyInfo.prosecutor.title,
        badge: 'Service Party',
        badgeClass: '',
        addr: `${countyInfo.prosecutor.address}, ${countyInfo.prosecutor.city}, ${countyInfo.prosecutor.state} ${countyInfo.prosecutor.zip}`,
        phone: countyInfo.prosecutor.phone,
        method: countyInfo.prosecutor.serviceNotes || 'Certified U.S. Mail or IEFS e-service'
      },
      {
        title: isp.name,
        badge: 'Statutory Repository',
        badgeClass: '',
        addr: `${isp.address}, ${isp.city}, ${isp.state} ${isp.zip}`,
        phone: isp.phone,
        method: isp.serviceMethod
      },
      {
        title: bmv.name,
        badge: 'State Agency',
        badgeClass: '',
        addr: `${bmv.address}, ${bmv.city}, ${bmv.state} ${bmv.zip}`,
        phone: bmv.phone,
        method: bmv.serviceMethod
      },
      {
        title: countyInfo.sheriff.title,
        badge: 'Law Enforcement',
        badgeClass: '',
        addr: `${countyInfo.sheriff.address}, ${countyInfo.sheriff.city}, ${countyInfo.sheriff.state} ${countyInfo.sheriff.zip}`,
        phone: countyInfo.sheriff.phone,
        method: 'Certified U.S. Mail or Hand Delivery'
      }
    ];

    container.innerHTML = agencies.map((a, idx) => `
      <div class="service-agency-item">
        <div class="service-agency-header">
          <span class="service-agency-title">${a.title}</span>
          <span class="service-agency-badge ${a.badgeClass}">${a.badge}</span>
        </div>
        <div class="service-agency-addr">${a.addr}</div>
        <div class="service-agency-meta">
          <span>📞 ${a.phone} · <em>${a.method}</em></span>
          <button type="button" class="btn-copy-addr" data-copy-idx="${idx}" title="Copy statutory service address to clipboard">
            📋 Copy
          </button>
        </div>
      </div>
    `).join('');

    // Attach clipboard copy listeners
    container.querySelectorAll('.btn-copy-addr').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.copyIdx, 10);
        const target = agencies[idx];
        if (!target) return;
        const copyText = `${target.title}\n${target.addr}`;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(copyText).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = '✓ Copied!';
            btn.style.borderColor = '#10b981';
            btn.style.color = '#059669';
            setTimeout(() => {
              btn.innerHTML = orig;
              btn.style.borderColor = '';
              btn.style.color = '';
            }, 2000);
            showToast(`Copied address for ${target.title}`, 'info', 2000);
          }).catch(() => {
            showToast('Unable to copy address to clipboard', 'error');
          });
        }
      });
    });
  }

  export function syncDirectoryCounty(countyName) {
    const select = $('#selectDirectoryCounty');
    if (!select || !countyName) return;

    const target = countyName.trim().replace(/\s+(County|Superior|Circuit).*$/i, '').trim();
    // Look for matching option
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value.toLowerCase() === target.toLowerCase()) {
        select.selectedIndex = i;
        renderServiceDirectory(select.options[i].value);
        return;
      }
    }
  }

  export function initServiceDirectory() {
    const select = $('#selectDirectoryCounty');
    if (!select) return;

    const counties = getAvailableCounties();
    select.innerHTML = counties.map(c => `<option value="${c}">${c} County</option>`).join('');

    select.addEventListener('change', () => {
      renderServiceDirectory(select.value);
    });

    const initial = counties[0] || 'Marion';
    select.value = initial;
    renderServiceDirectory(initial);

    // Auto-sync when multi-county dropdown changes
    $('#selectCountyPacket')?.addEventListener('change', (e) => {
      const selectedCode = e.target.value;
      if (selectedCode && AppState.currentReport?.counties?.[selectedCode]) {
        const courtName = AppState.currentReport.counties[selectedCode].courtName;
        syncDirectoryCounty(courtName);
      }
      updateChecklist();
    });

    // Auto-sync when Generate tab is opened
    document.querySelector('.tab-btn[data-tab="generate"]')?.addEventListener('click', () => {
      populatePriorFilingCounties();
      updateChecklist();
      if (AppState.currentReport?.counties) {
        const selectedCode = $('#selectCountyPacket')?.value;
        const targetCounty = (selectedCode && AppState.currentReport.counties[selectedCode])
          ? AppState.currentReport.counties[selectedCode]
          : Object.values(AppState.currentReport.counties)[0];
        if (targetCounty?.courtName) {
          syncDirectoryCounty(targetCounty.courtName);
        }
      }
    });
  }

  // Initialize service directory & prior filing counties & PDF preview controls
  initServiceDirectory();
  populatePriorFilingCounties();
  initPdfPreviewControls();
