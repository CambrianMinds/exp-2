// ─── Odyssey Network Interception (MAIN Execution World) ───────────
if (typeof window !== 'undefined' && !window._odysseyInterceptionActive) {
  window._odysseyInterceptionActive = true;
  window._odysseyDataInterceptedCache = window._odysseyDataInterceptedCache || new Map();

  const _origFetch = window.fetch;
  if (_origFetch) {
    window.fetch = async function (...args) {
      const response = await _origFetch.apply(window, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if (url && (url.includes('/Case/') || url.includes('CaseSummary') || url.includes('CaseSearch') || url.includes('PrintCCS'))) {
          const clone = response.clone();
          clone.json().then(data => {
            if (data) {
              window._odysseyDataInterceptedCache.set(url, data);
              window.dispatchEvent(new CustomEvent('OdysseyDataIntercepted', { detail: { url, data } }));
            }
          }).catch(() => {
            /* Non-JSON payload or stream unreadable */
          });
        }
      } catch (_e) {
        /* Network intercept error in page context */
      }
      return response;
    };
  }

  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.open) {
    const _origOpen = XMLHttpRequest.prototype.open;
    const _origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._interceptUrl = url;
      return _origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', () => {
        try {
          const url = this._interceptUrl || '';
          if (url && (url.includes('/Case/') || url.includes('CaseSummary') || url.includes('CaseSearch') || url.includes('PrintCCS'))) {
            const data = JSON.parse(this.responseText);
            if (data) {
              window._odysseyDataInterceptedCache.set(url, data);
              window.dispatchEvent(new CustomEvent('OdysseyDataIntercepted', { detail: { url, data } }));
            }
          }
        } catch (_e) {
          /* responseText is not JSON or unreadable */
        }
      });
      return _origSend.apply(this, args);
    };
  }
}

