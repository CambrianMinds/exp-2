# Changelog — Indiana Expungement Assistant

All notable changes to the Indiana Expungement Assistant will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-09-12

### Added
- **Primary Chrome Extension Recommendation**: Added prominent callout recommending the Chrome Extension as the highest-fidelity, zero-friction path for Indiana MyCase scraping, complete with installation guides and links to GitHub / Chrome Web Store.
- **ISP Criminal History Check Advisory**: Integrated advisory alerting petitioners that Indiana Odyssey rolled out gradually (2005–2011), making MyCase incomplete for older or unindexed records and recommending an official ISP Limited Criminal History check.
- **First-Class Guided Manual Case Entry**: Upgraded manual entry modal into a comprehensive wizard prompting for statutory offense tier (IC § 35-38-9-1 through 5), disposition date, sentence completion date, unpaid fines/fees, restitution satisfaction, and an explicit one-shot completeness affirmation.
- **Plain-Language Expungement Relief Explainer**: Added an expandable guide clearly distinguishing:
  - *Section 1*: Non-convictions, dismissals, no-bill grand jury (full statutory sealing, no lifetime limit).
  - *Sections 2–3*: Misdemeanors and Level 6/Class D felonies (mandatory judicial seal upon meeting statutory prerequisites).
  - *Sections 4–5*: Major felonies (discretionary expungement, marked on public records, often requiring prosecutor written consent).
  - *Statutorily Ineligible Categories*: Explicitly flags homicide, sex offenses, human trafficking, and official misconduct per IC § 35-38-9-8(b).
- **Statutory Eligibility & Relief Matrix**: Rendered an interactive comparison matrix on the Results tab displaying case numbers, offense tiers, relief type (Mandatory vs Discretionary), waiting period status (years elapsed vs required), balance due, fee waiver status, and direct Indiana General Assembly statutory links.
- **Pre-Flight Completeness Checklist**: Implemented a mandatory 4-point verification checklist before generating pleadings:
  1. All names and aliases searched across all 92 Indiana counties.
  2. Official ISP criminal history report obtained or risk explicitly acknowledged.
  3. All fines, fees, and restitution confirmed paid in full ($0 balance).
  4. No pending criminal charges or probation revocation proceedings in any jurisdiction.
- **Mobile-Responsive Form & Touch Target UX**: Enhanced form controls and action buttons to meet minimum 44px touch targets; stacked address-history cards for phone screens; added progressive disclosure drawers.
- **Filing Logistics & "When to Talk to a Lawyer" Guide**: Added comprehensive guidance on IEFS e-Filing vs. in-person County Clerk filing, the statutory 30-day prosecutor response window (IC § 35-38-9-8(f)), and an explicit advisory box outlining complex cases where petitioners should seek legal counsel, linked directly to Indiana Legal Help and Indiana Legal Services.
- **Trust, Verification & Distribution Polish**:
  - Indiana Trial Rule 10 footer version stamp on every pleading page: `IC § 35-38-9 · Engine v1.2.0 · Statute Last Reviewed: Sept 2026 · Pro Se Document Formatter`.
  - Zero-telemetry, 100% private client-side usage statistics stored locally in `localStorage`.

---

## [1.1.0] - 2026-09-11

### Added
- **Resilient Date Parsing**: Added support in `parseDate()` for Tyler Technologies Odyssey ASP.NET serialized timestamps (`/Date(...)`), epoch milliseconds, ISO-8601 strings with offsets, and textual date formats (`May 10, 2018`, `10-MAY-2018`).
- **Date Error Recovery**: Eliminated silent `null` failures that caused false negative "NOT YET ELIGIBLE" calculations; added `dateParseFailed: true`, `validationErrors`, and clear "MANUAL REVIEW REQUIRED" guidance.
- **Pre-Processing Case Validation Layer**: Added `validateCaseRecord()` to inspect Indiana Trial Rule 77 cause numbers, county codes, case types, and chronological integrity.
- **Sentence Completion Tracking (IC § 35-38-9-4)**: Added tracking for `sentenceCompletedDate` to enforce the statutory rule requiring at least 3 years to elapse after completion of sentence (probation, parole, commitment, restitution) for higher felonies.
- **Serious Bodily Injury Discretionary Routing**: Differentiated simple bodily injury under § 3(b) (discretionary) from serious bodily injury under IC § 35-38-9-5 (requiring 10-year wait and prosecutor consent).
- **Statutory Hyperlinks**: Attached direct Indiana General Assembly / ILSA statute hyperlinks (`statuteUrl`) to every evaluation result.
- **Scraper Retry Logic**: Implemented `fetchWithRetry()` with exponential backoff, jitter, and 12-second timeout for Chronological Case Summary (CCS) API deep-scraping.
- **PDF Generation Progress Tracking**: Added `onProgress` callback to `generateCompletePacket()` and real-time generation status in the UI.
- **Client-Side Audit Logging & Session Manifest**: Added `AuditLogger` with local storage and "Export Audit Manifest (JSON)" and "Export Cases (JSON)" buttons on Results tab.
- **Comprehensive Project Documentation**:
  - `FAILURE_MODES.md`: Detailed failure modes, network timeouts, and recovery chains.
  - `CONTRIBUTING.md`: Development rules, dual-tree parity, and Trial Rule 10 constraints.
  - `ARCHITECTURE.md`: Mermaid architecture diagrams, scraper fallbacks, and message flow.
  - `TROUBLESHOOTING.md`: User and developer troubleshooting guide.
  - `TRANSLATIONS.md`: Internationalization guide and translation rules.

---

## [1.0.0] - 2026-05-15

### Added
- Initial release of the Indiana Expungement Assistant.
- Chrome Manifest V3 side panel extension and standalone web application.
- Statutory eligibility rules engine implementing IC § 35-38-9 (Sections 1, 2, 3, 4, 5).
- In-browser PDF pleading generator compiling 10 court-ready documents under Indiana Trial Rule 10 using vendored `pdf-lib`.
- Dual-tree synchronization build script (`scripts/build-core.js`) and parity validation (`scripts/check-parity.js`).
- Complete 92-county court clerk and service address directory (`county-directory.js`).
- Multi-county 365-day statutory window safety checker (IC § 35-38-9-9(d)).
- 4 mandatory pro se legal acknowledgment checkboxes.
