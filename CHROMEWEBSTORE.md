# Chrome Web Store Production Listing & Submission Guide

> **Extension Name**: Indiana Expungement Assistant  
> **Version**: 1.0.0  
> **Developer**: Justin Bogner · CambrianMinds  
> **License**: MIT License  
> **Target Manifest**: Manifest V3  

---

## 1. Store Listing Information (Ready to Copy/Paste)

### Extension Name (Max 75 chars)
```text
Indiana Expungement Assistant
```

### Short Description (Max 132 chars)
```text
Scan Indiana MyCase records and generate court-ready criminal record expungement petition packets under Indiana Code § 35-38-9.
```

### Detailed Description (Plain text formatted for CWS)
```text
Indiana Expungement Assistant is a free, independent self-help legal document generator designed to help Hoosiers reclaim their second chance under Indiana's Second Chance Law (Indiana Code § 35-38-9).

Indiana law permits eligible individuals to expunge conviction and non-conviction records, removing barriers to employment, professional licensing, and housing. However, the legal paperwork can be daunting, and hiring private counsel often costs thousands of dollars. This extension automates the discovery, eligibility analysis, and formal document formatting for pro se (self-represented) petitioners.

KEY FEATURES
• Automated MyCase Record Extraction: Reads case numbers, charge descriptions, filing dates, disposition details, and court codes directly from Indiana MyCase search results.
• Statutory Eligibility Analysis: Evaluates records against IC § 35-38-9 tiers (Arrests/Dismissals, Misdemeanors, Level 6 Felonies, and Major Felonies).
• Waiting Period Calculations: Automatically calculates required statutory waiting periods from arrest or disposition date.
• Lifetime One-Shot Rule Protection: Enforces strict statutory warnings under IC § 35-38-9-9(i), preventing irreversible omissions before filing.
• Complete In-Browser Court Pleadings: Uses client-side PDF generation (pdf-lib) directly inside the browser to compile court-ready pro se pleadings (including Appearance Form, Notice of Exclusion of Confidential Information, Confidential Information Sheet ACR Form, and Verified Petition) with zero server dependencies or local software setup.

HOW TO USE
1. Navigate to Indiana MyCase (public.courts.in.gov/mycase) in Google Chrome.
2. Search for all cases under your legal name, previous names, maiden names, and aliases across all Indiana counties.
3. Open the Indiana Expungement Assistant side panel.
4. Click "Scan Page & Check Eligibility" to analyze your charges.
5. Complete your Petitioner Profile in the Profile tab (stored locally only).
6. Acknowledge the statutory legal disclaimers and one-shot rule.
7. Click "Generate Complete Petition Packet" to download your filing package immediately.

PRIVACY & DATA SECURITY GUARANTEE
• 100% In-Browser Execution: All case analysis and document generation happen entirely on your computer inside the browser session.
• Zero Cloud Storage: Your Social Security Number, Date of Birth, addresses, and criminal history are NEVER transmitted to external servers, cloud databases, or third parties.
• Transparent & Open Source: Auditable codebase licensed under the MIT License.

LEGAL DISCLAIMER
The creator of this software is an independent software developer, NOT an attorney, law firm, or legal aid organization. This tool is a clerical document preparation assistant and does not provide legal advice, legal counsel, or case representation. You are filing pro se (representing yourself) and are solely responsible for reviewing, signing, serving, and filing all paperwork with the appropriate Court Clerk.
```

### Category
```text
Productivity
```

### Single Purpose Statement (For CWS Review Team)
```text
Extracts public court case records from Indiana MyCase to analyze statutory expungement eligibility and prepare pro se court pleadings under Indiana Code § 35-38-9.
```

---

## 2. Graphics & Promotional Assets

All production-ready graphic assets are generated and located in `docs/assets/webstore/` and `extension/icons/`:

| Asset | Dimensions | Location | Status |
|-------|------------|----------|--------|
| **Extension Icon 16** | 16×16 PNG | `extension/icons/icon16.png` | ✅ Generated & Linked |
| **Extension Icon 32** | 32×32 PNG | `extension/icons/icon32.png` | ✅ Generated & Linked |
| **Extension Icon 48** | 48×48 PNG | `extension/icons/icon48.png` | ✅ Generated & Linked |
| **Extension Icon 128** | 128×128 PNG | `extension/icons/icon128.png` | ✅ Generated & Linked |
| **Web Store Store Icon** | 128×128 PNG | `docs/assets/webstore/store_icon_128.png` | ✅ Generated |
| **Small Promo Tile** | 440×280 PNG | `docs/assets/webstore/small_promo_tile_440x280.png` | ✅ Generated |
| **Marquee Promo Tile** | 1400×560 PNG | `docs/assets/webstore/marquee_promo_tile_1400x560.png` | ✅ Generated |

---

## 3. Permissions Justifications (For CWS Reviewers)

When prompted by the Chrome Developer Dashboard, use the exact justifications below:

| Permission | Reason / Justification |
|------------|------------------------|
| `activeTab` | Required to detect when the user is viewing their Indiana MyCase search results page and trigger document analysis upon user request. |
| `storage` | Required to locally persist the user's petitioner profile and case review progress inside Chrome's secure local storage (`chrome.storage.local`). Never synced to the cloud. |
| `sidePanel` | Required to provide an accessible, full-featured side panel user interface while browsing MyCase, per Chrome's Manifest V3 side panel API. |
| `scripting` | Required to execute the content script that reads public docket table elements from the active MyCase search tab. |
| `downloads` | Required to trigger the download of the completed petition packet ZIP file containing generated PDF pleadings. |
| `host_permissions: https://public.courts.in.gov/*` | Required to parse public court records on Indiana's official court records portal (`public.courts.in.gov/mycase`). |
| `host_permissions: http://127.0.0.1:8000/*` & `localhost` | Optional development permission; document generation runs 100% client-side in the browser via pdf-lib with zero external network transmission. |

---

## 4. Privacy & Data Disclosures

- **Personally Identifiable Information (PII)**: Collected locally in browser memory/local storage only (Name, DOB, SSN, Address) to populate court-mandated Confidential Information Sheets (Form ACR). **NOT transmitted off-device.**
- **Health Info**: Not collected.
- **Financial Info**: Not collected.
- **Authentication Info**: Not collected.
- **Web History**: Not collected. The extension only interacts with `public.courts.in.gov/mycase`.
- **User Activity / Analytics**: Zero analytics, zero telemetry, zero tracking cookies.
- **Privacy Policy URL**: `https://cambrianminds.github.io/expunger/#privacy`

---

## 5. Submission Step-by-Step

1. Zip the extension directory:
   - Select all files inside `extension/` (`manifest.json`, `background.js`, `content.js`, `eligibility.js`, `icons/`, `sidepanel/`).
   - Create a ZIP archive: `expunger-v1.0.0.zip`.
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Click **Add new item** and upload `expunger-v1.0.0.zip`.
4. Fill in the **Store Listing** fields using Section 1 above.
5. Upload the **Store Icon** (`docs/assets/webstore/store_icon_128.png`), **Small Promo Tile** (`docs/assets/webstore/small_promo_tile_440x280.png`), and **Marquee Promo Tile** (`docs/assets/webstore/marquee_promo_tile_1400x560.png`).
6. Paste the **Permissions Justifications** from Section 3.
7. Complete the **Privacy Practices** questionnaire using Section 4.
8. Submit for review!
