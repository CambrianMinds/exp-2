/**
 * Canary Zod Schema & Headless Playwright Verification
 * 
 * Validates MyCase extraction payload structures and runs a headless Playwright
 * browser instance to verify that Odyssey DOM extraction produces schemas
 * matching IC § 35-38-9 requirements.
 */

const { chromium } = require('playwright');
const { validateMyCasePayload } = require('../scripts/canary/schema.js');

const SAMPLE_ODYSSEY_DOM = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Indiana Courts — MyCase Search Results</title>
</head>
<body>
  <div id="OD_BODY">
    <div id="search-results-container">
      <table class="table result-table" id="searchResultsTable">
        <thead>
          <tr>
            <th>Case Info</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr class="result-row" data-casetoken="canary_token_49D01_1805">
            <td>
              <div class="result-title">State of Indiana v. Marcus Vance</div>
              <div class="result-subtitle" title="Case Number">49D01-1804-CM-014920</div>
            </td>
            <td>
              <div class="result-row-details">
                <div class="row">
                  <div class="col-md-6 court-desc">Court: Marion Superior Court, Criminal Division 1</div>
                  <div class="col-md-6 case-type-desc">Case Type: CM - Criminal Misdemeanor</div>
                </div>
                <div class="row">
                  <div class="col-md-6 filed-date-desc">Filed: 04/10/2018</div>
                  <div class="col-md-6 status-desc">Status: 05/10/2018, Disposed - Conviction</div>
                </div>
                <div class="row">
                  <div class="col-md-12 charges-desc">Charges: Operating While Intoxicated</div>
                </div>
              </div>
              <a href="#" class="case-detail-link" data-casetoken="canary_token_49D01_1805">CCS Details</a>
            </td>
          </tr>
          <tr class="result-row" data-casetoken="canary_token_29D03_1509">
            <td>
              <div class="result-title">State of Indiana v. Sarah Jenkins</div>
              <div class="result-subtitle" title="Case Number">29D03-1509-F6-007812</div>
            </td>
            <td>
              <div class="result-row-details">
                <div class="row">
                  <div class="col-md-6 court-desc">Court: Hamilton Superior Court 3</div>
                  <div class="col-md-6 case-type-desc">Case Type: F6 - Level 6 Felony</div>
                </div>
                <div class="row">
                  <div class="col-md-6 filed-date-desc">Filed: 09/10/2015</div>
                  <div class="col-md-6 status-desc">Status: 11/20/2015, Disposed - Conviction</div>
                </div>
                <div class="row">
                  <div class="col-md-12 charges-desc">Charges: Theft - Prior Unrelated Conviction</div>
                </div>
              </div>
              <a href="#" class="case-detail-link" data-casetoken="canary_token_29D03_1509">CCS Details</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
