/**
 * scripts/sync-repos.js
 * Automatically synchronizes shared statutory logic, court directory, and vendored libraries
 * from expunger to indiana-expunge-pro (and vice-versa).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRO_REPO_DIR = path.resolve(REPO_ROOT, '..', 'indiana-expunge-pro');

const SYNC_MAPPINGS = [
  {
    src: path.join(REPO_ROOT, 'extension', 'eligibility.js'),
    dest: path.join(PRO_REPO_DIR, 'eligibility.js'),
    description: 'Statutory Eligibility Engine (IC § 35-38-9)'
  },
  {
    src: path.join(REPO_ROOT, 'extension', 'sidepanel', 'county-directory.js'),
    dest: path.join(PRO_REPO_DIR, 'county-directory.js'),
    description: '92-County Court & Agency Directory'
  },
  {
    src: path.join(REPO_ROOT, 'extension', 'pdf-lib.min.js'),
    dest: path.join(PRO_REPO_DIR, 'pdf-lib.min.js'),
    description: 'Vendored pdf-lib library'
  }
];

function runSync(direction = 'to-pro') {
  console.log(`\n🔄 [Sync] Running cross-repo sync (Direction: ${direction})...`);

  if (!fs.existsSync(PRO_REPO_DIR)) {
    console.warn(`⚠️  Pro repository not found at expected path: ${PRO_REPO_DIR}`);
    console.warn(`   Skipping local filesystem copy. (In CI, git clone is handled by GitHub Actions).`);
    return;
  }

  let changesCount = 0;

  for (const item of SYNC_MAPPINGS) {
    const fromPath = direction === 'to-pro' ? item.src : item.dest;
    const toPath = direction === 'to-pro' ? item.dest : item.src;

    if (!fs.existsSync(fromPath)) {
      console.warn(`⚠️  Source file does not exist: ${fromPath}`);
      continue;
    }

    const srcContent = fs.readFileSync(fromPath);
    let destContent = null;
    if (fs.existsSync(toPath)) {
      destContent = fs.readFileSync(toPath);
    }

    if (!destContent || !srcContent.equals(destContent)) {
      fs.copyFileSync(fromPath, toPath);
      console.log(`  ✓ Updated ${item.description}: ${path.basename(toPath)}`);
      changesCount++;

      // If syncing from pro back to pro se, also update the docs/app mirror to preserve parity!
      if (direction === 'from-pro') {
        if (item.src.includes('eligibility.js')) {
          const docsAppPath = path.join(REPO_ROOT, 'docs', 'app', 'eligibility.js');
          fs.copyFileSync(fromPath, docsAppPath);
        } else if (item.src.includes('county-directory.js')) {
          const docsAppPath = path.join(REPO_ROOT, 'docs', 'app', 'county-directory.js');
          fs.copyFileSync(fromPath, docsAppPath);
        } else if (item.src.includes('pdf-lib.min.js')) {
          const docsAppPath = path.join(REPO_ROOT, 'docs', 'app', 'pdf-lib.min.js');
          fs.copyFileSync(fromPath, docsAppPath);
        }
      }
    } else {
      console.log(`  - Up to date: ${path.basename(toPath)}`);
    }
  }

  if (changesCount > 0) {
    console.log(`\n🎉 Synchronized ${changesCount} file(s).`);
    // Run verification tests in destination
    try {
      if (direction === 'to-pro') {
        console.log(`\n🧪 Running validation tests in indiana-expunge-pro...`);
        execSync('npm test', { cwd: PRO_REPO_DIR, stdio: 'inherit' });
      } else {
        console.log(`\n🧪 Running validation tests in indiana-expunge...`);
        execSync('npm test', { cwd: REPO_ROOT, stdio: 'inherit' });
      }
      console.log(`\n✅ Destination test suite passed successfully.`);
    } catch (testErr) {
      console.error(`❌ Validation tests failed after sync:`, testErr.message);
      process.exitCode = 1;
    }
  } else {
    console.log(`\n✨ Repositories are already perfectly in sync. No changes needed.`);
  }
}

const args = process.argv.slice(2);
const direction = args.includes('--from-pro') ? 'from-pro' : 'to-pro';
runSync(direction);
