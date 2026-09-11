const fs = require('fs');
const path = require('path');

const filesToCheck = [
  path.resolve(__dirname, '../docs/app/app.html'),
  path.resolve(__dirname, '../extension/sidepanel/sidepanel.html')
];

const requiredIds = [
  'id="ackOneShot"',
  'id="ackAllCounties"',
  'id="ackNotLawyer"',
  'id="ackProSe"'
];

let allValid = true;

for (const file of filesToCheck) {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    allValid = false;
    continue;
  }
  
  const content = fs.readFileSync(file, 'utf8');
  for (const reqId of requiredIds) {
    if (!content.includes(reqId)) {
      console.error(`File ${path.basename(file)} is missing required disclaimer ID: ${reqId}`);
      allValid = false;
    }
  }
}

if (!allValid) {
  process.exit(1);
} else {
  console.log('Disclaimer check passed: All required disclaimers are present in HTML files.');
}
