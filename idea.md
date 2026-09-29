**Re-Entry Dashboard — Detailed Implementation Guide, Project Plan, Architecture, Styling & Wireframes**

This plan extends the existing Indiana Expungement Assistant (client-side only) into a private, persistent **Re-Entry Dashboard**. It keeps the core privacy promise: everything stays in the user’s browser by default.

### 1. Core Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence | IndexedDB (primary) + localStorage (settings/flags) | Handles structured cases + binary PDFs far better than localStorage alone |
| Sync | None by default. Optional later encrypted export/import only | Preserves zero-server model |
| Data ownership | User controls all data. Prominent Export / Import / Wipe | Critical for trust |
| Scope | Indiana-focused first (expungement + related re-entry) | Leverages existing eligibility engine and county data |
| Tech stack | Vanilla JS / existing modules + lightweight modern additions | Matches current dual-tree (docs/app + extension) approach |
| Offline | Service Worker for caching static assets + offline vault access | Nice-to-have in Phase 2 |

**Recommended new modules** (mirror into both `src/core/` → `docs/app/` and `extension/`):
- `vault.js` — IndexedDB wrapper
- `timeline.js` — deadline calculation & calendar events
- `dashboard.js` — main UI controller
- `reminders.js` — notification scheduling
- `export-import.js` — vault serialization

### 2. Data Model (IndexedDB)

**Database name**: `IndianaReEntryVault`  
**Version**: 1

**Object Stores**:

```js
// cases
{
  id: string (uuid),
  causeNumber: string,
  county: string,
  offenseTier: number,          // 1-5
  dispositionDate: string|null,
  sentenceCompletedDate: string|null,
  eligibility: object,           // full result from assessEligibility
  status: 'imported' | 'petitioned' | 'granted' | 'denied' | 'archived',
  notes: string,
  createdAt: ISO string,
  updatedAt: ISO string,
  source: 'mycase' | 'manual' | 'demo'
}

// documents
{
  id: string,
  caseId: string|null,           // null = general
  type: 'generated-packet' | 'uploaded' | 'order' | 'isp-report' | 'other',
  name: string,
  mimeType: string,
  data: ArrayBuffer | base64,    // or Blob
  createdAt: ISO string
}

// events (calendar / deadlines)
{
  id: string,
  caseId: string|null,
  title: string,
  date: ISO date,
  type: 'statutory' | 'hearing' | 'service' | 'custom' | 'reminder',
  completed: boolean,
  notes: string
}

// profile (single record)
{
  id: 'user',
  fullName: string,
  addresses: array,
  // ... existing petitioner fields
  lastExported: ISO string|null
}

// settings
{
  id: 'app',
  theme: 'light' | 'dark' | 'system',
  notificationsEnabled: boolean,
  reminderDaysBefore: number[]
}
```

### 3. Detailed Project Plan

**Timeline estimate** (solo experienced developer familiar with the codebase): 8–12 weeks for a solid MVP + polish.

#### Phase 0 — Foundation (1 week)
- Create IndexedDB wrapper (`vault.js`) with open, migrate, CRUD helpers
- Add feature flag / route for `/dashboard` (or new tab in the app)
- Basic “Save to Vault” button after successful import / generation
- Export entire vault as encrypted or plain JSON + ZIP of PDFs
- Import vault with validation and merge/overwrite options
- Wipe vault with confirmation

#### Phase 1 — Core Vault & Case View (2–3 weeks)
- Case list (cards or table) with status badges, county, tier, eligibility summary
- Case detail view: eligibility matrix (reuse existing), notes, linked documents, timeline of events
- Manual case entry (reuse guided manual-entry wizard)
- Document upload (drag-drop) + generated packet auto-save
- Simple list of upcoming deadlines

#### Phase 2 — Timeline, Calendar & Reminders (2 weeks)
- Full calendar view (month/week) using a lightweight library or pure CSS/JS
- Auto-generate statutory events:
  - 365-day multi-county window start/end
  - Prosecutor 30-day response window
  - Waiting-period anniversaries
  - Post-order service reminders (ISP, BMV, local LE)
- Browser Notification API + fallback in-app badges
- .ics export for external calendars

#### Phase 3 — Forms Hub, Resources & Polish (2 weeks)
- Forms launcher (existing generator + placeholders/links for name change, small claims, fee waiver, etc.)
- Curated resource sections (re-entry orgs, employment, housing, county clerks, Indiana Legal Help)
- Mobile-responsive refinements + progressive disclosure
- Empty states, onboarding tour for first-time vault users
- Accessibility audit (WCAG)

#### Phase 4 — Hardening & Extension Parity (1–2 weeks)
- Dual-tree parity checks
- Playwright tests for vault CRUD, export/import, deadline generation
- Storage quota handling and user warnings
- Versioned schema migrations
- Privacy policy / disclaimer updates

### 4. Frontend Styling & Design System

**Keep visual continuity** with the current site (clean, professional, gold accents, dark-mode ready).

**Design tokens** (extend existing):
```css
:root {
  --color-primary: #b8860b;          /* gold */
  --color-primary-hover: #9a7209;
  --color-surface: #faf9f6;
  --color-surface-elevated: #ffffff;
  --color-border: #e8e4d9;
  --color-text: #1a1a1a;
  --color-text-muted: #5c5c5c;
  --color-success: #2e7d32;
  --color-warning: #ed6c02;
  --color-danger: #c62828;
  --radius-card: 12px;
  --shadow-card: 0 2px 8px rgba(0,0,0,0.06);
  --font-serif: "Source Serif 4", Georgia, serif;
  --font-sans: system-ui, -apple-system, sans-serif;
}
```