const MyCaseScraper = (() => {

  // ─── DOM Scraping: Search Results Page ───────────────────────────────

  /**
   * Scrape all case records from the current MyCase search results page.
   * Works on both the list view and the expanded detail view.
   * 
   * Strategy:
   *  1. Try Knockout.js observable model first (cleanest data)
   *  2. Fall back to DOM text extraction from result rows
   * 
   * @returns {Array} Array of normalized case objects
   */
  function scrapeSearchResults(rootElement = document) {
    if (!isSearchResultsPage(rootElement)) {
      throw new Error("Not on a MyCase search results page.");
    }
    // Strategy 1: Knockout Observable (preferred) - only works if rootElement is document
    const koResults = tryKnockoutExtraction(rootElement);
    if (koResults && koResults.length > 0) {
      console.log(`[Expungement] Extracted ${koResults.length} cases via Knockout observables`);
      return koResults;
    }

    // Strategy 2: DOM scraping (fallback)
    const domResults = tryScrapeDOM(rootElement);
    
    if (domResults.length === 0) {
      // Check if there are no cases at all, vs a layout change
      const text = rootElement.body ? rootElement.body.innerText.toLowerCase() : rootElement.innerText.toLowerCase();
      if (!text.includes('no cases matched') && !text.includes('0 cases found')) {
        throw new Error("MyCase layout has changed. Unable to parse search results.");
      }
    }
    
    console.log(`[Expungement] Extracted ${domResults.length} cases via DOM scraping`);
    return domResults;
  }

  /**
   * Try to extract case data from the Knockout.js view model.
   * MyCase uses Tyler Technologies Odyssey SPA with Knockout bindings.
   * The search results are bound to an observable array.
   */
  function tryKnockoutExtraction(rootElement = document) {
    try {
      if (typeof window !== 'undefined' && typeof window._ieaExtractKnockoutCases === 'function') {
        const mainCases = window._ieaExtractKnockoutCases();
        if (mainCases && mainCases.length > 0) return mainCases;
      }
      // Knockout is only available in the live DOM
      if (rootElement !== document) return null;
      if (typeof ko === 'undefined' || !ko.dataFor) return null;

      let results = null;

      // 1. Check results table / ViewModel
      const table = rootElement.querySelector ? rootElement.querySelector('table') : null;
      if (table) {
        const tableData = ko.dataFor(table);
        if (tableData && tableData.ob && tableData.ob.Results) {
          results = typeof tableData.ob.Results === 'function'
            ? tableData.ob.Results()
            : tableData.ob.Results;
        }
      }

      // 2. Check row context's parent ViewModel
      if (!results && rootElement.querySelector) {
        const firstRow = rootElement.querySelector('tr.result-row');
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
      if (!results && rootElement.querySelectorAll) {
        const rows = rootElement.querySelectorAll('tr.result-row');
        if (rows && rows.length > 0) {
          const directCases = [];
          rows.forEach((r, idx) => {
            const data = ko.dataFor(r);
            if (data && (data.CaseNumber || data.CaseID || data.Style)) {
              directCases.push(normalizeKnockoutModel(data, idx));
            }
          });
          if (directCases.length > 0) return directCases;
        }
      }

      // 4. Fallback to legacy OD_BODY container
      if (!results && rootElement.getElementById) {
        const container = rootElement.getElementById('OD_BODY');
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

      return results.map((model, index) => normalizeKnockoutModel(model, index));
    } catch (e) {
      console.log('[Expungement] Knockout extraction unavailable:', e.message);
      return null;
    }
  }

  /**
   * Helper: Extract date in MM/DD/YYYY format from any US or ISO date string
   */
  function extractDate(str) {
    if (!str || typeof str !== 'string') return '';
    const mUs = str.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (mUs) return `${mUs[1].padStart(2, '0')}/${mUs[2].padStart(2, '0')}/${mUs[3]}`;
    const mIso = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (mIso) return `${mIso[2]}/${mIso[3]}/${mIso[1]}`;
    return '';
  }

  /**
   * Helper: Infer case type code from standard Indiana cause number
   * e.g. 49D01-1804-CM-014920 -> CM
   */
  function inferCaseTypeFromNumber(caseNum) {
    if (!caseNum) return '';
    const clean = caseNum.replace(/[\u2010-\u2015\u2212]/g, '-').trim().toUpperCase();
    const parts = clean.split('-');
    if (parts.length >= 3 && parts[2]) {
      return parts[2];
    }
    return '';
  }

  /**
   * Normalize a Knockout model object into our standard case format.
   */
  function normalizeKnockoutModel(model, index) {
    const getValue = (prop) => {
      if (!prop) return '';
      return typeof prop === 'function' ? prop() : prop;
    };

    const rawCaseNumber = getValue(model.CaseNumber) || '';
    const caseNumber = rawCaseNumber.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, '').toUpperCase();
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

    let fullCaseType = caseSubType
      ? `${caseType}, ${caseSubType}`
      : caseType;
    if (!fullCaseType) {
      fullCaseType = inferCaseTypeFromNumber(caseNumber);
    }

    const fullStatus = statusDate
      ? `${statusDate}, ${status}`
      : status;
    const dispositionDate = extractDate(statusDate) || extractDate(fullStatus) || (statusDate || '');

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
      caseToken: caseToken,  // Used for CCS deep-scraping
      _source: 'knockout'
    };
  }

  /**
   * Fall back to DOM scraping when Knockout context is unavailable.
   * Extracts data from the rendered .result-row elements.
   */
  function tryScrapeDOM(rootElement = document) {
    let rows = rootElement.querySelectorAll('tr.result-row');
    if (!rows || rows.length === 0) {
      rows = rootElement.querySelectorAll('.result-row');
    }
    const cases = [];

    rows.forEach((row, index) => {
      try {
        const titleEl = (row.querySelector && (row.querySelector('.result-title') || row.querySelector('a[href*="CaseToken"]'))) || null;
        const caseNumEl = (row.querySelector && (row.querySelector('.result-subtitle[title="Case Number"]') || row.querySelector('.result-subtitle[title="Cause Number"]') || row.querySelector('[data-bind*="CaseNumber"]') || row.querySelector('.result-subtitle'))) || null;
        const detailRows = (row.querySelectorAll && row.querySelectorAll('.result-row-details .row')) || [];

        const rawCaseNum = caseNumEl ? caseNumEl.textContent : '';
        const cleanCaseNum = rawCaseNum
          .replace(/[\u2010-\u2015\u2212]/g, '-')
          .replace(/^Case\s*(?:Number|No\.?|#)?\s*[:-]?\s*/i, '')
          .replace(/\s+/g, '')
          .toUpperCase();

        const caseData = {
          index: index + 1,
          case_number: cleanCaseNum,
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

        // Parse detail rows (Court, Case Type, Filed, Status, Charges, Parties, Attorneys)
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

        if (!caseData.case_type) {
          caseData.case_type = inferCaseTypeFromNumber(caseData.case_number);
        }

        if (caseData.status) {
          caseData.dispositionDate = extractDate(caseData.status);
        }

        // If details weren't expanded, try to get filed date from the right column
        if (!caseData.filed) {
          const rightCol = row.querySelector('.result-col-right .small[data-bind*="FileDate"]');
          if (rightCol) caseData.filed = rightCol.textContent.trim();
        }

        // Try to extract case token from the title link
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
        if (!caseData.caseToken && typeof row.innerHTML === 'string') {
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
        console.warn(`[Expungement] Error parsing row ${index}:`, e);
      }
    });

    return cases;
  }

  // ─── CCS Deep-Scrape (In-Session Fetch) ──────────────────────────────

  /**
   * Fetch the Chronological Case Summary (CCS) for a specific case.
   * Uses the user's existing session cookies — no external authentication.
   * Checks network interception cache first, falls back to direct API and ROA print view.
   * 
   * @param {string} caseToken - The CaseToken identifier from search results
   * @returns {Promise<Object>} Parsed CCS data
   */
  async function fetchCCS(caseToken) {
    if (!caseToken) return null;

    // Stage 1 Check: Intercepted Network Cache (Fast-path off the wire)
    if (typeof window !== 'undefined' && window._odysseyDataInterceptedCache) {
      for (const [cachedUrl, cachedPayload] of window._odysseyDataInterceptedCache.entries()) {
        if (cachedUrl.includes(caseToken) && cachedPayload) {
          console.log(`[Expungement] Serving CCS for ${caseToken} from intercepted network cache`);
          return parseCCSJson(cachedPayload);
        }
      }
    }

    // Stage 2: Direct Authenticated Session Fetch
    try {
      const url = `https://public.courts.in.gov/mycase/Case/CaseSummary?SRCT=&CaseToken=${encodeURIComponent(caseToken)}&_=${Date.now()}`;
      let response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      // Stage 3 Fallback: Consolidated Register of Actions (ROA) Report route if primary endpoint is restricted
      if (!response.ok || response.status === 404) {
        const roaUrl = `https://public.courts.in.gov/mycase/Case/CaseSummaryReport?SRCT=&CaseToken=${encodeURIComponent(caseToken)}&_=${Date.now()}`;
        response = await fetch(roaUrl, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }).catch(() => response);
      }

      if (!response.ok) {
        console.warn(`[Expungement] CCS fetch failed for ${caseToken}: ${response.status}`);
        return null;
      }

      const json = await response.json();
      if (json.InvalidToken || json.CaseNotFound || json.AccessDenied) return null;
      return parseCCSJson(json);
    } catch (e) {
      console.warn(`[Expungement] CCS fetch error for ${caseToken}:`, e);
      return null;
    }
  }

  /**
   * Parse CCS JSON response to extract detailed charge information, disposition details,
   * financial ledger, restitution milestones, and sentence discharge events.
   */
  function parseCCSJson(json) {
    const ccsData = {
      charges: [],
      docketEntries: [],
      financialSummary: null,
      financials: {
        balanceDue: 0,
        balanceFormatted: '$0.00',
        restitutionOrdered: false,
        restitutionSatisfied: true,
        sentenceCompletedDate: null
      },
      arrestingAgency: null,
      sentenceDetails: null,
      dispositionDate: ''
    };

    // Extract charges from the JSON Charges array
    if (Array.isArray(json.Charges)) {
      json.Charges.forEach(charge => {
        let offense = charge.OffenseDescription || '';

        // For old converted cases, OffenseDescription is the placeholder
        // "SEE CCS ENTRY FOR OFFENSE DESCRIPTION". Resolve from Events.
        if (offense.toUpperCase().includes('SEE CCS ENTRY') && Array.isArray(json.Events)) {
          const chargeNumStr = String(charge.ChargeNumber || '1').trim();
          const chargeNumInt = parseInt(chargeNumStr, 10);
          const numPattern = isNaN(chargeNumInt) ? chargeNumStr : `0*${chargeNumInt}`;

          for (const evt of json.Events) {
            if (evt.CaseEvent && evt.CaseEvent.Comment) {
              const comment = evt.CaseEvent.Comment;
              const pat = new RegExp('(?:COUNT|CT\\.?|CHARGE)\\s*' + numPattern + '\\s*[:\\-]?\\s+(.+?)(?:\\s*\\(RJO|\\s*\\||$)', 'i');
              const m = comment.match(pat);
              if (m) {
                offense = m[1].trim();
                break;
              }
            }
          }

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
          statute: charge.OffenseStatute || charge.Statute || '',
          level: charge.OffenseDegree || charge.Degree || '',
          disposition: ''
        });
      });
    }

    // Extract disposition info, restitution milestones, and sentence discharge from events
    let hasRestitutionOrder = false;
    let hasRestitutionSatisfaction = false;
    let sentenceDischargeDate = null;

    if (Array.isArray(json.Events)) {
      json.Events.forEach(evt => {
        const evtDesc = (evt.Description || '').toUpperCase();
        const comment = (evt.CaseEvent?.Comment || '').toUpperCase();
        const combinedText = `${evtDesc} ${comment}`;

        // Audit for restitution ordered
        if (combinedText.includes('RESTITUTION') || combinedText.includes('RESTITUTION ORDERED')) {
          hasRestitutionOrder = true;
        }
        // Audit for restitution satisfied or receipted
        if (combinedText.includes('RESTITUTION SATISFACTION') || combinedText.includes('RESTITUTION PAID') || combinedText.includes('SATISFACTION OF JUDGMENT')) {
          hasRestitutionSatisfaction = true;
        }

        // Audit for true sentence completion (probation discharge, commitment terminated)
        if (combinedText.includes('PROBATION DISCHARGED') || combinedText.includes('COMMITMENT TERMINATED') || combinedText.includes('SENTENCE SATISFIED') || combinedText.includes('RELEASED FROM PROBATION')) {
          if (evt.EventDate && !sentenceDischargeDate) {
            sentenceDischargeDate = extractDate(evt.EventDate) || evt.EventDate;
          }
        }

        if (evt.DispEvent) {
          if (evt.EventDate && !ccsData.dispositionDate) {
            ccsData.dispositionDate = extractDate(evt.EventDate) || evt.EventDate;
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
                if (evt.EventDate && !match.dispositionDate) {
                  match.dispositionDate = extractDate(evt.EventDate) || evt.EventDate;
                }
              }
            });
          }
        }

        // Docket entries
        ccsData.docketEntries.push({
          date: evt.EventDate || '',
          type: evt.EventType || '',
          description: evt.Description || '',
          text: evt.CaseEvent ? evt.CaseEvent.Comment || '' : ''
        });
      });
    }

    // Extract and audit financial fee summary from defendant party or root object
    let balanceDueNum = 0;
    let balanceStr = '$0.00';
    let feeSummarySource = null;

    if (Array.isArray(json.Parties)) {
      const defendant = json.Parties.find(p => {
        const conn = (p.BaseConnKey || '').toUpperCase();
        const role = (p.Connection || p.Role || '').toUpperCase();
        return conn === 'DF' || conn === 'DFT' || conn === 'DEF' || role.includes('DEFENDANT');
      }) || json.Parties[0];
      if (defendant && defendant.FeeSummary) {
        feeSummarySource = defendant.FeeSummary;
      }
    }
    if (!feeSummarySource && (json.FeeSummary || json.FinancialSummary)) {
      feeSummarySource = json.FeeSummary || json.FinancialSummary;
    }

    if (feeSummarySource) {
      balanceStr = feeSummarySource.Balance || '$0.00';
      const isCredit = /^\s*\(.+\)\s*$/.test(String(balanceStr));
      const parsedNum = parseFloat(String(balanceStr).replace(/[^0-9.-]+/g, ''));
      balanceDueNum = isNaN(parsedNum) ? 0 : (isCredit ? -Math.abs(parsedNum) : parsedNum);

      ccsData.financialSummary = {
        balance: balanceStr,
        asOf: feeSummarySource.AsOf || '',
        categories: feeSummarySource.Categories || []
      };
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

  /**
   * Deep-scrape CCS details for all cases (throttled to avoid overloading).
   * Adds a natural delay between requests to mimic human browsing.
   * 
   * @param {Array} cases - Array of case objects with caseToken
   * @param {Function} onProgress - Callback for progress updates
   * @returns {Promise<Array>} Cases enriched with CCS data and financial audit
   */
  async function deepScrapeCCS(cases, onProgress) {
    const enriched = [];
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      if (c.caseToken) {
        if (onProgress) onProgress(i + 1, cases.length, c.case_number);

        const ccs = await fetchCCS(c.caseToken);
        const dispositionDate = c.dispositionDate || ccs?.dispositionDate || '';
        const financials = ccs?.financials || { balanceDue: 0, balanceFormatted: '$0.00', restitutionSatisfied: true };
        enriched.push({ ...c, dispositionDate, ccs, financials });

        // Natural delay: 800–1500ms between requests (mimics human pace)
        if (i < cases.length - 1) {
          await sleep(800 + Math.random() * 700);
        }
      } else {
        enriched.push({ ...c, ccs: null, financials: { balanceDue: 0, balanceFormatted: '$0.00', restitutionSatisfied: true } });
      }
    }
    return enriched;
  }

  // ─── Utility Functions ───────────────────────────────────────────────

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
    // Remove reference placeholders
    let clean = charges.replace(/\*{3}\s*REFERENCE CCS ENTRY\s*\*{3}/gi, '').trim();
    // Normalize whitespace
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if the current page is a MyCase search results page.
   */
  function isSearchResultsPage(rootElement = document) {
    const isDoc = rootElement === document;
    return (isDoc && window.location.href.includes('SearchResults')) ||
      rootElement.querySelector('tr.result-row') !== null ||
      rootElement.querySelector('.result-row, [title="Case Number"], .result-title') !== null;
  }

  /**
   * Check if the current page is a MyCase case summary (CCS) page.
   */
  function isCaseSummaryPage(rootElement = document) {
    const isDoc = rootElement === document;
    return (isDoc && window.location.href.includes('CaseSummary')) ||
      rootElement.querySelector('.od-ccs-entry, .ccs-entry') !== null;
  }

  /**
   * Extract search context or party name query from the active MyCase page.
   * Useful for tracking multiple maiden/married name or alias searches.
   */
  function getSearchContext(rootElement = document) {
    try {
      // 1. Try search inputs (e.g. Last Name, First Name)
      const last = rootElement.querySelector('input[id*="LastName" i], input[name*="LastName" i]')?.value?.trim();
      const first = rootElement.querySelector('input[id*="FirstName" i], input[name*="FirstName" i]')?.value?.trim();
      const nameParts = [last, first].filter(Boolean);
      if (nameParts.length > 0) {
        return nameParts.join(', ');
      }

      // 2. Try breadcrumb or search summary headers
      const summaryEl = rootElement.querySelector('.search-summary, .search-criteria, .k-header-column-menu, .breadcrumb');
      if (summaryEl && summaryEl.innerText?.trim()) {
        const text = summaryEl.innerText.trim().replace(/\s+/g, ' ');
        if (text.length > 0 && text.length < 60) return text;
      }

      // 3. Fallback to page title or timestamp
      const title = rootElement.title || (rootElement === document ? document.title : '');
      const titleMatch = title.match(/MyCase\s*[-–]\s*(.+)/i);
      if (titleMatch && titleMatch[1]) return titleMatch[1].trim();
    } catch (_) {
      /* Fallback to default search context if parsing fails */
    }
    return 'MyCase Search';
  }

  // ─── Public API ──────────────────────────────────────────────────────
  return {
    scrapeSearchResults,
    fetchCCS,
    deepScrapeCCS,
    isSearchResultsPage,
    isCaseSummaryPage,
    getSearchContext,
    // Expose internals for testing
    _tryKnockoutExtraction: tryKnockoutExtraction,
    _tryScrapeDOM: tryScrapeDOM,
    _parseCCSJson: parseCCSJson
  };

})();

