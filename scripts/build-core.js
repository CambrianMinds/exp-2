const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src/core');
const extensionRoot = path.resolve(__dirname, '../extension');
const extensionSidepanel = path.resolve(__dirname, '../extension/sidepanel');
const docsApp = path.resolve(__dirname, '../docs/app');

// Map of file basename to target directories
const targetMap = {
  'eligibility.js': [extensionRoot, docsApp],
  'content.js': [extensionRoot, docsApp],
  'county-directory.js': [extensionSidepanel, docsApp],
  'pdf-generator.js': [extensionSidepanel, docsApp],
  'profile.js': [extensionSidepanel, docsApp],
  'state.js': [extensionSidepanel, docsApp],
  'ui.js': [extensionSidepanel, docsApp],
  'utils.js': [extensionSidepanel, docsApp],
  'i18n.js': [extensionSidepanel, docsApp]
};

console.log('Building core scripts...');

for (const [file, targets] of Object.entries(targetMap)) {
  const srcPath = path.join(srcDir, file);
  if (!fs.existsSync(srcPath)) {
    console.error(`ERROR: Source file ${srcPath} does not exist.`);
    process.exit(1);
  }

  for (const targetDir of targets) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const destPath = path.join(targetDir, file);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file} -> ${path.relative(path.resolve(__dirname, '..'), destPath)}`);
  }
}

console.log('Core build complete.');
