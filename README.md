# Indiana Expungement Assistant

[![Build Status](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square)](https://github.com/CambrianMinds/expunger)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Chrome%20MV3%20%7C%20Web%20App-indigo?style=flat-square)](https://cambrianminds.github.io/expunger/)
[![Statute](https://img.shields.io/badge/Indiana%20Code-IC%20%C2%A7%2035--38--9-emerald?style=flat-square)](https://iga.in.gov/laws/2023/ic/titles/35#35-38-9)

A 100% client-side civic document preparation engine that scrapes Indiana MyCase court records in the user's browser and generates 10 court-ready expungement pleadings (IC § 35-38-9) adhering to Indiana Trial Rule 10.

- **Zero Cloud / Zero Telemetry**: All scraping, eligibility evaluation, and PDF compilation execute entirely in-memory in the browser. PII never leaves the client.
- **Dual Deployments**: Distributed as a Chrome Manifest V3 extension (`extension/`) and a standalone PWA / web application (`docs/app/`).
- **Live Web App**: [https://cambrianminds.github.io/expunger/](https://cambrianminds.github.io/expunger/)

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

Shared logic modules are mirrored across trees:
```text
eligibility.js  county-directory.js  pdf-generator.js
profile.js      state.js             ui.js             utils.js
```

`scripts/check-parity.js` runs during CI and `npm test` to enforce byte-for-byte identity on shared files:
```bash
npm run test:parity
```

---

## Developer Quickstart

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 10.0.0

### Setup
```bash
git clone https://github.com/CambrianMinds/expunger.git
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
│   └── e2e/app.spec.js            # Playwright end-to-end integration tests
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