// ─── Message Handler: Respond to sidepanel and background script (Extension only) ──
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeSearchResults') {
      const cases = MyCaseScraper.scrapeSearchResults();
      const searchContext = MyCaseScraper.getSearchContext();
      cases.forEach(c => { c.searchContext = searchContext; });
      sendResponse({ success: true, cases, searchContext });
      return true;
    }

    if (request.action === 'analyzeEligibility') {
      try {
        const cases = MyCaseScraper.scrapeSearchResults();
        const searchContext = MyCaseScraper.getSearchContext();
        cases.forEach(c => { c.searchContext = searchContext; });
        const report = IndianaExpungement.analyzeAll(cases);
        sendResponse({ success: true, report, cases, searchContext });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }

    if (request.action === 'deepScrape') {
      const cases = MyCaseScraper.scrapeSearchResults();
      chrome.runtime.sendMessage({
        action: 'deepScrapeProgress',
        current: 0,
        total: cases.length,
        message: `Found ${cases.length} case${cases.length === 1 ? '' : 's'} → Verifying court codes...`
      });
      MyCaseScraper.deepScrapeCCS(cases, (current, total, caseNum) => {
        chrome.runtime.sendMessage({
          action: 'deepScrapeProgress',
          current,
          total,
          caseNum,
          message: `Found ${total} cases → Verifying court codes (${current}/${total}: ${caseNum}) → Checking financial fee summaries...`
        });
      }).then(enrichedCases => {
        chrome.runtime.sendMessage({
          action: 'deepScrapeProgress',
          current: enrichedCases.length,
          total: enrichedCases.length,
          message: `Found ${enrichedCases.length} cases → Court codes verified → Checking financial fee summaries...`
        });
        const report = IndianaExpungement.analyzeAll(enrichedCases);
        sendResponse({ success: true, report, cases: enrichedCases });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // Keep channel open for async response
    }

    if (request.action === 'getPageStatus') {
      sendResponse({
        isSearchResults: MyCaseScraper.isSearchResultsPage(),
        isCaseSummary: MyCaseScraper.isCaseSummaryPage(),
        url: window.location.href
      });
      return true;
    }
  });

  try {
    chrome.runtime.sendMessage({ action: 'contentScriptLoaded', url: window.location.href });
  } catch (_) {
    /* Extension messaging unavailable in non-extension or invalidated context */
  }
}

// Export for browser and node
if (typeof window !== 'undefined') {
  window.MyCaseScraper = MyCaseScraper;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MyCaseScraper;
}
