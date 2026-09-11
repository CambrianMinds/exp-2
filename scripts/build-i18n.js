const fs = require('fs');
const path = require('path');

const TRANSLATIONS_PATH = path.resolve(__dirname, '../locales/translations.json');
const HTML_DIRECTORIES = [
  path.resolve(__dirname, '../docs'),
  path.resolve(__dirname, '../extension')
];
const OUTPUT_JS_PATHS = [
  path.resolve(__dirname, '../docs/app/i18n.js'),
  path.resolve(__dirname, '../extension/sidepanel/i18n.js')
];

// Helper to recursively find HTML files
function findHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findHtmlFiles(fullPath, fileList);
    } else if (fullPath.endsWith('.html')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function main() {
  console.log('Building i18n files...');
  
  // 1. Read existing translations
  let translations = { en: {}, es: {} };
  if (fs.existsSync(TRANSLATIONS_PATH)) {
    translations = JSON.parse(fs.readFileSync(TRANSLATIONS_PATH, 'utf8'));
  }

  // Ensure primary languages exist
  if (!translations.en) translations.en = {};
  if (!translations.es) translations.es = {};

  // 2. Scan HTML files for data-i18n keys
  let allHtmlFiles = [];
  for (const dir of HTML_DIRECTORIES) {
    findHtmlFiles(dir, allHtmlFiles);
  }

  const foundKeys = new Set();
  const regex = /data-i18n="([^"]+)"/g;

  for (const file of allHtmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = regex.exec(content)) !== null) {
      foundKeys.add(match[1]);
    }
  }

  // 3. Add missing keys
  let addedKeys = 0;
  for (const key of foundKeys) {
    if (!translations.en[key]) {
      translations.en[key] = `TODO: Translate (en): ${key}`;
      addedKeys++;
    }
    if (!translations.es[key]) {
      translations.es[key] = `TODO: Translate (es): ${key}`;
      if (!translations.en[key].startsWith('TODO')) {
        // If it only missed in Spanish, increment addedKeys if we want to track it
        addedKeys++;
      }
    }
  }

  if (addedKeys > 0) {
    console.log(`Found and added ${addedKeys} missing translation keys.`);
  }

  // Optional: check for unused keys
  const unusedEn = Object.keys(translations.en).filter(k => !foundKeys.has(k));
  if (unusedEn.length > 0) {
    console.warn(`Warning: Found ${unusedEn.length} keys in translations.json that are not used in any HTML file.`);
  }

  // 4. Save updated JSON
  fs.writeFileSync(TRANSLATIONS_PATH, JSON.stringify(translations, null, 2));
  console.log(`Updated ${TRANSLATIONS_PATH}`);

  // 5. Generate JS files
  const template = `(function(window) {
  const translations = ${JSON.stringify(translations, null, 2)};

  function translateDOM(lang) {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang] && translations[lang][key]) {
        if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'email' || el.type === 'tel')) {
          el.placeholder = translations[lang][key];
        } else {
          let textNodeFound = false;
          el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '') {
              node.nodeValue = translations[lang][key];
              textNodeFound = true;
            }
          });
          if (!textNodeFound) {
            el.textContent = translations[lang][key];
          }
        }
      }
    });
  }

  function toggleLanguage() {
    let lang = localStorage.getItem('user_lang') || 'en';
    lang = lang === 'en' ? 'es' : 'en';
    localStorage.setItem('user_lang', lang);
    translateDOM(lang);
    updateToggleUI(lang);
  }

  function updateToggleUI(lang) {
    const toggles = document.querySelectorAll('.lang-toggle-text');
    toggles.forEach(t => {
      t.textContent = lang === 'en' ? 'EN' : 'ES';
    });
    document.documentElement.lang = lang;
  }

  function initLanguage() {
    const lang = localStorage.getItem('user_lang') || 'en';
    translateDOM(lang);
    updateToggleUI(lang);
    
    const toggles = document.querySelectorAll('.lang-toggle');
    toggles.forEach(t => {
      t.addEventListener('click', toggleLanguage);
    });
  }

  window.IndianaI18n = {
    translations,
    translateDOM,
    toggleLanguage,
    initLanguage
  };

})(window);
`;

  for (const outPath of OUTPUT_JS_PATHS) {
    // Ensure dir exists
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outPath, template);
    console.log(`Generated ${outPath}`);
  }

  console.log('i18n build complete.');
}

main();
