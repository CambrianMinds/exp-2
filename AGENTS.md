# AGENTS.md — Indiana Expungement Assistant

## What this repo is

A civic open-source tool that scrapes Indiana MyCase court records **entirely in the
user's browser** and generates 10 court-ready expungement PDFs (IC § 35-38-9) using the
vendored `pdf-lib` library. No server, no cloud, no telemetry. The developer is **not
an attorney**; this is a pro se document-formatting tool and every output carries
mandatory legal disclaimers.

## Two parallel front-end trees — keep them in sync

| Tree | Purpose | Entry point |
|------|---------|-------------|
| `extension/` | Chrome Manifest V3 extension (sidepanel + content script) | `extension/sidepanel/sidepanel.html` |
| `docs/app/` | Standalone browser-based web app (GitHub Pages hosted on `docs/` path) | `docs/app/app.html` |

They share near-identical ES6 module sub-folders, built from a single source of truth in `src/core/`:

```
state.js  →  utils.js  →  ui.js        (shared scaffolding)
scanner.js  profile.js  generator.js  pdf-generator.js  county-directory.js
eligibility.js
```

`extension/*` and `docs/app/*` are maintained by running `npm run build:core`. Logic changes that
touch eligibility, PDF generation, county data, scanner, profile, or state **must be
made in `src/core/`**. The build script will automatically propagate them. `eligibility.js` exists in both trees but is *not* a module in
either (see below).

> `docs/app.js` is **not** part of the web app — it is the landing-page interactive
> eligibility calculator on `docs/index.html`. Do not confuse `docs/app.js` with
> `docs/app/main.js`.

## `eligibility.js` is NOT an ES module

Both copies are IIFEs that attach to `window.IndianaExpungement` for browser use and
also expose `module.exports` for CommonJS:

```js
// loaded as a plain <script>, not <script type="module">
<script src="../eligibility.js"></script>
```

`extension/eligibility.js` is loaded as a plain script in:
- `extension/manifest.json` content_scripts (before `content.js`)
- `sidepanel.html` / `app.html` (before the module `main.js`)

**Do not convert it to `import`/`export`** — Jest tests `require('../extension/eligibility.js')`
with CommonJS assertions. Breaking this breaks all tests.

## Tests

- **Command:** `npm install && npm test`
- **Framework:** Jest 30 (CommonJS mode, configured in `package.json`)
- **Scope:** Only `tests/eligibility.test.js`. It imports `extension/eligibility.js` and
  asserts on `extractCaseTypeCode`, `yearsElapsed`, and `assessEligibility`.
- **Tests:** `tests/eligibility.test.js`, etc. Runs with native ESM support (`--experimental-vm-modules`).
- Running a single test file: `npx jest tests/eligibility.test.js`
- There are **no other test suites**. No ESLint, no Prettier, no type-checker, no
  formatter, no CI workflow (`.github/` does not exist).
- Code formatting and style is enforced by convention. Do not add Prettier or ESLint back.

## Chrome extension — load & structure

- Load `extension/` **unpacked** at `chrome://extensions/` (Developer mode ON).
- Icons live at `extension/icons/` (16/32/48/128 px).
- `manifest.json` content_scripts load **`eligibility.js` first, then `content.js`**.
  Order matters — `content.js` calls `IndianaExpungement.analyzeAll()` expecting the
  global to already exist.
- Content script runs in the MyCase page (`public.courts.in.gov/mycase/*`), scrapes the
  Knockout.js observable model or falls back to DOM, and relays results to the sidepanel
  via `chrome.runtime.onMessage` / `chrome.tabs.sendMessage`.
- The sidepanel (`sidepanel/sidepanel.html`) loads `pdf-lib.min.js` + `eligibility.js`
  as plain scripts, then `main.js` as an ES module.

## Vendored dependencies

- `pdf-lib` is **not** an npm dependency — it ships as a vendored file:
  `extension/pdf-lib.min.js` and `docs/app/pdf-lib.min.js`. Do not `npm install pdf-lib`.
- The only npm dependency is `jest` (devDependency).

## Formatting / PDF generation conventions

`formatting.md` documents the Indiana Trial Rule 10 constraints that the
`pdf-generator.js` files enforce:
- 8.5 × 11 in (612 × 792 pt), 1-inch (72 pt) margins all sides
- 12 pt minimum, black-only (#000000), Times New Roman / Georgia / Arial family
- Double-spaced body text; single-spaced tables and footnotes
- Page numbers bottom-center, starting at 1
- Caption: court name, party title, cause number, Rule 7(A) designation

Apply these rules when editing `extension/sidepanel/pdf-generator.js` or
`docs/app/pdf-generator.js`.

## Legal safeguards (non-negotiable)

- The tool generates **pro se** pleadings only — it is not legal advice and the creator
  is not an attorney.
- **IC § 35-38-9-9(i) lifetime one-shot rule**: a petitioner can expunge convictions
  only once in their lifetime. Omitting a conviction is permanent and irreversible.
- The UI enforces 4 mandatory legal acknowledgment checkboxes (`ackOneShot`,
  `ackAllCounties`, `ackNotLawyer`, `ackProSe`) before the generate button is enabled.
- Do not soften or remove these warnings/disclaimers in UI code, HTML, or docs.

## Data privacy

- Case data is scraped client-side from the user's authenticated MyCase session.
- Petitioner PII (SSN, DOB, DL, 10-year address history) is stored in
  `chrome.storage.local` (extension) or `localStorage` (web app) — never transmitted.
- The content script's `fetchCCS` uses `credentials: 'same-origin'` and adds a
  random 800–1500 ms delay between case requests to mimic human browsing.

## County code parsing

- Case numbers follow the pattern `XXDXX-YYYY-CC-NNNNNN` (e.g. `49D01-1605-FD-000123`).
  - `49D01` → Marion County court code; `49` is the county FIPS.
- `INDIANA_COUNTIES` in `eligibility.js` maps FIPS codes ("01"–"92") to names.
- `county-directory.js` holds verified court clerk, prosecutor, sheriff, ISP, and BMV
  service addresses for the 10-court filing packet.

## `.gitignore` notes

Tracked but binary/vendor: `pdf-lib.min.js`, `extension/icons/*.png`, `docs/assets/*.png`.
Ignored: `node_modules/`, `*.pdf`, `*.zip`, `*.docx`, `.env*`, `.agents/`, `.cline/`,
`skills/`, `__pycache__/`, `.idea/`, `.vscode/`. The `archive/` folder is tracked but its
README documents that the legacy Python backend was retired in favor of client-side
`pdf-lib` — do not revive it.
