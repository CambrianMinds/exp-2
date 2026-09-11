# Plan: Redesign docs/app UI — Remove Scan, Keep Upload

## Objective
Redesign `docs/app/app.html` to match the extension sidepanel aesthetic, remove all MyCase scan functionality, and ensure the HTML/JSON file upload is the sole case-input mechanism for the standalone web app.

## Current State
- `docs/app/app.html` is nearly identical to `extension/sidepanel/sidepanel.html` plus extra scan-specific sections (bookmarklet box, scan tip box, batch panel)
- `docs/app/scanner.js` contains both scan logic (MyCase content-script messaging) and upload logic (file reader + `window.MyCaseScraper` HTML parsing)
- `docs/app/main.js` loads scan results from `chrome.runtime` and `localStorage`, polls `checkPageStatus`
- `docs/app/state.js` tracks `searchBatches` and `pendingScanResult` for multi-search merge
- `docs/app/generator.js` error messages reference "Scan a MyCase page first"
- The upload path depends on `window.MyCaseScraper` (defined in `eligibility.js`) for HTML parsing

## Constraints
- Do not touch `extension/` files — changes are scoped to `docs/app/` only
- Keep all legal disclaimers, one-shot warnings, 4 acknowledgment checkboxes, profile form, results tab, and generate flow intact
- `eligibility.js` must remain an IIFE + CommonJS module (do not convert to ESM)
- Tests in `tests/eligibility.test.js` must continue to pass

## Tasks

### 1. Simplify `docs/app/state.js`
- Remove `searchBatches: []` and `pendingScanResult: null`
- Keep `currentCases`, `currentReport`, `petitionerProfile`, `backendOnline`

### 2. Redesign `docs/app/app.html` Scan tab
- Remove elements:
  - `#batchPanel` (multi-search accumulation banner)
  - `#guideBanner` (first-time guide banner)
  - `.scan-hero` (Scan MyCase Page hero)
  - `#btnScan` and `#chkMergeCases`
  - `#btnDeepScrape`
  - `#pageStatus` (MyCase page status indicator)
  - `#scanProgress` (progress bar)
  - `.bookmarklet-box` (bookmarklet exporter)
  - `.scan-tip-box` (multi-search tip)
- Keep and promote:
  - `.warning-callout` (lifetime one-shot rule banner)
  - `#btnUploadHtml` + `#htmlUpload` (file upload)
- Make the upload button the primary CTA on the Scan tab with clear copy: "Upload MyCase HTML or JSON Export"

### 3. Update `docs/app/scanner.js`
- Remove all MyCase scan logic:
  - `isMyCaseUrl()`
  - `checkPageStatus()`
  - `ensureContentScript()`
  - Scan button event listener
  - Deep scrape button event listener
  - Deep scrape progress listener
  - `showParityModal()` → replace with a simple "File parsed successfully" toast + auto-switch to Results
  - `updateBatchPanelUI()` and `#btnClearScans`
  - `checkAndSuggestAlias()`
  - `btnScanAnotherPage` listener
- Keep and harden the upload flow:
  - Trigger `#htmlUpload` from `#btnUploadHtml`
  - Parse JSON (same as current)
  - Parse HTML using `window.MyCaseScraper` (available from `eligibility.js`)
  - On success: set `AppState.currentCases`, run `window.IndianaExpungement.analyzeAll()`, persist to `localStorage`, switch to Results tab
  - On failure: show error toast, reset button state
- Update `persistScanResults()` to save only `currentCases`, `currentReport` (no `searchBatches`)
- Update `renderResults()` to remove `searchQueries` display and batch pills

### 4. Update `docs/app/main.js`
- Remove `checkPageStatus()` call from `init()`
- Remove the 5-second `setInterval(checkPageStatus, 5000)` poller
- Remove `chrome?.runtime?.sendMessage?.({ action: 'loadLastScan' })` fallback — only load from `localStorage`
- Remove `updateBatchPanelUI()` call after loading stored results
- Keep `setupGuideListeners()`, `checkWelcomeGuide()`, `loadProfile()`, `checkBackend()`, `updateChecklist()`

### 5. Update `docs/app/generator.js`
- Change error message "No eligible cases found. Scan a MyCase page first." → "No eligible cases found. Upload a MyCase HTML or JSON file on the Scan tab."
- Remove any remaining scan-specific references

### 6. Update `docs/app/ui.js`
- Remove `checkCases` readiness dependency on `AppState.currentReport.summary.eligible > 0`? No — keep it, but ensure it works without scan
- No structural changes needed; checklist logic is already generic

### 7. Update `docs/app/app.html` Results tab
- Remove `#btnScanAnotherPage` button (no more scan flow)
- Keep summary cards, statute breakdown, case list, exclude buttons

### 8. CSS cleanup (`docs/app/sidepanel.css`)
- No changes required — the CSS already styles all remaining elements
- Unused scan-specific classes can stay (no harm) or be removed for cleanliness

## Validation
- Run `npm test` — `tests/eligibility.test.js` must still pass (13/13)
- Open `docs/app/app.html` in a browser
- Verify:
  - Scan tab shows only the warning callout and upload button
  - Uploading a valid JSON/HTML file populates Results tab
  - Profile tab saves correctly
  - Generate tab shows checklist and enables generation when profile + cases + acks are ready
  - No `chrome.runtime` or `chrome.tabs` errors in console

## Rollback
- All changes are in `docs/app/` only; `extension/` is untouched
- `git checkout -- docs/app/` restores original state
