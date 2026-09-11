### Implementation Specification: Interface Consolidation & Statutory Safeguards

This specification outlines the UI restructuring, responsive layout rules, and statutory gatekeepers for the self-help portal.

---

### Task 1: Initial Landing Interstitial (UPL / Pro Se Disclaimer Gate)

Implement a blocking modal gate on initial page load to secure an affirmative self-representation acknowledgment before user interaction.

* **DOM Element:** Native `<dialog id="disclaimer-gate">`.
* **Visual Presentation:**
* Fixed, centered viewport positioning.
* Backdrop styling: `backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.75);`.

* **Content:**
* Header: "Pro Se Self-Help Legal Notice & Non-Attorney Disclaimer".
* Core points: Independent clerical software (not a law firm or legal advice), no attorney-client relationship, 100% user responsibility under penalty of perjury.
* Input: Single checkbox (`id="tos-checkbox"`): *"I understand that I am representing myself (pro se) and that this software is an automated clerical tool, not legal counsel."*
* Action: `<button id="tos-submit" disabled>` tagged "Enter Assistant".

* **Logic (`localStorage`):**
* On load, check `localStorage.getItem('expungement_tos_accepted')`.
* If absent, invoke `dialog.showModal()`. Prevent closing on `Escape` key by canceling the `cancel` event.
* Checkbox toggle enables/disables `#tos-submit`.
* On submit click: set `expungement_tos_accepted = 'true'` in `localStorage` and call `dialog.close()`.

---

### Task 2: Hero Section Streamlining & CTA Hierarchy

Strip dense informational text from above the fold to keep initial screen height under 600px.

* **Structure:**
* `<h1>`: Keep high-impact statement (*"Your Second Chance Starts Here. No attorney required to file."*).
* Subtitle / Badge: Retain client-side privacy tag (*"100% Client-Side • Free & Open-Source • IC § 35-38-9"*).
* Concise Lead: 1–2 sentences explaining the automated clerical workflow (Scrape MyCase $\rightarrow$ Auto-generate 10 pleadings).

* **CTA Layout (Front & Center):**
* **Primary CTA:** "1-Click Bookmarklet (Instant Export)" $\rightarrow$ points directly to bookmarklet drag anchor.
* **Secondary CTA:** "Upload MyCase JSON / HTML" $\rightarrow$ opens file upload / web app entry point.
* Remove redundant links, tutorials, and long narrative paragraphs from this block.

---

### Task 3: Dual Expandable Utility Cards (Grid Layout)

Replace sprawling vertical sections with a two-card interactive grid, closed by default to prioritize screen real estate.

* **Layout Container:**
* CSS Grid: `display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;`.
* Responsive: Stacks vertically automatically on viewports $< 768\text{px}$.

* **Card 1: Statutory Eligibility (`<details id="eligibility-card">`)**
* `<summary>` Header: "Check Statutory Eligibility"
* Sub-label on face: "Run your offense level and sentencing date against IC § 35-38-9 waiting periods and mandatory grant criteria."
* Inner Content: Existing 3-step interactive calculator (Classifications, Date Picker, Statutory Pre-Filing checkboxes).
* State Persistence: Native HTML inputs inside `<details>` retain user input when toggled; ensure no reactive JS resets values on toggle.

* **Card 2: How It Works (`<details id="how-it-works-card">`)**
* `<summary>` Header: "How It Works (4 Steps)"
* Sub-label on face: "Scrape MyCase dockets, auto-populate all 10 Trial Rule pleadings, and file with the county clerk."
* Inner Content: Existing 4-step visual walkthrough.

---

### Task 4: Native `<details>` Element for Court Pleadings

Compress the "10 Court-Ready Pleadings" section to eliminate vertical scroll fatigue while maintaining SEO and browser findability.

* **Implementation:** Wrap the pleading list in `<details id="pleadings-details">`.
* **Summary Tag:**
* Text: "View the 10 Court-Ready Documents Generated"
* Visual pill badge: "Formatted to Indiana Trial Rule 10"

* **Behavioral Note:** Native `<details>` remains indexed and will auto-open if a user performs an in-page browser search (**Ctrl+F / Cmd+F**) for specific pleading names (e.g., "Appearance Form", "Fee Waiver").

---

### Task 5: Persistent Statutory Viewport Banner

Display an unavoidable warning about Indiana’s one-shot restriction without obstructing core workflow actions.

* **Styling:**
* CSS: `position: fixed; bottom: 0; left: 0; width: 100%; z-index: 999;`.
* Visual: High-contrast alert styling (dark slate background, amber/gold left border, clean typography).

* **Text:** "⚠️ Statutory Warning: Indiana permits conviction expungement only once per lifetime (IC § 35-38-9-9). Omitted convictions are permanently forfeited."
* **Viewport Handling:**
* Add dynamic padding or CSS utility (`body { padding-bottom: 70px; }`) so footer content and submission triggers are not masked.
* Include a minimize/toggle button to collapse the banner into a small corner warning pill on mobile screens.

---

### Task 6: Pre-Generation Intercept Modal (Statutory Seatbelt)

Block packet generation until the user actively confirms an audit across all 92 Indiana counties.

* **DOM Element:** Native `<dialog id="generation-intercept-modal">`.
* **Trigger:** Intercept the final click on `#generate-packet-btn` (or PDF compile button) using `event.preventDefault()`.
* **Modal Architecture:**
* Heading: "Wait. Have you searched every Indiana county?"
* Warning Copy: Detail IC § 35-38-9-9(d) (365-day consolidation window) and § 35-38-9-9(i) (lifetime bar on omitted convictions).
* Affirmation Checkbox (`id="confirm-consolidation"`):
* *"I confirm that I have searched MyCase under all legal names/aliases across all 92 Indiana counties. I understand that any conviction omitted from this filing can never be expunged in my lifetime."*

* Action Buttons:
* "Back / Re-Check Records" (closes modal, returns to editor).
* `<button id="final-proceed-btn" disabled>` labeled "Confirm & Generate PDF".

* **Execution:** Checking the box enables `#final-proceed-btn`. Clicking proceed executes the original compilation/download script and closes the modal.

---

### Task 7: Hash Navigation Auto-Expansion Script

Ensure that deep-links in the navigation bar (e.g., `#eligibility`, `#pleadings`, `#how-to-file`) properly expand collapsed `<details>` containers when clicked.

```javascript
function handleHashExpansion() {
  const hash = window.location.hash;
  if (!hash) return;
  
  const targetElement = document.querySelector(hash);
  if (!targetElement) return;

  if (targetElement.tagName === 'DETAILS') {
    targetElement.open = true;
  } else {
    const parentDetails = targetElement.closest('details');
    if (parentDetails) parentDetails.open = true;
  }
  
  targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.addEventListener('DOMContentLoaded', handleHashExpansion);
window.addEventListener('hashchange', handleHashExpansion);

```
