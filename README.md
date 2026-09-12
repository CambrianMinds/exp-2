# Indiana Expungement Assistant

[![Build Status](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square)](https://github.com/CambrianMinds/exp-2)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Chrome%20MV3%20%7C%20Web%20App-indigo?style=flat-square)](https://cambrianminds.github.io/exp-2/)
[![Statute](https://img.shields.io/badge/Indiana%20Code-IC%20%C2%A7%2035--38--9-emerald?style=flat-square)](https://iga.in.gov/laws/2023/ic/titles/35#35-38-9)

A 100% client-side civic document preparation engine that scrapes Indiana MyCase court records in the user's browser and generates 10 court-ready expungement pleadings (IC § 35-38-9) adhering to Indiana Trial Rule 10. Designed with a modern, accessible interface utilizing deep dark mode and responsive components.

- **Zero Cloud / Zero Telemetry**: All scraping, eligibility evaluation, and PDF compilation execute entirely in-memory in the browser. PII never leaves the client.
- **Dual Deployments**: Distributed as a Chrome Manifest V3 extension (`extension/`) and a standalone PWA / web application (`docs/app/`).
- **Live Web App**: [https://cambrianminds.github.io/exp-2/](https://cambrianminds.github.io/exp-2/)

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER SESSION                          │
│                                                                        │
│   ┌────────────────────────┐      ┌────────────────────────────────┐   │
│   │  public.courts.in.gov  │◄────►│ In-Browser Scraping Layer      │   │
│   │  (Odyssey Case Portal) │      │ • Knockout.js observable hook  │   │
│   │  • Search Results      │      │ • Same-origin CCS fetcher      │   │
│   │  • Chronological Case  │      │ • Merging & deduplication      │   │
│   │    Summaries (CCS)     │      └───────────────┬────────────────┘   │
│   └────────────────────────┘                      │ Parsed Case JSON   │
│                                                   ▼                    │
│                                   ┌────────────────────────────────┐   │
│                                   │ Statutory Rules Engine         │   │
│                                   │ (IC § 35-38-9 / eligibility.js)│   │
│                                   │ • 5-tier offense evaluation    │   │
│                                   │ • 365-day consolidation window │   │
│                                   │ • Trial Rule 6(A) computation  │   │
│                                   └───────────────┬────────────────┘   │
│                                                   │ Verified Payload   │
│                                                   ▼                    │
│   ┌────────────────────────┐      ┌────────────────────────────────┐   │
│   │ Court-Ready Pleadings  │◄─────│ pdf-lib Generation Pipeline    │   │
│   │ (10 Standard Pleadings │      │ (Trial Rule 10 Layout Engine)  │   │
│   │  + Instructions PDF)   │      │ • In-memory AcroForm filler    │   │
│   └────────────────────────┘      │ • Mixed-batch relief split     │   │
│                                   └────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Technical Mechanics

### 1. Knockout.js Observable Extraction
Indiana's Odyssey-powered MyCase system binds case data to an internal Knockout.js MVVM view-model prior to rendering. Traditional DOM selectors break when court template columns shift.

The content script accesses the underlying reactive state directly:

```javascript
const koRoot = document.querySelector('[data-bind]');
const vm = ko.dataFor(koRoot);
const cases = ko.unwrap(vm.SearchResults) || ko.unwrap(vm.caseList);
```

**Fallback Strategy**:
1. Traversal using stable ARIA attributes and `data-bind` properties.
2. Direct asynchronous fetch to the Odyssey Case Summary (CCS) endpoint (`credentials: 'same-origin'`) incorporating an 800–1500ms randomized jitter delay to prevent rate-limiting during deep multi-case exports.

### 2. Statutory Rules Engine (`eligibility.js`)
`eligibility.js` is a dual-environment IIFE that exposes `window.IndianaExpungement` in browser runtimes and `module.exports` under CommonJS (for Jest).

> **Architectural Constraint**: Do not convert `eligibility.js` to an ES module. Chrome extension content scripts load it sequentially before `content.js`, and Jest relies on CommonJS evaluation.

**Statutory Evaluation Logic (IC § 35-38-9)**:
- **IC § 35-38-9-1 (Non-convictions / Dismissals)**: Mandatory grant, ≥ 1 year wait from arrest/dismissal. Decoupled from the 365-day multi-county consolidation limitation.
- **IC § 35-38-9-2 (Misdemeanors)**: Mandatory grant, ≥ 5 years from conviction.
- **IC § 35-38-9-3 (Class D / Level 6 Felonies)**: Mandatory grant, ≥ 8 years from conviction.
- **IC § 35-38-9-4 (Major Felonies, Levels 1–5)**: Discretionary grant, ≥ 8 years from conviction (or ≥ 3 years from completion of sentence).
- **IC § 35-38-9-5 (Serious Bodily Injury Felonies)**: Discretionary grant requiring written prosecutor consent, ≥ 10 years from conviction.

**Consolidation & Date Calculations**:
- Integer-day delta calculation: `Math.floor((today - priorDate) / 86400000)`. Avoids calendar month and leap-year drift.
- **Indiana Trial Rule 6(A)**: If day 365 lands on a weekend, court holiday, or office closure, the deadline automatically extends to the next business day.

### 3. Client-Side PDF Generation (`pdf-generator.js`)
Court pleadings are compiled using the vendored `pdf-lib.min.js` (no backend dependencies, no headless Chrome). Pleadings strictly follow **Indiana Trial Rule 10**:
- 8.5 × 11 inch pages, 72 pt (1-inch) margins on all sides.
- 12 pt body text in standard serif/sans typography, double-spaced body, single-spaced tables and captions.
- Bottom-center page numbering starting at 1.
- **Bifurcated Relief in DOC 07 (Proposed Order)**: When a packet contains both IC § 35-38-9-1 (arrests/dismissals) and conviction tiers, the judicial relief sections are automatically partitioned to prevent improper civil rights restoration language from invalidating dismissed charge seals.

---

## Dual-Tree Architecture & Parity

The codebase maintains two synchronized front-end trees:

| Tree | Environment | Entry Point |
|------|-------------|-------------|
| `extension/` | Chrome Manifest V3 (Sidepanel + Content Scripts) | `extension/sidepanel/sidepanel.html` |
| `docs/app/` | Standalone Web App / PWA (GitHub Pages) | `docs/app/app.html` |

Shared logic modules are authored in `src/core/` (Single Source of Truth) and propagated automatically via `npm run build:core`:
```text
eligibility.js  county-directory.js  pdf-generator.js  generator.js
profile.js      state.js             ui.js             utils.js
scanner.js      i18n.js              content.js        content-main.js
```

`scripts/check-parity.js` runs during CI and `npm test` to enforce byte-for-byte identity on shared files:
```bash
npm run test:parity
```

---

## Release v1.2.0 Capabilities & Pro Se Safeguards

### 1. Guided Manual Case Entry (`#manualEntryModal`) & Complete Parity
- **Direct Cause Insertion**: Pro se filers can add missing, older, or archived records absent from MyCase search results.
- **Full Parity with Scraped Records**: Manual cases immediately populate the comprehensive Statutory Eligibility Matrix (`#eligibilityMatrixCard`), calculate waiting periods and fee waivers, display one-shot warnings, and require full clearance of the 4-point Pre-Flight Checklist before filing packet compilation.
- **Statutory Tier Assignment**: Map causes to IC § 35-38-9-1 (non-conviction), § 35-38-9-2 (misdemeanor), § 35-38-9-3 (Level 6 felony), § 35-38-9-4 (major felony), or § 35-38-9-5 (serious felony).
- **Sentence & Restitution Validation**: Captures sentence completion dates (mandatory for the 3-year post-discharge waiting period under Sections 4 & 5) and outstanding fine/fee balances.
- **Mandatory Completeness Acknowledgment**: Enforces confirmation under IC § 35-38-9-9(i) that omitting any count or conviction permanently forfeits future expungement rights.

### 2. Automatic Ineligible-Offense Flagging at Import
- **Instant Statutory Bar Detection**: Scraped, uploaded, and manually entered cases are analyzed against statutory exclusion rules (IC § 35-38-9-3(b) and § 8(b)).
- **Pattern Matching**: Automatically flags Murder (`MR` case type code or cause pattern `/-MR-/`), offenses causing death (IC § 35-42-1), sex/violent offender registry offenses (IC § 11-8-8), human trafficking (IC § 35-42-3.5), and public corruption.
- **High-Visibility Barred Indicators**: Displays prominent red `[⛔ BARRED]` badges on case cards, dedicated statutory exclusion callouts explaining why the offense is barred, exclusion rows in the Eligibility Matrix, and an aggregate warning banner in the Results tab.

### 3. Actionable Indiana State Police (ISP) Guidance (`#ispNoticeBanner`)
- **Direct IN.gov Portal Link**: One-click navigation to the official Indiana State Police Limited Criminal History request portal (`https://www.in.gov/ai/appfiles/isp-lch/`).
- **Cost & Turnaround Breakdown**:
  - **Online:** **$15.00** per search · **Instant PDF Download** via Access Indiana.
  - **Mail:** **$7.00** per search · **7–14 Business Days** using official ISP Form 8053.
- **Older Case Protection**: Protects against lifetime forfeiture by alerting filers that pre-2010 dispositions or unindexed paper files often do not appear on MyCase.

### 4. Residential Address History Helper & Statutory Clarity
- **1-Click "Copy Previous Address"**: Added helper button on prior address cards to instantly copy street, city, state, and ZIP code from preceding entries or current residence, drastically speeding up data entry.
- **Clear Statutory Purpose Explanation**: Transparently explains under IC § 35-38-9-8(b)(3) why full address history from earliest arrest/offense is required:
  - Facilitates prosecutorial and Indiana State Police background checks to confirm no active warrants or open charges exist across any prior jurisdiction.
  - Form ACR (Confidential Court Record under Access to Court Records Rule 5) ensures personal residential history is permanently sealed from public view.
  - Prevents fatal pleading defects and objections from county prosecutors.

### 5. Pre-Flight Record Completeness Checklist (`.preflight-checklist-card`)
A required 4-point verification gate before petition compilation:
- **92-County Search**: Affirmation that MyCase was searched across all 92 Indiana counties under legal names, maiden names, and aliases.
- **ISP Criminal History Check**: Confirmation that official Indiana State Police records were checked or acknowledgment of risk regarding unindexed paper dockets.
- **$0 Balance on Fines & Fees**: Affirmation that all court costs, probation fees, and victim restitution are paid in full (IC § 35-38-9-8(b)(6)).
- **Zero Pending Charges**: Confirmation of no active open criminal charges or outstanding arrest warrants anywhere in the United States (IC § 35-38-9-8(b)(4)).

### 6. Plain-Language Expungement Tier Explainer (`#expungementExplainerDrawer`)
- Detailed breakdown contrasting **Section 1 (full sealing / erased from public record)** with **Sections 2–3 (mandatory seal from employers)** and **Sections 4–5 (discretionary / marked as expunged on public docket)**.
- Prominent statutory exclusion warnings highlighting offenses barred by law: homicide/death offenses (IC § 35-42-1), sex/violent offender registry offenses (IC § 11-8-8), human trafficking (IC § 35-42-3.5), public corruption by elected officials, and two or more separate felony convictions involving deadly weapons.

### 7. Lawyer Advisory & Filing Logistics (`#lawyerAdvisoryCard`)
- Outlines Indiana E-Filing System (IEFS) electronic filing vs. in-person filing with County Clerks.
- Details statutory timelines, including the prosecutor's 30-day objection window (IC § 35-38-9-8(f)).
- Connects filers to free civil legal aid resources: [Indiana Legal Help](https://indianalegalhelp.org) and [Indiana Legal Services](https://www.indianalegalservices.org).

### 8. Mobile UX & 44px Touch Targets
- Conforms to WCAG 2.5.5 touch target sizing (≥ 44×44 CSS pt) for all interactive buttons, checkboxes, radio buttons, and inputs.
- Responsive single-column layouts for mobile Safari / Chrome users.

### 9. Indiana Trial Rule 10 Footer & Audit Stamp
- Court-ready PDFs generated via `pdf-generator.js` feature clean 1-inch margins (72 pt), 12 pt Times New Roman typography, double-spaced body, single-spaced tables, bottom-center page numbering starting at 1, and an official Pro Se filing footer stamp referencing IC § 35-38-9.

### 10. Full Spanish Language Localization (100% Parity)
- Complete English (`en`) and Spanish (`es`) translations maintained in `locales/translations.json`.
- Dynamic client-side language toggle in both the Chrome extension sidepanel and web application with instant DOM translation.
- Validated with automated test `npm run test:i18n` ensuring 100% key parity across all languages.

---

## Developer Quickstart

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 10.0.0

### Setup
```bash
git clone https://github.com/CambrianMinds/exp-2.git
cd expunger
npm install
```

### Local Development Servers
To run the Web App locally:
```bash
# Serve repo root
npx serve -p 3000 .
# Open http://localhost:3000/docs/app/app.html
```

To run the Chrome Extension:
1. Navigate to `chrome://extensions/` in Chrome or Chromium.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `extension/` directory.

---

## Test Suites & Validation

All tests can be executed via:

```bash
npm test
```

`npm test` runs the complete verification pipeline:
1. `npm run i18n`: Scans HTML templates for `data-i18n` keys, syncs `locales/translations.json`, and outputs bundle scripts.
2. `node --experimental-vm-modules jest`: Runs all unit and statutory assessment tests (`tests/eligibility.test.js`, `tests/scraper.test.js`, `tests/schemas.test.js`, `tests/pdf-generator.test.js`, `tests/canary-schema.test.js`).
3. `npm run test:parity`: Validates byte-for-byte equality across mirrored modules.
4. `npm run test:i18n`: Ensures all translation keys are fully mirrored between languages.
5. `npm run test:disclaimers`: Validates that mandatory pro se statutory acknowledgment IDs (`ackOneShot`, `ackAllCounties`, `ackNotLawyer`, `ackProSe`) exist in both entry points.

### End-to-End Testing (Playwright)
End-to-end browser tests run on Chromium using Playwright:

```bash
npm run test:e2e
```

---

## Mandatory Pro Se & Statutory Guards

Under IC § 35-38-9-9(i), a petitioner may expunge criminal convictions only once in their lifetime. Omitting a conviction is permanent and irreversible.

To protect pro se filers from defective petitions, the UI and CI pipelines enforce 4 mandatory input identifiers before packet compilation is permitted:
- `#ackOneShot`: Lifetime one-shot rule affirmation (IC § 35-38-9-9(i)).
- `#ackAllCounties`: Statewide 92-county search verification.
- `#ackNotLawyer`: Pro se self-representation disclosure (no attorney-client relationship).
- `#ackProSe`: Assumption of filing responsibility and verification under penalty of perjury.

Removing or renaming these element IDs fails `npm run test:disclaimers`.

---

## Repository Structure

```text
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest & permissions
│   ├── background.js              # Service worker handling routing
│   ├── content.js                 # Content script: Knockout reader & CCS fetcher
│   ├── eligibility.js             # Statutory decision engine (IIFE)
│   ├── pdf-lib.min.js             # Vendored PDF assembly engine
│   └── sidepanel/                 # Extension UI & controllers
├── docs/                          # GitHub Pages Root & Standalone App
│   ├── index.html                 # Documentation portal & landing page
│   ├── style.css                  # Design system tokens & styles
│   ├── app.js                     # Landing page interactivity
│   ├── bookmarklet.js             # 1-click browser exporter utility
│   └── app/                       # Standalone Web Application (mirrors extension/sidepanel)
├── tests/                         # Test suites
│   ├── eligibility.test.js        # Statutory decision engine unit tests
│   ├── scraper.test.js            # Scraper extraction unit tests
│   ├── canary-schema.test.js      # Headless scraper canary validation
│   └── e2e/                       # Playwright end-to-end integration tests
│       ├── app.spec.js            # Basic app flow and event dispatching tests
│       └── real-world.spec.js     # Complex statutory multi-county scenarios
├── scripts/                       # CI & verification scripts
│   ├── check-parity.js            # Dual-tree module parity check
│   ├── check-disclaimers.js       # Required disclaimer IDs check
│   ├── check-i18n.js              # Translation completeness check
│   └── build-i18n.js              # Translation extraction & compilation
├── locales/                       # Locale strings (translations.json)
└── package.json                   # Scripts, Jest, and Playwright configuration
```

---

## License

MIT License &copy; Justin Bogner · [CambrianMinds](https://github.com/CambrianMinds)
