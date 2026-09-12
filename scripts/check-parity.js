const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const SRC_CORE = path.join(REPO_ROOT, 'src', 'core');
const EXTENSION_ROOT = path.join(REPO_ROOT, 'extension');
const EXTENSION_SIDEPANEL = path.join(REPO_ROOT, 'extension', 'sidepanel');
const DOCS_APP = path.join(REPO_ROOT, 'docs', 'app');

const PAIRS_TO_CHECK = [
  // Files mirrored from src/core to extension root and docs/app
  {
    source: path.join(SRC_CORE, 'eligibility.js'),
    mirrors: [
      path.join(EXTENSION_ROOT, 'eligibility.js'),
      path.join(DOCS_APP, 'eligibility.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'content.js'),
    mirrors: [
      path.join(EXTENSION_ROOT, 'content.js'),
      path.join(DOCS_APP, 'content.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'content-main.js'),
    mirrors: [
      path.join(EXTENSION_ROOT, 'content-main.js'),
      path.join(DOCS_APP, 'content-main.js')
    ]
  },
  // Files mirrored from src/core to extension/sidepanel and docs/app
  {
    source: path.join(SRC_CORE, 'county-directory.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'county-directory.js'),
      path.join(DOCS_APP, 'county-directory.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'pdf-generator.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'pdf-generator.js'),
      path.join(DOCS_APP, 'pdf-generator.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'profile.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'profile.js'),
      path.join(DOCS_APP, 'profile.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'state.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'state.js'),
      path.join(DOCS_APP, 'state.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'ui.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'ui.js'),
      path.join(DOCS_APP, 'ui.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'utils.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'utils.js'),
      path.join(DOCS_APP, 'utils.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'scanner.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'scanner.js'),
      path.join(DOCS_APP, 'scanner.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'generator.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'generator.js'),
      path.join(DOCS_APP, 'generator.js')
    ]
  },
  {
    source: path.join(SRC_CORE, 'i18n.js'),
    mirrors: [
      path.join(EXTENSION_SIDEPANEL, 'i18n.js'),
      path.join(DOCS_APP, 'i18n.js')
    ]
  },
  // Vendored libraries
  {
    source: path.join(EXTENSION_ROOT, 'pdf-lib.min.js'),
    mirrors: [
      path.join(DOCS_APP, 'pdf-lib.min.js')
    ]
  }
];

function normalizeLineEndings(buffer) {
  return buffer.toString('utf8').replace(/\r\n/g, '\n');
}

console.log('Checking dual-tree code parity...');
let mismatches = 0;

for (const entry of PAIRS_TO_CHECK) {
  const relSource = path.relative(REPO_ROOT, entry.source);
  if (!fs.existsSync(entry.source)) {
    console.error(`❌ Source file missing: ${relSource}`);
    mismatches++;
    continue;
  }
  const sourceContent = normalizeLineEndings(fs.readFileSync(entry.source));

  for (const mirrorPath of entry.mirrors) {
    const relMirror = path.relative(REPO_ROOT, mirrorPath);
    if (!fs.existsSync(mirrorPath)) {
      console.error(`❌ Mirror file missing: ${relMirror}`);
      mismatches++;
      continue;
    }
    const mirrorContent = normalizeLineEndings(fs.readFileSync(mirrorPath));

    if (sourceContent !== mirrorContent) {
      console.error(`❌ Parity mismatch: ${relSource} != ${relMirror}`);
      mismatches++;
    }
  }
}

if (mismatches > 0) {
  console.error(`\nParity check FAILED: Found ${mismatches} mismatch(es). Run 'npm run build:core' to synchronize.`);
  process.exit(1);
} else {
  console.log('Parity check passed: All mirrored files across extension and docs/app are 100% in sync.');
}