**Dark mode**: Invert surfaces, keep gold accent, ensure contrast.

**Component patterns**:
- Cards with subtle left border accent for status (green = granted, gold = active, gray = archived)
- Status pills
- Sticky action bar on case detail (Export, Add Document, Add Event)
- Empty states with illustration + clear CTA
- Progressive disclosure drawers for dense statutory content (reuse existing pattern)

**Typography hierarchy**:
- Page titles: serif, 1.75–2rem
- Section headers: sans, 1.25rem, medium weight
- Body: 0.95–1rem
- Meta / dates: 0.85rem muted

### 5. Wireframes (Text Descriptions)

**A. Dashboard Home (Vault Overview)**
```
┌─────────────────────────────────────────────────────────────┐
│ Header (existing nav) + “Re-Entry Vault” badge              │
├─────────────────────────────────────────────────────────────┤
│ [Search cases...]  [+ Add Case]  [Export Vault] [Settings]   │
├──────────────────────┬──────────────────────────────────────┤
│ Upcoming Deadlines   │ My Cases (3)                         │
│ • 12 days – Serve    │ ┌──────────────────────────────────┐ │
│   Prosecutor (49D…)  │ │ 49D01-1605-FD-000123  Marion     │ │
│ • 45 days – 365-day  │ │ Level 6 • Eligible • Petitioned  │ │
│   window ends        │ │ Next: Serve by Oct 3             │ │
│                      │ └──────────────────────────────────┘ │
│ [View Full Calendar] │ ┌──────────────────────────────────┐ │
│                      │ │ ... more case cards ...          │ │
├──────────────────────┴──────────────────────────────────────┤
│ Quick Actions                                               │
│ [Launch Expungement Generator] [Name Change] [Resources]    │
└─────────────────────────────────────────────────────────────┘
```

**B. Case Detail View**
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Vault          49D01-1605-FD-000123   [Status ▾]  │
├─────────────────────────────────────────────────────────────┤
│ Eligibility Matrix (reuse existing component)               │
│ Notes: [editable textarea]                                  │
├──────────────────────┬──────────────────────────────────────┤
│ Documents (4)        │ Timeline                             │
│ • Full Packet.pdf    │ • 2024-05-12 Imported                │
│ • Signed Order.pdf   │ • 2024-05-15 Generated packet        │
│ • ISP Report.pdf     │ • 2024-06-01 Served prosecutor       │
│ [+ Upload]           │ • 2024-07-01 Order granted           │
│                      │ [+ Add Event]                        │
└──────────────────────┴──────────────────────────────────────┘
│ Sticky footer: [Generate Related Forms] [Export Case]       │
└─────────────────────────────────────────────────────────────┘
```

**C. Calendar View**
- Standard month grid
- Color-coded dots/events (statutory = gold, hearing = blue, custom = gray)
- Click day → side panel or modal with event list + add form
- Toggle: “Show only statutory” / “Show completed”

**D. Mobile**
- Bottom navigation: Vault | Calendar | Forms | Resources
- Case cards stack full-width
- Swipe actions on cards (archive, export)

### 6. Key Implementation Instructions

**IndexedDB helper (vault.js) skeleton**:
```js
const DB_NAME = 'IndianaReEntryVault';
const DB_VERSION = 1;

export async function openVault() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cases')) {
        const store = db.createObjectStore('cases', { keyPath: 'id' });
        store.createIndex('causeNumber', 'causeNumber', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      // ... other stores
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

**Auto-save after generation**:
After successful `generateCompletePacket`, call:
```js
await vault.saveDocument({
  caseId: primaryCase.id,
  type: 'generated-packet',
  name: `Expungement_Packet_${causeNumber}.pdf`,
  data: pdfBytes,
  // ...
});
await vault.updateCase(primaryCase.id, { status: 'petitioned', updatedAt: new Date().toISOString() });
```

**Statutory event generation** (timeline.js):
Reuse date logic from `eligibility.js`. On case save or status change to “petitioned”, calculate and insert:
- Prosecutor response deadline (filing date + 30 days, Trial Rule 6(A) aware)
- 365-day window end (if multi-county)
- Recommended ISP/BMV service reminders (order date + 7/14/30 days)

**Privacy UI requirements** (non-negotiable):
- First-visit banner: “This vault lives only in this browser. Export regularly.”
- Settings page with “Export Vault”, “Import Vault”, “Delete All Data”
- Storage usage indicator when approaching limits

### 7. Testing & Acceptance Criteria
- All vault operations work offline
- Export → clear site data → import restores everything accurately
- Deadlines respect Trial Rule 6(A) and existing eligibility date math
- No network requests containing case data
- Dual-tree parity still passes
- Mobile usable (touch targets ≥ 44px, readable matrix)
- Screen-reader friendly case cards and calendar

### 8. Risks & Mitigations
- **Data loss** → Aggressive export prompts + clear warnings
- **Storage quotas** → Monitor `navigator.storage.estimate()`, warn early, prefer references over full PDF blobs if needed
- **Scope creep** → Strict Phase 1 boundary: vault + basic timeline only
- **Legal perception** → Keep strong “not legal advice / you are responsible” language; version-stamp everything

This plan delivers a genuinely useful, privacy-respecting re-entry companion that builds directly on the strengths of the current tool.

Would you like me to expand any section into actual starter code (IndexedDB module, React/Vanilla component skeletons, CSS, or specific deadline calculators)? Or adjust the phasing / prioritization?