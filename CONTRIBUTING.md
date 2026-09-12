# Contributing to Indiana Expungement Assistant

Thank you for your interest in contributing to the **Indiana Expungement Assistant** (`indiana-expunge`). This is an open-source civic technology project dedicated to helping pro se individuals navigate Indiana's Second Chance Law (Indiana Code § 35-38-9).

---

## 1. Dual-Tree Architecture & Single Source of Truth

> [!IMPORTANT]
> **CRITICAL RULE**: The project maintains two parallel front-end trees:
> 1. `extension/`: Chrome Manifest V3 extension (sidepanel + content script)
> 2. `docs/app/`: Standalone browser web app / GitHub Pages PWA (`docs/app/app.html`)
>
> **Source of Truth**: All shared business logic, statutory rules, PDF generation, and court directories live in **`src/core/`**:
> ```
> src/core/
> ├── eligibility.js       # Statutory rules engine (IC § 35-38-9) [IIFE script]
> ├── content.js           # MyCase content script & Odyssey scraper
> ├── content-main.js      # Isolated-world content script entry point
> ├── county-directory.js  # Verified clerk/prosecutor/service addresses
> ├── pdf-generator.js     # Trial Rule 10 pleading compiler (pdf-lib)
> ├── profile.js           # Petitioner profile and 10-year address history
> ├── state.js             # State container
> ├── ui.js                # Core UI helpers, modals, toast notifications
> ├── utils.js             # Date parsing, AuditLogger, draft persistence
> ├── scanner.js           # Scraper orchestrator & parity manager
> ├── generator.js         # Pleading generator orchestrator
> └── i18n.js              # Internationalization loader
> ```
> **NEVER** edit files in `extension/` or `docs/app/` directly if they originate from `src/core/`.
> Always make changes in `src/core/`, then run:
> ```bash
> npm run build:core
> ```
> This script automatically propagates your changes to both `extension/` and `docs/app/`.

---

## 2. Mandatory Legal Safeguards (Non-Negotiable)

1. **Pro Se Tool Only**: This tool formats court-ready documents under Indiana Trial Rule 10. The creator and contributors are **not attorneys**. No output from this tool constitutes legal advice.
2. **Lifetime One-Shot Rule (IC § 35-38-9-9(i))**: Under Indiana law, conviction expungement petitions may only be granted once in a person's lifetime. Any conviction omitted is permanently barred from relief.
3. **Mandatory Acknowledgment Checkboxes**: The application enforces 4 mandatory legal acknowledgment checkboxes before document generation is enabled:
   - `ackOneShot`: Lifetime one-shot rule warning
   - `ackAllCounties`: Confirmation that all counties were searched
   - `ackNotLawyer`: Acknowledgment that the tool is not a lawyer
   - `ackProSe`: Understanding of pro se filing responsibility
4. **Never soften or remove these disclaimers**: Automated tests (`npm run test:disclaimers`) will fail if required statutory warnings are modified or deleted.

---

## 3. Development Workflow & Setup

### Prerequisites
- Node.js >= 18.0.0
- npm >= 10.0.0

### Installation
```bash
git clone https://github.com/CambrianMinds/exp-2.git
cd exp-2
npm install
```

### Running Tests
Every change must pass the full test suite before submitting a Pull Request:
```bash
npm test
```
The `npm test` command automatically executes:
1. `npm run build:core` — propagates `src/core/` to both front-end trees
2. `npm run i18n` — compiles localization strings
3. `npm run test:parity` — verifies 100% byte-for-byte parity across mirrored files
4. `jest` — runs unit and integration tests (`tests/*.test.js`)
5. `npm run test:i18n` — verifies all locale keys are translated
6. `npm run test:disclaimers` — verifies presence of mandatory statutory disclaimers

### End-to-End Testing (Playwright)
```bash
npx playwright test
```

---

## 4. `eligibility.js` Module Constraints

`eligibility.js` is **NOT** an ES module. It is an IIFE (Immediately Invoked Function Expression) that:
- Attaches to `window.IndianaExpungement` in browser environments
- Exposes `module.exports` for CommonJS in Node/Jest

```javascript
// Loaded as a plain script in HTML, NOT type="module":
<script src="../eligibility.js"></script>
```

**Do not convert it to `import` / `export` statements.** Jest tests require `require('../extension/eligibility.js')` in CommonJS mode. Converting it will break test suites and extension execution.

---

## 5. Indiana Trial Rule 10 Document Constraints

When modifying `src/core/pdf-generator.js`, strictly adhere to the Indiana Rules of Trial Procedure (Trial Rule 10) and `formatting.md`:
- **Dimensions**: Exactly 8.5 × 11 inches (612 × 792 points).
- **Margins**: At least 1-inch (72 points) on all four sides (top, bottom, left, right).
- **Font**: 12-point minimum, strictly black `#000000`, Times New Roman font family.
- **Line Spacing**: Double-spaced body paragraphs (24 pt line height); single-spaced tables and captions.
- **Pagination**: Consecutive page numbers bottom-center starting on page 1.
- **Caption Structure**: Exact court name, title of action (`In the Matter of the Expungement of the Arrest and Conviction Records of...`), cause number line, and Rule 7(A) document title.

---

## 6. Pre-Commit / Release Checklist

Before submitting a PR or cutting a release:
- [ ] Logic edits made exclusively in `src/core/`
- [ ] Ran `npm run build:core`
- [ ] Ran `npm test` and all suites pass (0 failures)
- [ ] Ran `npx playwright test`
- [ ] No git diff in mirrored files (`git status` shows clean sync)
- [ ] Any new UI text includes a `data-i18n` key in `locales/translations.json`
- [ ] Documented user-facing changes in `CHANGELOG.md`
