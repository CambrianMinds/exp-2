// ═══════════════════════════════════════════════════════════════════════
// Indiana Expungement Assistant — Odyssey MAIN World Script
// Runs in the page's execution context (world: "MAIN") at document_start.
// Intercepts Odyssey network traffic and accesses window.ko (Knockout MVVM).
// ═══════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || window._ieaMainWorldActive) return;
  window._ieaMainWorldActive = true;
  window._odysseyDataInterceptedCache = window._odysseyDataInterceptedCache || new Map();

  // 1. Intercept Odyssey AJAX & Fetch Requests
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
          }).catch(() => {});
        }
      } catch (_) {}
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
        } catch (_) {}
      });
      return _origSend.apply(this, args);
    };
  }

  // 2. Knockout Extraction Helper in MAIN World
  function extractKnockoutCases() {
    try {
      if (typeof window.ko === 'undefined') return null;
      const el = document.getElementById('OD_BODY');
      if (!el) return null;
      const vm = window.ko.dataFor(el);
      if (!vm) return null;

      const rawResults = vm.SearchResults || (vm.ob && vm.ob.Results) || vm.caseList || vm.Results;
      const list = typeof rawResults === 'function' ? rawResults() : rawResults;
      if (!list || !Array.isArray(list)) return null;

      return list.map(item => {
        const get = (prop) => {
          if (!prop) return '';
          return typeof prop === 'function' ? prop() : prop;
        };
        const caseNumber = get(item.CaseNumber) || get(item.case_number) || '';
        const rawTitle = get(item.Style) || get(item.title) || '';
        const title = rawTitle.replace(/<[^>]*>/g, '').trim();
        const court = get(item.Court) || get(item.court) || '';
        let caseType = get(item.CaseType) || get(item.case_type) || '';
        const caseSubType = get(item.CaseSubType);
        if (caseSubType) caseType = `${caseType}, ${caseSubType}`;
        const filed = get(item.FileDate) || get(item.filed) || '';
        const statusDate = get(item.CaseStatusDate) || '';
        const statusText = get(item.CaseStatus) || get(item.status) || '';
        const status = statusDate ? `${statusDate}, ${statusText}` : statusText;
        const dispositionDate = statusDate || (statusText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) ? statusText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)[1] : filed);
        let charges = get(item.Charges) || get(item.charges) || '';
        if (charges.includes('*** REFERENCE CCS ENTRY ***')) {
          charges = charges.replace(/\*\*\*\s*REFERENCE CCS ENTRY\s*\*\*\*\s*/gi, '').trim();
        }
        const parties = get(item.Parties) || '';
        const attorney = get(item.Attorneys) || '';
        const caseToken = get(item.CaseToken) || get(item.CaseID) || '';

        return {
          case_number: caseNumber,
          title,
          court,
          case_type: caseType,
          filed,
          status,
          dispositionDate,
          charges,
          parties,
          attorney,
          caseToken,
          _source: 'knockout'
        };
      });
    } catch (_) {
      return null;
    }
  }

  // 3. Listen for requests from the isolated content script
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'iea-content-script') return;

    if (event.data.action === 'GET_KNOCKOUT_DATA') {
      const cases = extractKnockoutCases();
      window.postMessage({
        source: 'iea-main-world',
        action: 'KNOCKOUT_DATA_RESPONSE',
        requestId: event.data.requestId,
        cases
      }, '*');
    }
  });

  // Expose on window for direct access if needed
  window._ieaExtractKnockoutCases = extractKnockoutCases;
})();
