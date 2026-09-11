const fs = require('fs');
const path = require('path');

const translationsPath = path.resolve(__dirname, '../locales/translations.json');
const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

const enKeys = Object.keys(translations.en);
let allMatch = true;

for (const lang of Object.keys(translations)) {
  if (lang === 'en') continue;
  
  const langKeys = Object.keys(translations[lang]);
  const missingKeys = enKeys.filter(key => !langKeys.includes(key));
  
  if (missingKeys.length > 0) {
    console.error(`Language '${lang}' is missing the following keys present in 'en':`);
    console.error(missingKeys.join(', '));
    allMatch = false;
  }
}

if (!allMatch) {
  process.exit(1);
} else {
  console.log('I18n check passed: All languages have complete translations.');
}
