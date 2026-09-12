# Architecture of Indiana Expungement Assistant

The **Indiana Expungement Assistant** is a client-side civic legal technology application that scrapes court docket records from the Indiana Odyssey court portal (MyCase) and compiles court-ready expungement packets conforming to Indiana Trial Rule 10 and IC § 35-38-9.

---

## 1. High-Level Component Diagram

```mermaid
graph TD
    subgraph "Indiana Judicial System"
        MC["MyCase Portal<br>(public.courts.in.gov/mycase)"]
        ODYSSEY["Tyler Technologies Odyssey SPA<br>(Knockout.js / REST API)"]
        MC --- ODYSSEY
    end

    subgraph "Chrome Extension (Manifest V3)"
        CS["content.js<br>(Injected Content Script)"]
        CS_MAIN["content-main.js<br>(Intercepted Network Cache)"]
        SP["sidepanel.html / main.js<br>(Sidepanel UI)"]
        SW["background.js<br>(Service Worker Relay)"]
        
        CS --- CS_MAIN
        CS <-->|"chrome.runtime.sendMessage"| SW
        SW <-->|"chrome.tabs.sendMessage"| SP
    end

    subgraph "Standalone Web Application"
        PWA["docs/app/app.html<br>(PWA / GitHub Pages)"]
        BM["docs/bookmarklet.js<br>(1-Click Exporter)"]
        JSON_UP["File Upload / Drag & Drop<br>(HTML/JSON import)"]
        
        BM -->|"JSON Export"| JSON_UP
        JSON_UP --> PWA
    end

    subgraph "Shared Core Library (src/core/)"
        RULES["eligibility.js<br>(Statutory Engine: IC § 35-38-9)"]
        VALIDATOR["validateCaseRecord()<br>(Runtime Input Validator)"]
        PDF["pdf-generator.js<br>(Trial Rule 10 Compiler)"]
        DIR["county-directory.js<br>(92 Counties Directory)"]
        UTILS["utils.js<br>(AuditLogger, Drafts, Dates)"]
        PDFLIB["pdf-lib.min.js<br>(Vendored PDF Engine)"]
        
        RULES --- VALIDATOR
        PDF --- PDFLIB
        PDF --- DIR
    end

    SP -->|"Loads"| RULES
    SP -->|"Loads"| PDF
    SP -->|"Uses"| UTILS
    
    PWA -->|"Loads"| RULES
    PWA -->|"Loads"| PDF
    PWA -->|"Uses"| UTILS
```

---

## 2. Dual-Tree Distribution Architecture

To serve users both inside the Chrome browser extension and on open web platforms (including mobile devices and Chromebooks), the project employs a **dual front-end build system**:

| Target | Entry Point | Execution Context | Storage Layer |
|---|---|---|---|
| **Chrome Extension** | `extension/sidepanel/sidepanel.html` | Chrome MV3 side panel alongside MyCase | `chrome.storage.local` + `sessionStorage` |
| **Web App (PWA)** | `docs/app/app.html` | Static GitHub Pages web application | `localStorage` + `sessionStorage` |

Both targets share identical ES6 core logic copied from `src/core/` via `scripts/build-core.js`.
Parity is strictly enforced by `scripts/check-parity.js` during every test run.

---

## 3. Scraper Pipeline & Fallback Chain

When extracting records from Indiana MyCase (`public.courts.in.gov/mycase`), the content script applies a multi-tier fallback extraction strategy:

```mermaid
flowchart TD
    Start([Initiate Case Scan]) --> Stage1{Knockout Context<br>#OD_BODY available?}
    Stage1 -- Yes --> KO[Extract via ko.dataFor]
    Stage1 -- No --> Stage2{Rendered DOM Rows<br>.result-row found?}
    Stage2 -- Yes --> DOM[Extract via DOM selectors & regex]
    Stage2 -- No --> Stage3[Manual User Entry Modal]
    
    KO --> TokenCheck{CaseToken<br>Present?}
    DOM --> TokenCheck
    
    TokenCheck -- Yes --> CacheCheck{Intercepted Cache<br>Hit?}
    TokenCheck -- No --> SummaryOnly[Use Search Row Data]
    
    CacheCheck -- Hit --> ParseCCS[Parse CCS JSON Model]
    CacheCheck -- Miss --> WireFetch[fetchWithRetry /Case/CaseSummary]
    
    WireFetch -- 200 OK --> ParseCCS
    WireFetch -- Fail/404 --> ROAFallback[fetchWithRetry /Case/CaseSummaryReport]
    ROAFallback -- Success --> ParseCCS
    ROAFallback -- Fail --> SummaryOnly
    
    ParseCCS --> Normalize[Normalize Case Record & Charges]
    SummaryOnly --> Normalize
    Normalize --> Validate[validateCaseRecord Validator]
    Validate --> Rules[IndianaExpungement.assessEligibility]
```

---

## 4. Message Flow (Extension Communication)

In the Chrome extension:
1. **User triggers scan**: Sidepanel UI sends `SCAN_PAGE` message to `background.js`.
2. **Tab Routing**: `background.js` locates the active MyCase tab and relays the command to `content.js`.
3. **Execution**: `content.js` executes the scraper pipeline, gathers records, parses CCS dockets, and performs initial validation.
4. **Relay & Confirmation**: `content.js` sends `PAGE_RESULTS` back through the service worker to the sidepanel.
5. **Parity Confirmation**: The sidepanel opens the **Scraper Parity Modal**, allowing the user to review all scraped cases before committing them to state.

---

## 5. Privacy & Security Model

- **Client-Side Only**: The entire application runs in the user's browser thread. No servers, no tracking, and no external analytics exist.
- **Odyssey Credentials**: The extension utilizes the user's existing authenticated cookies on `public.courts.in.gov` via `credentials: 'same-origin'`. It never stores, prompts for, or handles court passwords.
- **Client Audit Trail**: All audit logs are maintained in browser `sessionStorage` and can be exported as a JSON manifest by the user. Nothing is phoned home.
