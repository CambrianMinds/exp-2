# Privacy Policy & Data Sovereignty Architecture

**Effective Date:** September 7, 2026  
**Project:** Indiana Expungement Assistant  
**License:** Open-Source (MIT)  
**Author:** Justin Bogner · CambrianMinds  

---

## 1. Zero-Telemetry & Client-Side Execution Guarantee

The **Indiana Expungement Assistant** is engineered with an uncompromising architectural principle: **complete client-side data sovereignty**. 

- **No Remote Servers:** There is no backend web server, cloud database, remote API, or telemetry endpoint operated by this project.
- **Zero Tracking:** We do not use Google Analytics, cookies, pixels, fingerprinting, session replay scripts, or any other tracking mechanisms.
- **No Data Exfiltration:** At no point is any Personally Identifiable Information (PII), case number, court record, social security number, date of birth, or address transmitted across the internet to any external server.

---

## 2. Types of Data Processed

When utilizing this application (either via the Chrome Browser Extension or the standalone Web App), the following data categories are processed **exclusively within your local web browser session**:

1. **Petitioner Identification:**
   - Full Legal Name, Maiden Names, Aliases
   - Date of Birth (DOB)
   - Social Security Number (SSN)
   - Indiana Driver's License or State ID Number
   - 10-Year Address History
   - Contact phone number and email address

2. **Court & Criminal Records:**
   - Cause numbers / Case numbers (e.g., `49D01-1605-FD-000123`)
   - Charge descriptions, arrest dates, disposition dates, and court locations
   - Sentence terms and restitution balances extracted from Indiana Odyssey / MyCase

3. **Generated Pleadings:**
   - In-memory PDF document buffers assembled using the vendored `pdf-lib` engine adhering to Indiana Trial Rule 10.

---

## 3. Storage Mechanisms & Security

- **Chrome Extension:** Scraped court records and profile data are stored in `chrome.storage.local`. This storage is sandboxed by Google Chrome to the extension's private origin and is never shared with third parties or websites.
- **Standalone Web App:** Scraped or manually entered records are stored in your browser's private `localStorage` origin (`expunger`).
- **Encryption in Transit:** All interactions with Indiana MyCase (`public.courts.in.gov`) occur over standard HTTPS directly between your browser and the state judicial server. This software acts solely as an in-browser parser on your active session.

---

## 4. User Control & Data Purging

You retain complete and unilateral control over your data:

- **Purge at Any Time:** You can immediately wipe all saved records, intake data, and cached cases by clicking **"Clear All Data"** in the settings panel or clearing your browser's site data/cookies.
- **Extension Uninstall:** Removing the extension instantly destroys all locally sandboxed records.
- **Public / Clinic Computers:** If preparing documents on a shared library computer, legal aid clinic workstation, or community center kiosk, always click **"Clear All Data"** before logging out.

---

## 5. Third-Party Services & Links

This application contains links to official state resources, including:
- Indiana MyCase Portal (`public.courts.in.gov/mycase/`)
- Indiana General Assembly (`iga.in.gov`)
- Indiana Supreme Court Self-Service Legal Center (`courts.in.gov`)

Visiting those links directs you to external state government servers subject to the State of Indiana's respective privacy notices.

---

## 6. Open-Source Verification

Because this project is open-source under the MIT License, our privacy guarantees are fully auditable. You or any security researcher can inspect the complete source code on GitHub at:
[https://github.com/CambrianMinds/expunger](https://github.com/CambrianMinds/expunger)
