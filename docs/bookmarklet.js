/**
 * Indiana Expungement Assistant - Standalone Bookmarklet & Exporter
 * Runs directly in the user's browser tab on public.courts.in.gov/mycase
 * 
 * Extracts case records and deep Chronological Case Summaries (CCS),
 * then downloads a formatted JSON bundle for instant upload into the
 * Indiana Expungement Assistant web app.
 * 
 * This bookmarklet acts as the critical bridge for the Web App (PWA) 
 * because the PWA cannot fetch CCS data directly due to browser CORS limits.
 * 
 * 100% Client-Side · Zero Tracking · Preserves Full Session Privacy
 */
(function () {
  'use strict';

  // Prevent multiple overlay instances
  const EXISTING_OVERLAY_ID = 'iea-bookmarklet-overlay';
  const existing = document.getElementById(EXISTING_OVERLAY_ID);
  if (existing) {
    existing.remove();
  }

  // ─── 1. Check Domain ───────────────────────────────────────────────
  const host = window.location.hostname.toLowerCase();
  const isMyCase = host.includes('courts.in.gov') || host.includes('mycase.in.gov');

  if (!isMyCase) {
    alert(
      '⚖️ Indiana Expungement Assistant Bookmarklet\n\n' +
      'Please navigate to Indiana MyCase (https://public.courts.in.gov/mycase) and perform your search before clicking this bookmarklet.'
    );
    return;
  }

  // ─── 2. Create Floating UI Modal ───────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = EXISTING_OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(10, 18, 38, 0.75);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 99999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    box-sizing: border-box;
  `;

  overlay.innerHTML = `
    <div style="
      background: #ffffff;
      width: 90%;
      max-width: 520px;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: ieaFadeIn 0.25s ease-out;
    ">
      <style>
        @keyframes ieaFadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .iea-btn-primary {
          background: #1e3a8a;
          color: #ffffff;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.15s, transform 0.1s;
          box-shadow: 0 4px 6px -1px rgba(30, 58, 138, 0.2);
        }
        .iea-btn-primary:hover { background: #1d4ed8; }
        .iea-btn-primary:active { transform: translateY(1px); }
        .iea-btn-secondary {
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .iea-btn-secondary:hover { background: #e2e8f0; }
        .iea-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: ieaSpin 0.7s linear infinite;
        }
        @keyframes ieaSpin { to { transform: rotate(360deg); } }
      </style>

      <!-- Modal Header -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 20px 24px; color: #ffffff;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">⚖️</span>
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: #ffffff;">Indiana Expungement Assistant</h3>
              <p style="margin: 2px 0 0; font-size: 12px; color: #93c5fd; opacity: 0.9;">MyCase Record & CCS Exporter</p>
            </div>
          </div>
          <button id="iea-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; padding: 4px; line-height: 1;" title="Close">&times;</button>
        </div>
      </div>

      <!-- Modal Body -->
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px;" id="iea-modal-content">
        <div id="iea-initial-view">
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #334155;">
            Ready to export your search results and Chronological Case Summaries (CCS) directly from your active MyCase session.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #475569;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-weight: 600; color: #1e293b;">
              <span>🔒 100% In-Browser Privacy</span>
            </div>
            Data is exported directly to a <code>.json</code> file on your computer. Zero external tracking or servers.
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="iea-start-deep" class="iea-btn-primary" style="width: 100%; padding: 14px;">
              <span>⚡ Full Deep Export (Search Results + CCS Details)</span>
            </button>
            <button id="iea-start-quick" class="iea-btn-secondary" style="width: 100%;">
              <span>Quick Export (Search Results Only)</span>
            </button>
          </div>
        </div>

        <div id="iea-progress-view" style="display: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span id="iea-progress-status" style="font-size: 13px; font-weight: 600; color: #1e3a8a;">Scanning search results...</span>
            <span id="iea-progress-pct" style="font-size: 12px; font-weight: 700; color: #64748b;">0%</span>
          </div>
          <div style="background: #e2e8f0; border-radius: 999px; height: 8px; overflow: hidden; width: 100%; margin-bottom: 12px;">
            <div id="iea-progress-bar" style="background: linear-gradient(90deg, #2563eb, #3b82f6); width: 0%; height: 100%; transition: width 0.3s ease;"></div>
          </div>
          <div id="iea-progress-detail" style="font-size: 12px; color: #64748b; font-family: monospace; min-height: 18px; word-break: break-all;">
            Initializing scraper...
          </div>
        </div>

        <div id="iea-success-view" style="display: none; text-align: center;">
          <div style="width: 48px; height: 48px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 12px;">
            ✓
          </div>
          <h4 style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #0f172a;">Export Completed!</h4>
          <p id="iea-success-msg" style="margin: 0 0 16px; font-size: 13px; color: #475569; line-height: 1.4;">
            Your case records and CCS details were downloaded as <b>mycase-expungement-data.json</b>.
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <a href="https://cambrianminds.github.io/exp-2/app/app.html" target="_blank" class="iea-btn-primary" style="text-decoration: none; padding: 12px;">
              <span>Open Assistant Web App &amp; Upload ↗</span>
            </a>
            <button id="iea-done-btn" class="iea-btn-secondary">
              <span>Close Window</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const closeBtn = document.getElementById('iea-close-btn');
  const doneBtn = document.getElementById('iea-done-btn');
  const closeOverlay = () => overlay.remove();
  if (closeBtn) closeBtn.onclick = closeOverlay;
  if (doneBtn) doneBtn.onclick = closeOverlay;

  // ─── 3. Scraping Engine ────────────────────────────────────────────

  function cleanHtml(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  function cleanCharges(charges) {
    if (!charges) return '';
    let clean = charges.replace(/\*{3}\s*REFERENCE CCS ENTRY\s*\*{3}/gi, '').trim();
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isSearchResultsPage() {
    return window.location.href.includes('SearchResults') || document.querySelector('tr.result-row') !== null;
  }

  function getSearchContext() {
    try {
      const last = document.querySelector('input[id*="LastName" i], input[name*="LastName" i]')?.value?.trim();
      const first = document.querySelector('input[id*="FirstName" i], input[name*="FirstName" i]')?.value?.trim();
      const nameParts = [last, first].filter(Boolean);
      if (nameParts.length > 0) return nameParts.join(', ');

      const summaryEl = document.querySelector('.search-summary, .search-criteria, .k-header-column-menu, .breadcrumb');
      if (summaryEl && summaryEl.innerText?.trim()) {
        const text = summaryEl.innerText.trim().replace(/\s+/g, ' ');
        if (text.length > 0 && text.length < 60) return text;
      }

      const title = document.title || '';
      const titleMatch = title.match(/MyCase\s*[-–]\s*(.+)/i);
      if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
    } catch (_) {
      /* Fallback to default search context if parsing fails */
    }
    return 'MyCase Search';
  }

  function normalizeKnockoutModel(model, index, getValue) {
    const caseNumber = getValue(model.CaseNumber) || '';
    const style = getValue(model.Style) || '';
    const court = getValue(model.Court) || '';
    const caseType = getValue(model.CaseType) || '';
    const caseSubType = getValue(model.CaseSubType) || '';
    const fileDate = getValue(model.FileDate) || '';
    const statusDate = getValue(model.CaseStatusDate) || '';
    const status = getValue(model.CaseStatus) || '';
    const charges = getValue(model.Charges) || '';
    const parties = getValue(model.Parties) || '';
    const attorneys = getValue(model.Attorneys) || '';
    const caseToken = getValue(model.CaseToken) || getValue(model.CaseID) || '';

    const fullCaseType = caseSubType ? `${caseType}, ${caseSubType}` : caseType;
    const fullStatus = statusDate ? `${statusDate}, ${status}` : status;
    const dispMatch = (statusDate || fullStatus).match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const dispositionDate = dispMatch ? dispMatch[1] : (statusDate || '');

    return {
      index: index + 1,
      case_number: caseNumber,
      title: cleanHtml(style),
      court: court,
      case_type: fullCaseType,
      filed: fileDate,
      status: fullStatus,
      dispositionDate: dispositionDate,
      charges: cleanCharges(charges),
      parties: parties,
      attorneys: attorneys,
      caseToken: caseToken,
      _source: 'knockout'
    };
  }

  function tryKnockoutExtraction() {
    try {
      if (typeof ko === 'undefined' || !ko.dataFor) return null;

      let results = null;

      // 1. Check results table / ViewModel
      const table = document.querySelector('table');
      if (table) {
        const tableData = ko.dataFor(table);
        if (tableData && tableData.ob && tableData.ob.Results) {
          results = typeof tableData.ob.Results === 'function'
            ? tableData.ob.Results()
            : tableData.ob.Results;
        }
      }

      // 2. Check row context's parent ViewModel
      if (!results) {
        const firstRow = document.querySelector('tr.result-row');
        if (firstRow && ko.contextFor) {
          const ctx = ko.contextFor(firstRow);
          if (ctx && ctx.$parent && ctx.$parent.ob && ctx.$parent.ob.Results) {
            results = typeof ctx.$parent.ob.Results === 'function'
              ? ctx.$parent.ob.Results()
              : ctx.$parent.ob.Results;
          }
        }
      }

      // 3. Direct Row Data Extraction
      if (!results) {
        const rows = document.querySelectorAll('tr.result-row');
        if (rows && rows.length > 0) {
          const getValue = (prop) => (!prop ? '' : typeof prop === 'function' ? prop() : prop);
          const directCases = [];
          rows.forEach((r, idx) => {
            const data = ko.dataFor(r);
            if (data && (data.CaseNumber || data.CaseID || data.Style)) {
              directCases.push(normalizeKnockoutModel(data, idx, getValue));
            }
          });
          if (directCases.length > 0) return directCases;
        }
      }

      // 4. Fallback to legacy OD_BODY container
      if (!results) {
        const container = document.getElementById('OD_BODY');
        if (container) {
          const koContext = ko.dataFor(container);
          if (koContext && koContext.ob && koContext.ob.Results) {
            results = typeof koContext.ob.Results === 'function'
              ? koContext.ob.Results()
              : koContext.ob.Results;
          }
        }
      }

      if (!results || !Array.isArray(results)) return null;

      const getValue = (prop) => (!prop ? '' : typeof prop === 'function' ? prop() : prop);

      return results.map((model, index) => normalizeKnockoutModel(model, index, getValue));
    } catch (e) {
      console.warn('[Bookmarklet] Knockout extraction unavailable:', e);
      return null;
    }
  }

  function tryScrapeDOM() {
    const rows = document.querySelectorAll('tr.result-row');
    const cases = [];

    rows.forEach((row, index) => {
      try {
        const titleEl = row.querySelector('.result-title');
        const caseNumEl = row.querySelector('.result-subtitle[title="Case Number"]');
        const detailRows = row.querySelectorAll('.result-row-details .row');

        const caseData = {
          index: index + 1,
          case_number: caseNumEl ? caseNumEl.textContent.trim() : '',
          title: titleEl ? cleanHtml(titleEl.textContent.trim()) : '',
          court: '',
          case_type: '',
          filed: '',
          status: '',
          charges: '',
          parties: '',
          attorneys: '',
          caseToken: '',
          dispositionDate: '',
          _source: 'dom'
        };

        detailRows.forEach(detailRow => {
          const label = detailRow.querySelector('.text-muted');
          const value = detailRow.querySelector('.col-sm-10 .small, .col-xs-11 .small');
          if (!label || !value) return;

          const labelText = label.textContent.trim().toLowerCase();
          const valueText = value.textContent.trim();

          switch (labelText) {
            case 'court': caseData.court = valueText; break;
            case 'case type': caseData.case_type = valueText; break;
            case 'filed': caseData.filed = valueText; break;
            case 'status': caseData.status = valueText; break;
            case 'charges': caseData.charges = cleanCharges(valueText); break;
            case 'parties': caseData.parties = valueText; break;
            case 'attorneys': caseData.attorneys = valueText; break;
          }
        });

        if (caseData.status) {
          const dispMatch = caseData.status.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dispMatch) caseData.dispositionDate = dispMatch[1];
        }

        if (!caseData.filed) {
          const rightCol = row.querySelector('.result-col-right .small[data-bind*="FileDate"]');
          if (rightCol) caseData.filed = rightCol.textContent.trim();
        }

        if (titleEl) {
          let href = titleEl.getAttribute('href') || '';
          if (!href) {
             const a = titleEl.querySelector('a');
             if (a) href = a.getAttribute('href') || '';
          }
          const hrefMatch = href.match(/CaseToken=([^&]+)/i);
          if (hrefMatch) {
            caseData.caseToken = hrefMatch[1];
          } else {
            const onclick = titleEl.getAttribute('onclick') || '';
            const tokenMatch = onclick.match(/CaseToken[=:][\s'"]*([^'"&]+)/i);
            if (tokenMatch) caseData.caseToken = tokenMatch[1];
          }
        }
        
        // Ultimate fallback: regex the row's innerHTML
        if (!caseData.caseToken) {
           const htmlMatch = row.innerHTML.match(/CaseToken=([^&"'>\s]+)/i);
           if (htmlMatch) caseData.caseToken = htmlMatch[1];
        }

        // Knockout row-level fallback
        if (!caseData.caseToken && typeof ko !== 'undefined' && ko.dataFor) {
           try {
             const ctx = ko.dataFor(row);
             if (ctx) {
               caseData.caseToken = ctx.CaseToken || ctx.CaseID || (ctx.model && (ctx.model.CaseToken || ctx.model.CaseID)) || '';
             }
           } catch (e) {
             /* Knockout dataFor binding unavailable for row */
           }
        }

        if (caseData.case_number) {
          cases.push(caseData);
        }
      } catch (e) {
        console.warn(`[Bookmarklet] Error parsing row ${index}:`, e);
      }
    });

    return cases;
  }

  function parseCCSJson(json) {
    const ccsData = {
      charges: [],
      docketEntries: [],
      financialSummary: null,
      arrestingAgency: null,
      sentenceDetails: null,
      dispositionDate: ''
    };

    // Extract charges from the JSON Charges array
    if (Array.isArray(json.Charges)) {
      json.Charges.forEach(charge => {
        let offense = charge.OffenseDescription || '';

        // For old converted cases, OffenseDescription is the useless placeholder
        // "SEE CCS ENTRY FOR OFFENSE DESCRIPTION". The real offense text is buried
        // in the CCS Events array inside CaseEvent.Comment fields like:
        //   "COUNT 1 75/55 SPEED X I  (RJO? N) | JTS Minute Entry Date: ..."
        if (offense.toUpperCase().includes('SEE CCS ENTRY') && Array.isArray(json.Events)) {
          const chargeNum = charge.ChargeNumber || '01';

          // First pass: look for a COUNT comment matching this charge number
          for (const evt of json.Events) {
            if (evt.CaseEvent && evt.CaseEvent.Comment) {
              const comment = evt.CaseEvent.Comment;
              const pat = new RegExp('(?:COUNT|CT\\.?|CHARGE)\\s*' + chargeNum + '\\s*[:\\-]?\\s+(.+?)(?:\\s*\\(RJO|\\s*\\||$)', 'i');
              const m = comment.match(pat);
              if (m) {
                offense = m[1].trim();
                break;
              }
            }
          }

          // Second pass: if still placeholder, try any COUNT pattern
          if (offense.toUpperCase().includes('SEE CCS ENTRY')) {
            for (const evt of json.Events) {
              if (evt.CaseEvent && evt.CaseEvent.Comment) {
                const comment = evt.CaseEvent.Comment;
                const m = comment.match(/(?:COUNT|CT\.?|CHARGE)\s*\d+\s*[:-]?\s+(.+?)(?:\s*\(RJO|\s*\||$)/i);
                if (m) {
                  offense = m[1].trim();
                  break;
                }
              }
            }
          }

          // Third pass: use the first non-calendar event comment as a description
          if (offense.toUpperCase().includes('SEE CCS ENTRY')) {
            for (const evt of json.Events) {
              if (evt.CaseEvent && evt.CaseEvent.Comment) {
                const comment = evt.CaseEvent.Comment;
                if (!comment.includes('Calendar:') && !comment.includes('ALL FILINGS')) {
                  const clean = comment.split('|')[0].replace(/\(RJO\?\s*\w\)/g, '').trim();
                  if (clean.length > 5 && clean.length < 200) {
                    offense = clean;
                    break;
                  }
                }
              }
            }
          }
        }

        ccsData.charges.push({
          count: charge.ChargeNumber || '',
          offense: offense,
          statute: charge.OffenseStatute || '',
          level: charge.OffenseDegree || '',
          disposition: ''
        });
      });
    }

    // Extract disposition info from disposition events
    if (Array.isArray(json.Events)) {
      json.Events.forEach(evt => {
        if (evt.DispEvent) {
          if (evt.EventDate && !ccsData.dispositionDate) {
            ccsData.dispositionDate = evt.EventDate;
          }
          if (Array.isArray(evt.DispEvent.Charges)) {
            evt.DispEvent.Charges.forEach(dc => {
              const match = ccsData.charges.find(c => {
                if (c.count === dc.ChargeNumber) return true;
                const cClean = String(c.count || '').replace(/^0+/, '');
                const dcClean = String(dc.ChargeNumber || '').replace(/^0+/, '');
                return Boolean(cClean && cClean === dcClean);
              });
              if (match) {
                if (dc.DispositionType) match.disposition = dc.DispositionType;
                if (evt.EventDate && !match.dispositionDate) match.dispositionDate = evt.EventDate;
              }
            });
          }
        }
      });
    }

    // Extract docket entries and audit restitution & sentence milestones from events
    let hasRestitutionOrder = false;
    let hasRestitutionSatisfaction = false;
    let sentenceDischargeDate = null;

    if (Array.isArray(json.Events)) {
      json.Events.forEach(evt => {
        const evtDesc = (evt.Description || '').toUpperCase();
        const comment = (evt.CaseEvent?.Comment || '').toUpperCase();
        const combinedText = `${evtDesc} ${comment}`;

        if (combinedText.includes('RESTITUTION') || combinedText.includes('RESTITUTION ORDERED')) {
          hasRestitutionOrder = true;
        }
        if (combinedText.includes('RESTITUTION SATISFACTION') || combinedText.includes('RESTITUTION PAID') || combinedText.includes('SATISFACTION OF JUDGMENT')) {
          hasRestitutionSatisfaction = true;
        }
        if (combinedText.includes('PROBATION DISCHARGED') || combinedText.includes('COMMITMENT TERMINATED') || combinedText.includes('SENTENCE SATISFIED') || combinedText.includes('RELEASED FROM PROBATION')) {
          if (evt.EventDate && !sentenceDischargeDate) {
            sentenceDischargeDate = evt.EventDate;
          }
        }

        ccsData.docketEntries.push({
          date: evt.EventDate || '',
          type: evt.EventType || '',
          description: evt.Description || '',
          text: evt.CaseEvent ? evt.CaseEvent.Comment || '' : ''
        });
      });
    }

    // Extract financial fee summary from defendant party
    let balanceDueNum = 0;
    let balanceStr = '$0.00';

    if (Array.isArray(json.Parties)) {
      const defendant = json.Parties.find(p => {
        const conn = (p.BaseConnKey || '').toUpperCase();
        const role = (p.Connection || p.Role || '').toUpperCase();
        return conn === 'DF' || conn === 'DFT' || conn === 'DEF' || role.includes('DEFENDANT');
      }) || json.Parties[0];
      if (defendant && defendant.FeeSummary) {
        balanceStr = defendant.FeeSummary.Balance || '$0.00';
        const parsedNum = parseFloat(String(balanceStr).replace(/[^0-9.-]+/g, ''));
        balanceDueNum = isNaN(parsedNum) ? 0 : parsedNum;

        ccsData.financialSummary = {
          balance: balanceStr,
          asOf: defendant.FeeSummary.AsOf || '',
          categories: defendant.FeeSummary.Categories || []
        };
      }
    }

    ccsData.financials = {
      balanceDue: balanceDueNum,
      balanceFormatted: balanceStr,
      restitutionOrdered: hasRestitutionOrder,
      restitutionSatisfied: hasRestitutionOrder ? (hasRestitutionSatisfaction && balanceDueNum <= 0) : true,
      sentenceCompletedDate: sentenceDischargeDate
    };

    return ccsData;
  }

  async function fetchCCS(caseToken) {
    if (!caseToken) return null;
    try {
      const url = `https://public.courts.in.gov/mycase/Case/CaseSummary?SRCT=&CaseToken=${encodeURIComponent(caseToken)}&_=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) return null;
      const json = await response.json();
      if (json.InvalidToken || json.CaseNotFound || json.AccessDenied) return null;
      return parseCCSJson(json);
    } catch (e) {
      console.warn(`[Bookmarklet] CCS fetch failed for ${caseToken}:`, e);
      return null;
    }
  }

  function downloadJson(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'mycase-expungement-data.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ─── 4. Run Export Pipeline ────────────────────────────────────────

  async function executeExport(deepScrape = true) {
    const initialView = document.getElementById('iea-initial-view');
    const progressView = document.getElementById('iea-progress-view');
    const successView = document.getElementById('iea-success-view');
    const progressStatus = document.getElementById('iea-progress-status');
    const progressPct = document.getElementById('iea-progress-pct');
    const progressBar = document.getElementById('iea-progress-bar');
    const progressDetail = document.getElementById('iea-progress-detail');
    const successMsg = document.getElementById('iea-success-msg');

    initialView.style.display = 'none';
    progressView.style.display = 'block';

    try {
      progressStatus.textContent = 'Extracting search results...';
      progressDetail.textContent = 'Checking Knockout observable & DOM tables...';

      let cases = tryKnockoutExtraction();
      if (!cases || cases.length === 0) {
        cases = tryScrapeDOM();
      }

      if (!cases || cases.length === 0) {
        alert('No cases found on this MyCase page. Please ensure search results are visible.');
        overlay.remove();
        return;
      }

      const searchContext = getSearchContext();
      cases.forEach(c => {
        c.searchContext = searchContext;
        c.searchQueries = [searchContext];
      });

      progressBar.style.width = '20%';
      progressPct.textContent = '20%';
      progressStatus.textContent = `Found ${cases.length} case${cases.length === 1 ? '' : 's'}`;

      if (deepScrape) {
        progressStatus.textContent = `Deep scraping CCS records (0 of ${cases.length})...`;
        for (let i = 0; i < cases.length; i++) {
          const c = cases[i];
          const pct = Math.round(20 + ((i + 1) / cases.length) * 75);
          progressBar.style.width = `${pct}%`;
          progressPct.textContent = `${pct}%`;
          progressStatus.textContent = `Deep scraping CCS records (${i + 1} of ${cases.length})...`;
          progressDetail.textContent = `Fetching CCS for ${c.case_number || c.caseToken || 'Case #' + (i + 1)}...`;

          if (c.caseToken) {
            c.ccs = await fetchCCS(c.caseToken);
            
            if (c.ccs && c.ccs.dispositionDate && !c.dispositionDate) {
              c.dispositionDate = c.ccs.dispositionDate;
            }

            // Clean up the main charges string if we found better data
            if (c.ccs && Array.isArray(c.ccs.charges) && c.ccs.charges.length > 0) {
              if (!c.charges || c.charges.toUpperCase().includes('SEE CCS ENTRY')) {
                c.charges = c.ccs.charges.map(ch => `${ch.count ? 'Count ' + ch.count + ': ' : ''}${ch.offense} (${ch.level || ''})`).join('; ');
              }
            }

            // Natural delay: 800-1500ms between deep-scrape requests to mimic human browsing and prevent rate limiting
            if (i < cases.length - 1) {
              await sleep(800 + Math.random() * 700);
            }
          }
        }
      }

      progressBar.style.width = '100%';
      progressPct.textContent = '100%';
      progressStatus.textContent = 'Generating JSON download...';
      progressDetail.textContent = 'Formatting case objects and timestamps...';

      const exportPayload = {
        source: 'Indiana Expungement Assistant Bookmarklet',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        searchContext: searchContext,
        totalCases: cases.length,
        hasCCS: deepScrape,
        cases: cases
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      downloadJson(exportPayload, `mycase-expungement-data-${dateStr}.json`);

      progressView.style.display = 'none';
      successView.style.display = 'block';
      if (successMsg) {
        successMsg.innerHTML = `Successfully exported <b>${cases.length} case record${cases.length === 1 ? '' : 's'}</b> (${deepScrape ? 'with detailed CCS docket & charges' : 'search results only'}) to <b>mycase-expungement-data-${dateStr}.json</b>.`;
      }

    } catch (err) {
      console.error('[Bookmarklet Error]', err);
      alert('Error exporting cases: ' + err.message);
      overlay.remove();
    }
  }

  document.getElementById('iea-start-deep')?.addEventListener('click', () => executeExport(true));
  document.getElementById('iea-start-quick')?.addEventListener('click', () => executeExport(false));

})();
