# Internationalization & Translation Guide (i18n)

The **Indiana Expungement Assistant** supports multi-language interfaces using a client-side dictionary-based internationalization architecture.

---

## 1. i18n Architecture Overview

Translations are maintained in a central JSON catalog:
- **Source of Truth**: `locales/translations.json`
- **Compiler Script**: `scripts/build-i18n.js` (generates `src/core/i18n.js`, `extension/sidepanel/i18n.js`, and `docs/app/i18n.js`)
- **Verification Script**: `scripts/check-i18n.js` (runs as part of `npm test`)

In HTML templates, translatable elements declare a `data-i18n` attribute:
```html
<span data-i18n="nav_guide">Guide</span>
```

When language switches, `applyLanguage(lang)` traverses the DOM and swaps text content matching the catalog keys.

---

## 2. Adding a New Language

1. **Open `locales/translations.json`**:
   Add the new language code (e.g. `es` for Spanish) under each translation key:
   ```json
   {
     "nav_guide": {
       "en": "Guide",
       "es": "Guía"
     }
   }
   ```
2. **Rebuild i18n bundles**:
   ```bash
   npm run i18n
   ```
3. **Verify completeness**:
   ```bash
   npm run test:i18n
   ```
   The checker ensures every key contains a non-empty string for every registered language.

---

## 3. Strict Rules for Legal Disclaimers

> [!WARNING]
> **Legal Translation Accuracy**:
> The Indiana Expungement Assistant contains statutory disclosures required by Indiana law:
> - The Lifetime One-Shot Rule (IC § 35-38-9-9(i))
> - Pro Se filing acknowledgments
> - Non-attorney disclaimer
>
> Any translation of legal notices into Spanish or other languages **must preserve exact statutory meaning**. Do not soften terms such as "mandatory forfeiture", "perjury affirmation", or "court discretion".