`;

/**
 * Headless Playwright script that launches Chromium, evaluates the scraper
 * against a rendered Odyssey DOM or live target, and asserts schema validity.
 *
 * @param {Object} options
 * @param {string} [options.mockHtml] - HTML string to evaluate against (defaults to SAMPLE_ODYSSEY_DOM)
 * @param {string} [options.liveUrl] - Optional live URL to test if live scraping is requested
 * @param {number} [options.timeout] - Timeout in milliseconds
 * @returns {Promise<{ success: boolean, payload: Object, errors: Array }>}
 */
async function runPlaywrightCanary(options = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    if (options.liveUrl) {
      await page.goto(options.liveUrl, { waitUntil: 'domcontentloaded', timeout: options.timeout || 30000 });
    } else {
      const htmlContent = options.mockHtml !== undefined ? options.mockHtml : SAMPLE_ODYSSEY_DOM;
      await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    }

    // Evaluate DOM extraction in headless browser context
    const extractedCases = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr.result-row');
      const cases = [];

      rows.forEach((row, index) => {
        const titleEl = row.querySelector('.result-title');
        const caseNumEl = row.querySelector('.result-subtitle[title="Case Number"]');
        const tokenLink = row.querySelector('[data-casetoken]');
        const token = row.getAttribute('data-casetoken') || tokenLink?.getAttribute('data-casetoken') || '';

        // Extract metadata text
        const textContent = row.textContent || '';
        const courtMatch = textContent.match(/Court:\s*([^\n\r]+)/i);
        const caseTypeMatch = textContent.match(/Case Type:\s*([^\n\r]+)/i);
        const filedMatch = textContent.match(/Filed:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        const statusMatch = textContent.match(/Status:\s*([^\n\r]+)/i);
        const chargesMatch = textContent.match(/Charges:\s*([^\n\r]+)/i);

        const statusStr = statusMatch ? statusMatch[1].trim() : '';
        const dispDateMatch = statusStr.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
        const dispositionDate = dispDateMatch ? dispDateMatch[1] : (filedMatch ? filedMatch[1] : '');

        if (caseNumEl || titleEl) {
          cases.push({
            index: index + 1,
            case_number: (caseNumEl ? caseNumEl.textContent : '').trim(),
            title: (titleEl ? titleEl.textContent : '').trim(),
            court: courtMatch ? courtMatch[1].trim() : 'Indiana Trial Court',
            case_type: caseTypeMatch ? caseTypeMatch[1].trim() : 'CM',
            filed: filedMatch ? filedMatch[1] : '',
            status: statusStr,
            dispositionDate: dispositionDate,
            charges: chargesMatch ? chargesMatch[1].trim() : '',
            caseToken: token
          });
        }
      });

      return cases;
    });

    const payload = {
      source: 'Indiana Expungement Assistant Headless Canary',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      searchContext: 'State of Indiana',
      totalCases: extractedCases.length,
      hasCCS: false,
      cases: extractedCases
    };

    const validation = validateMyCasePayload(payload);

    return {
      success: validation.success,
      payload,
      errors: validation.errors || []
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Jest Test Suites ───────────────────────────────────────────────

if (typeof describe !== 'undefined') {
  describe('Canary Zod Schema Validation', () => {
  const sampleValidPayload = {
    source: 'Indiana Expungement Assistant Bookmarklet',
    version: '1.0',
    exportedAt: '2026-09-06T00:00:00.000Z',
    searchContext: 'State of Indiana',
    totalCases: 2,
    hasCCS: true,
    cases: [
      {
        index: 1,
        case_number: '49D01-1805-CM-012345',
        title: 'State of Indiana v. John Doe',
        court: 'Marion Superior Court, Criminal Division 1',
        case_type: 'CM - Criminal Misdemeanor',
        filed: '05/12/2018',
        status: '09/14/2018, Disposed - Conviction',
        dispositionDate: '09/14/2018',
        charges: 'Operating While Intoxicated',
        caseToken: 'abc123token',
        ccs: {
          charges: [
            { count: '01', offense: 'Operating While Intoxicated', statute: '9-30-5-2', level: 'CM', disposition: 'Conviction', dispositionDate: '09/14/2018' }
          ],
          docketEntries: [
            { date: '05/12/2018', description: 'Information Filed' }
          ]
        }
      },
      {
        index: 2,
        case_number: '49D02-1901-F6-000456',
        title: 'State of Indiana v. Jane Smith',
        court: 'Marion Superior Court, Criminal Division 2',
        case_type: 'F6 - Level 6 Felony',
        filed: '01/10/2019',
        status: '06/20/2019, Dismissed',
        dispositionDate: '06/20/2019',
        charges: 'Theft',
        caseToken: 'def456token'
      }
    ]
  };

  it('passes on a valid MyCase export payload', () => {
    const result = validateMyCasePayload(sampleValidPayload);
    expect(result.success).toBe(true);
    expect(result.data.totalCases).toBe(2);
  });

  it('fails when cases array is empty (cases.length === 0)', () => {
    const invalidPayload = {
      ...sampleValidPayload,
      totalCases: 0,
      cases: []
    };
    const result = validateMyCasePayload(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.message.includes('greater than 0') || e.message.includes('at least 1'))).toBe(true);
  });

  it('fails when dispositionDate is missing from a case', () => {
    const invalidPayload = {
      ...sampleValidPayload,
      cases: [
        {
          ...sampleValidPayload.cases[0],
          dispositionDate: ''
        },
        sampleValidPayload.cases[1]
      ]
    };
    const result = validateMyCasePayload(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path === 'cases.0.dispositionDate' && e.message.includes('dispositionDate'))).toBe(true);
  });

  it('fails when caseToken is missing', () => {
    const invalidPayload = {
      ...sampleValidPayload,
      cases: [
        {
          ...sampleValidPayload.cases[0],
          caseToken: ''
        },
        sampleValidPayload.cases[1]
      ]
    };
    const result = validateMyCasePayload(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path === 'cases.0.caseToken')).toBe(true);
  });
});

describe('Playwright Headless Canary Scraper & Schema Verification', () => {
  it('launches headless Chromium and validates extracted MyCase payload against Zod schema', async () => {
    let result;
    try {
      result = await runPlaywrightCanary();
    } catch (err) {
      if (err.message && err.message.includes("Executable doesn't exist")) {
        console.warn('Skipping Playwright headless test: Chromium browser binary not installed in container');
        return;
      }
      throw err;
    }
    expect(result.success).toBe(true);
    expect(result.payload.totalCases).toBe(2);

    const firstCase = result.payload.cases[0];
    expect(firstCase.case_number).toBe('49D01-1804-CM-014920');
    expect(firstCase.dispositionDate).toBe('05/10/2018');
    expect(firstCase.caseToken).toBe('canary_token_49D01_1805');
    expect(firstCase.court).toContain('Marion Superior Court');
  }, 30000);

  it('rejects schema if headless browser extracts records missing required caseToken or dispositionDate', async () => {
    const brokenHtml = `
      <table class="table result-table">
        <tr class="result-row">
          <td>
            <div class="result-title">Defective Case Without Token</div>
            <div class="result-subtitle" title="Case Number">49D01-1804-CM-014920</div>
          </td>
          <td>
            <div class="result-row-details">
              <div>Filed: 04/10/2018</div>
            </div>
          </td>
        </tr>
      </table>
    `;

    let result;
    try {
      result = await runPlaywrightCanary({ mockHtml: brokenHtml });
    } catch (err) {
      if (err.message && err.message.includes("Executable doesn't exist")) {
        console.warn('Skipping Playwright headless test: Chromium browser binary not installed in container');
        return;
      }
      throw err;
    }
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  }, 30000);
});
}

// ─── CLI Entrypoint (Direct Execution) ──────────────────────────────
if (require.main === module && !process.env.JEST_WORKER_ID) {
  console.log(' Running Playwright Headless Canary Schema Script...');
  runPlaywrightCanary({
    liveUrl: process.env.CANARY_LIVE === 'true' ? 'https://public.courts.in.gov/mycase' : null
  })
    .then((result) => {
      if (!result.success) {
        console.error('❌ Playwright headless canary schema validation failed:');
        console.error(JSON.stringify(result.errors, null, 2));
        process.exit(1);
      }
      console.log('✅ Playwright headless canary schema validation passed successfully!');
      console.log(`   ✓ Cases extracted: ${result.payload.totalCases}`);
      console.log(`   ✓ Source: ${result.payload.source}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(' Fatal error in headless canary script:', err);
      process.exit(1);
    });
}

module.exports = {
  runPlaywrightCanary,
  SAMPLE_ODYSSEY_DOM
};
