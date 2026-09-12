# Troubleshooting Guide — Indiana Expungement Assistant

This guide helps resolve common issues encountered while using or developing the Indiana Expungement Assistant.

---

## 1. MyCase Scraper Troubleshooting

### Issue: "No Cases Found" When Scanning MyCase
- **Cause**: Search results table has not finished rendering, or you are on the search query input page rather than the search results page.
- **Solution**:
  1. Make sure you have clicked "Search" on `public.courts.in.gov/mycase` and can visibly see your search results list on screen.
  2. Wait 2–3 seconds for Tyler Technologies Odyssey SPA to complete Knockout binding.
  3. Click "Scan Page" in the extension again.
  4. If results still do not appear, save the page as an HTML file (`Ctrl+S` or `Cmd+S`) and upload it via the web app.

### Issue: "Session Expired or Verification Required"
- **Cause**: Odyssey session cookies have timed out, or Tyler Technologies displayed a bot-prevention CAPTCHA / Cloudflare challenge.
- **Solution**:
  1. Refresh the MyCase tab in Chrome.
  2. If a verification challenge or CAPTCHA appears, solve it manually in the browser tab.
  3. Re-run your search and click "Scan Page".

### Issue: "Waiting for MyCase tab..." in Sidepanel
- **Cause**: The active browser tab is not on `public.courts.in.gov/mycase`.
- **Solution**:
  1. Click on the tab containing your MyCase search results.
  2. Ensure the URL begins with `https://public.courts.in.gov/mycase`.
  3. Refresh the sidepanel or re-click the extension icon.

---

## 2. Eligibility & Date Parsing Issues

### Issue: "MANUAL REVIEW REQUIRED: Unable to verify disposition date"
- **Cause**: Court clerk entered the disposition or sentencing date in an unconventional format, or the case record only lists an unparseable status string.
- **Solution**:
  1. Click on the case card to expand it and review the raw court status text.
  2. Open the case on MyCase and inspect the Chronological Case Summary (CCS) for the sentencing or dismissal entry date.
  3. If necessary, use the "Add Case Manually" button to enter the exact cause number and verified judgment date.

### Issue: Case Marked Ineligible Due to Pending Charges
- **Cause**: A case on your record has a status of `PENDING`, `OPEN`, `ACTIVE`, or `WARRANT`.
- **Statutory Constraint**: Under Indiana Code § 35-38-9, a court **cannot** grant an expungement if the petitioner has any criminal charges actively pending.
- **Solution**:
  1. Verify whether the pending case has reached final disposition.
  2. If the case was dismissed or resolved, wait for the court clerk to update MyCase, or obtain a certified copy of the dismissal from the court clerk.
  3. All pending criminal charges must reach final judgment before filing.

---

## 3. PDF Generation & Download Issues

### Issue: PDF Download Does Not Start
- **Cause**: Browser popup blocker or download permission restrictions.
- **Solution**:
  - In Chrome: Check the address bar for a blocked download or popup icon and click "Always allow".
  - In the Web App: Ensure your browser allows file downloads from GitHub Pages (`cambrianminds.github.io`).
  - Alternatively, use the **In-App PDF Preview Mode** (click "Preview Documents" instead of "Generate Packet") to inspect and save individual pleadings.

### Issue: "You must acknowledge all mandatory legal notices before generating"
- **Cause**: One or more of the 4 legal acknowledgment checkboxes on the Generate tab are unchecked.
- **Solution**:
  - Check `ackOneShot` (Lifetime One-Shot Rule), `ackAllCounties` (All Counties Searched), `ackNotLawyer` (Pro Se Disclosure), and `ackProSe` (Filing Responsibility).
  - All four legal acknowledgments are statutorily mandatory.

---

## 4. Developer Troubleshooting

### Issue: Parity Check Fails (`npm run test:parity`)
- **Error**: `Parity check failed: Files in extension/ and docs/app/ do not match src/core/`
- **Cause**: Changes were made directly in `extension/` or `docs/app/` instead of `src/core/`, or `npm run build:core` was not executed after making edits.
- **Solution**:
  ```bash
  npm run build:core
  npm test
  ```

### Issue: Translation Check Fails (`npm run test:i18n`)
- **Error**: `Missing translation keys in locales/translations.json`
- **Cause**: A new `data-i18n` attribute was added in HTML without a corresponding key in `translations.json`.
- **Solution**:
  1. Add the missing key and translations to `locales/translations.json`.
  2. Run `npm run i18n`.
  3. Re-run `npm test`.
