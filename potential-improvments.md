# Tapping into `ko.dataFor()` on the root Knockout element is one of the cleanest frontend scraping hacks for Odyssey portals because it bypasses Tyler Technologies’ frequently updated DOM templates. However, `ko.dataFor()` hits a hard ceiling: **the search-results ViewModel only contains surface-level display projections**. It deliberately omits historical CCS minute entries, sentencing completion events, and financial ledgers

## To pull archived records, disposition milestones, and financial responsibility balances reliably, there are two superior architectural patterns

---

### 1. In-Browser Network Interception (Monkey-Patching `fetch` / `XMLHttpRequest`)

Instead of waiting for Knockout to bind to the DOM and then extracting `ko.dataFor()`, intercept the raw JSON payloads off the wire in the page's execution context (`MAIN` world).

When Odyssey executes searches or loads tabs, its internal scripts make asynchronous calls back to its MVC controllers (typically endpoints like `/Case/CaseSearch`, `/Case/CaseSummary`, or `/Case/DocumentList`).

* **Why it beats `ko.dataFor()`:** The raw HTTP response body contains the complete backend Data Transfer Object (DTO) before Knockout strips or reshapes fields for UI data-binding. Internal IDs, unformatted ISO timestamps, full charge arrays, and disposition codes are all present in their native types.
* **Implementation:** Inject a lightweight script at `document_start` into the `MAIN` world that wraps `window.fetch` and `XMLHttpRequest.prototype.open` / `send`. When a response URL matches the Odyssey search or case-detail pattern, clone the response, extract the JSON, and dispatch a custom DOM event (e.g., `window.dispatchEvent(new CustomEvent('MyCasePayloadCaptured', { detail: data }))`) that your content script listens for.

```javascript
// Injected into MAIN world at document_start
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const clone = response.clone();
  if (args[0]?.includes('/Case/')) {
    clone.json().then(data => {
      window.dispatchEvent(new CustomEvent('OdysseyDataIntercepted', { detail: data }));
    }).catch(() => {});
  }
  return response;
};

```

---

### 2. Two-Stage Pipeline: Surface Indexing + Authenticated Direct API Hydration

The fundamental limitation of relying solely on the search results page is that Indiana expungement eligibility under IC § 35-38-9 requires confirming that all fines, fees, court costs, and restitution are fully paid. That data lives in the case's financial summary and detailed CCS ledger, not in the search query results.

A more robust pipeline separates **discovery** from **hydration**:

* **Stage 1 (Discovery):** Use your current `ko.dataFor()` or network intercept to scrape only the high-level case identifiers (`caseId`, `causeNumber`, `countyCode`, `courtToken`) from the search results across multiple names/counties.
* **Stage 2 (Hydration):** Using the user's active, authenticated session cookies, execute direct client-side `fetch()` requests to Odyssey's internal case detail and financial ledger endpoints for each case ID:
* **CCS Minute Stream:** Query the endpoint that returns the chronological events. This exposes the true sentence completion date (e.g., probation discharge orders, commitment terminations) rather than just the initial disposition date.
* **Financial Ledger:** Query the case financial assessment endpoint. In Odyssey, this returns structured assessment objects: `Total Assessed`, `Total Paid`, `Balance Due`, and transaction line items.

By querying the financial endpoint directly, you can programmatically verify whether the petitioner has an outstanding balance or unpaid restitution—a mandatory prerequisite under IC § 35-38-9 that otherwise requires manual review.

---

### 3. Odyssey "Register of Actions" (ROA) / Print View Endpoint

If Odyssey’s client-side AJAX endpoints use dynamic anti-CSRF request tokens that are difficult to replicate cleanly in secondary `fetch()` calls, target the **Register of Actions (ROA) / Print CCS** route.

Odyssey instances include a consolidated print view (often formatted as `/Case/CaseSummaryReport` or `/Case/PrintCCS?caseId=...`).

* **Advantages over interactive CCS tabs:**
* It renders the **entire** Chronological Case Summary on a single page, eliminating the need to trigger Knockout pagination or click "Show More" / tabbed views.
* Archived minute entries and financial accounting tables (Charges, Assessments, Payments, Receipts, and Balance) are compiled linearly in a static, predictable HTML layout.
* It is far less prone to asynchronous race conditions than scraping multi-tabbed dynamic SPAs.

---

### Practical Recommendation

Keep your Knockout observable scraper as a fast Stage 1 indexer for search results, but add an asynchronous **CCS & Financial Hydration Worker**:

1. After extracting case IDs from the search page, present a progress indicator ("*Auditing CCS and financial ledgers for 4 cases...*").
2. Dispatch direct `fetch()` calls with `credentials: 'same-origin'` to the underlying case financial endpoint and CCS endpoint for each case.
3. Automatically flag any case where `financialSummary.balanceDue > 0` or where restitution entries lack a corresponding satisfaction receipt, warning the petitioner before they file a defective petition.
