# FAILURE_MODES.md — Indiana Expungement Assistant

This document outlines the known failure modes, architectural boundaries, edge cases, and graceful recovery mechanisms in the Indiana Expungement Assistant (`indiana-expunge`).

---

## 1. System Architecture & Threat Model

The Indiana Expungement Assistant operates **entirely client-side** within the user's browser (available as a Chrome Manifest V3 extension and as a standalone web application hosted on GitHub Pages).

- **No Remote Backend / No Cloud Database**: All scraping, parsing, statutory evaluation, and PDF document rendering occurs inside the browser sandbox.
- **Zero Telemetry / Absolute Privacy**: Petitioner data (SSN, DOB, driver's license, address history, criminal charges) is never transmitted across the network to any third-party server.
- **Odyssey Session Context**: In the Chrome extension, the content script operates under the user's authenticated session with Indiana MyCase (`public.courts.in.gov/mycase`).

Because there is no backend proxy or server-side remediation layer, all failure recovery must be designed defensively within client-side code.

---

## 2. Odyssey / Tyler Technologies Court Portal Changes

### Failure Mode 2.1: Knockout.js Observable Model Shift
- **Trigger**: Tyler Technologies updates Odyssey SPA scripts, renaming `window.ko` observable properties (e.g., `CaseNumber()`, `CaseStatus()`, `CaseToken()`), or altering the container ID (`#OD_BODY`).
- **Severity**: HIGH.
- **Detection**: `scripts/canary/run-canary.js` runs scheduled automated browser checks against live MyCase DOM structures.
- **Recovery Chain**:
  1. Primary: Scraper attempts Knockout observable model extraction via `ko.dataFor(container)`.
  2. Fallback 1: If Knockout context fails or is missing, `tryScrapeDOM()` parses `.result-row` elements using resilient CSS selectors and regex parsing.
  3. Fallback 2: Token regex scan against raw row innerHTML (`CaseToken=([^&"'>\s]+)`).
  4. Manual: The user is presented with the "Add Case Manually" interface to supply unparsed cause numbers directly.

### Failure Mode 2.2: Session Expiration & CAPTCHA Enforcement
- **Trigger**: User remains idle on MyCase until session cookies expire, or Tyler Technologies presents an Odyssey bot-detection CAPTCHA or Cloudflare challenge.
- **Severity**: MEDIUM-HIGH.
- **Impact**: In-session CCS deep-scraping returns `401 Unauthorized`, `403 Forbidden`, or redirect to login.
- **Recovery**:
  - `fetchCCS` inspects responses for `InvalidToken`, `CaseNotFound`, or `AccessDenied`.
  - When detected, deep-scraping halts gracefully without corrupting existing search result tables.
  - User receives an actionable UI alert: *"Session expired or verification required. Please refresh your MyCase search tab and verify your session."*

---

## 3. Network & CCS Deep-Scraping Failures

### Failure Mode 3.1: CCS Endpoint Timeout or Rate Limiting (HTTP 429 / 503)
- **Trigger**: Fetching Chronological Case Summaries across dozens of cases triggers Odyssey rate limits, or network latency causes fetch requests to stall.
- **Severity**: MEDIUM.
- **Recovery**:
  - **Exponential Backoff with Jitter**: `fetchWithRetry()` automatically retries up to 2 times with randomized backoff delays (`baseDelay * 2^attempt + jitter`).
  - **AbortController Timeout**: Requests are bounded by a 12-second hard timeout to prevent eternal hangs.
  - **Interception Cache**: Before executing wire requests, the content script checks `window._odysseyDataInterceptedCache` to utilize responses already buffered during search rendering.
  - **ROA Report Fallback**: If the primary `/Case/CaseSummary` endpoint returns 404 or fails, the engine falls back to `/Case/CaseSummaryReport` (the Register of Actions print route).
  - **Degraded Graceful Mode**: If CCS cannot be retrieved, the case remains evaluated using summary data (charges and status from search results), accompanied by an advisory note recommending manual verification of the CCS.

### Failure Mode 3.2: Disconnected / Offline PWA Usage
- **Trigger**: User opens the web application while disconnected from the internet.
- **Recovery**:
  - The web application is bundled with a Service Worker caching core HTML, CSS, JavaScript, and vendored `pdf-lib.min.js`.
  - The application functions fully offline for manual case entry, file drag-and-drop, and PDF generation.

---

## 4. Statutory Classification & Date Parsing Anomalies

### Failure Mode 4.1: Malformed or Serialized Court Dates
- **Trigger**: Court clerks enter dates in irregular formats (e.g. `10-MAY-2018`, timestamps `05/10/2018 11:30:00 AM`, or Odyssey returns WCF serialized dates `/Date(1525924800000)/`).
- **Severity**: HIGH (risk of incorrect waiting period calculation).
- **Recovery**:
  - `parseDate()` provides multi-format parsing:
    - Odyssey ASP.NET serialized timestamps (`/Date(\d+)/`)
    - Raw epoch millisecond numbers
    - Calendar ISO-8601 (`YYYY-MM-DD`) without UTC timezone day-shifting
    - US standard `MM/DD/YYYY`
    - Textual dates (`MMM DD, YYYY` and `DD-MMM-YYYY`)
  - **Explicit Date Parse Failure Mode**: If date parsing completely fails on a criminal record:
    - The engine **never** silently defaults to 0 years elapsed.
    - It sets `result.dateParseFailed = true`.
    - It marks `result.eligible = false`.
    - It outputs a prominent warning: *"MANUAL REVIEW REQUIRED: Unable to verify disposition date from court records."*
    - The record is flagged in the Pre-Filing Audit Checklist.

### Failure Mode 4.2: IC § 35-38-9-4 Sentence Completion Date Ambiguity
- **Trigger**: Under IC § 35-38-9-4(c), petitioning for a higher felony requires waiting at least 8 years from conviction **or** at least 3 years from sentence completion, *whichever is later*. Many court summaries list disposition date but do not record the date probation, parole, or community corrections terminated.
- **Severity**: MEDIUM-HIGH.
- **Recovery**:
  - The engine inspects CCS docket entries for explicit discharge milestones (`PROBATION DISCHARGED`, `COMMITMENT TERMINATED`, `SENTENCE SATISFIED`).
  - If a sentence discharge date is found, `assessEligibility` calculates elapsed time from completion. If `< 3` years, the case is marked ineligible with citation to IC § 35-38-9-4(c)(2).
  - If no sentence completion date is recorded, the engine outputs a mandatory statutory advisory warning instructing the petitioner to verify that at least 3 full years have elapsed since discharge from all supervision before filing.

### Failure Mode 4.3: Serious Bodily Injury vs. Simple Bodily Injury (§ 3(b) vs. § 5)
- **Trigger**: Charge description contains battery or injury keywords.
- **Severity**: HIGH.
- **Recovery**:
  - If charge involves serious violent felonies, offenses causing death, or offenses resulting in serious bodily injury, it is classified under **IC § 35-38-9-5** (requiring 10-year wait and written prosecutor consent).
  - If charge involves simple bodily injury on a Class D or Level 6 felony, it remains under **IC § 35-38-9-3**, but grant type shifts from mandatory to discretionary under § 3(b).

---

## 5. PDF Generation & Document Formatting Failures

### Failure Mode 5.1: Mid-Batch Generation Failure
- **Trigger**: Corrupted petitioner profile data, invalid characters, or unsupported font glyphs cause an error during document rendering.
- **Severity**: MEDIUM.
- **Recovery**:
  - `generateCompletePacket(payload, onProgress)` processes documents sequentially in an isolated try/catch execution loop.
  - Real-time progress updates (`onProgress`) indicate exactly which form is compiling (`Form 1 of 8: Appearance Form...`).
  - If an individual schedule fails, the error boundary catches it and displays the specific document failure message rather than silently emitting a corrupted 0-byte PDF.

### Failure Mode 5.2: Memory Constraints in Massive Records (All 92 Counties)
- **Trigger**: A user with hundreds of lifetime infractions/charges across multiple counties attempts to render an enormous PDF packet.
- **Severity**: MEDIUM.
- **Recovery**:
  - Documents are drawn using low-overhead native `pdf-lib` vector primitives and standard PDF Type 1 fonts (Times Roman), avoiding multi-megabyte canvas rendering.
  - Multi-county records are partitioned by county code via `partitionByCounty()`. The user generates separate, appropriately sized petition packets per county rather than one single monolithic statewide PDF.

---

## 6. Pro Se Procedural & Statutory Traps

### Failure Mode 6.1: Lifetime One-Shot Rule Violation (IC § 35-38-9-9(i))
- **Trigger**: Petitioner files to expunge one conviction while omitting another eligible conviction in the same or another county.
- **Severity**: CATASTROPHIC (Statutorily irreversible forfeiture).
- **Recovery**:
  - Four mandatory legal acknowledgments (`ackOneShot`, `ackAllCounties`, `ackNotLawyer`, `ackProSe`) must be checked before pleading generation is unlocked.
  - Search batch tracker checks for name variations and multi-county searches.
  - The UI presents a warning cover sheet (Form 00) emphasizing that any omitted conviction can never be expunged in the petitioner's lifetime.

### Failure Mode 6.2: Multi-County 365-Day Window Expiration (IC § 35-38-9-9(d))
- **Trigger**: Petitioner files in County A, but waits longer than 365 days before filing in County B.
- **Severity**: HIGH.
- **Recovery**:
  - `generator.js` prompts the user for any prior expungement filing dates.
  - If prior filing date is entered, the engine computes elapsed days:
    - If `> 365` days, packet generation for conviction tiers is blocked with citation to IC § 35-38-9-9(d).
    - If within window, days remaining and deadline date are calculated.
    - Under **Indiana Trial Rule 6(A)**, if day 365 falls on a weekend or legal holiday, the system notes that the filing deadline extends to the next business day.

### Failure Mode 6.3: Unpaid Court Fees or Restitution
- **Trigger**: Court records indicate outstanding balances due.
- **Severity**: HIGH (court will deny petition under IC § 35-38-9).
- **Recovery**:
  - Financial ledger and CCS balance due are audited automatically.
  - If any balance > $0 is detected, the confirmation modal halts generation until the user acknowledges the outstanding debt and verifies satisfaction.
