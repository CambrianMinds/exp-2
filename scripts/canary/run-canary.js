/**
 * Automated Canary Test for Indiana MyCase Bookmarklet Scraper
 * 
 * Runs weekly in GitHub Actions using Playwright to detect breaking changes
 * introduced by Tyler Technologies Odyssey updates on public.courts.in.gov/mycase.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { validateMyCasePayload } = require('./schema.js');
const { parseCCSJson } = require('./parser.js');

const CANARY_ERROR_FILE = path.resolve(__dirname, '../../canary-error.json');

async function runCanary() {
  console.log('🚀 Starting Indiana MyCase Canary Scraper Test...');
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    console.log('🌐 Navigating to https://public.courts.in.gov/mycase/#/vw/Search...');
    await page.goto('https://public.courts.in.gov/mycase/#/vw/Search', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for the Odyssey SPA search tabs to render
    console.log('⏳ Waiting for search interface to initialize...');
    const nameTab = page.locator('#tabByParty, #searchByTabs a:has-text("Name"), a[role="tab"]:has-text("Name")').first();
    await nameTab.waitFor({ state: 'visible', timeout: 25000 });

    console.log('🖱️ Clicking "Name" search tab...');
    await nameTab.click();

    // Look for last name input field and fill search criteria
    const lastInput = page.locator('input[placeholder*="last name" i], input[data-bind*="model.Last" i]').first();
    await lastInput.waitFor({ state: 'visible', timeout: 15000 });

    const searchEntity = 'Smith';
    console.log(`✍️ Filling search criteria for common party name: "${searchEntity}"...`);
    await lastInput.fill(searchEntity);

    const firstInput = page.locator('input[placeholder*="first name" i], input[data-bind*="model.First" i]').first();
    if (await firstInput.isVisible()) {
      await firstInput.fill('John');
    }

    // Locate and click the Search button
    const searchBtn = page.locator('button[type="submit"]:has-text("Search"), button.btn-primary:has-text("Search"), button:has-text("Search")').first();
    await searchBtn.waitFor({ state: 'visible', timeout: 10000 });

    console.log('🔍 Submitting search...');
    await searchBtn.click();

    // Wait for search results: either result rows in DOM or Knockout observable populated
    console.log('⏳ Waiting for search results to load...');
    await page.waitForFunction(() => {
      // Check for rendered result rows
      const hasRows = document.querySelectorAll('tr.result-row').length > 0;
      // Check for Knockout results
      let hasKo = false;
      try {
        const table = document.querySelector('table');
        if (typeof ko !== 'undefined' && table && ko.dataFor) {
          const tableData = ko.dataFor(table);
          if (tableData && tableData.ob && tableData.ob.Results) {
            const res = typeof tableData.ob.Results === 'function' ? tableData.ob.Results() : tableData.ob.Results;
            hasKo = Array.isArray(res) && res.length > 0;
          }
        }
      } catch (err) {
        // Context might not be attached yet
      }
      return hasRows || hasKo;
    }, { timeout: 30000 });

    console.log('✅ Search results detected. Executing bookmarklet extraction logic...');

    // Extract cases using in-page evaluation (matching bookmarklet logic)
    const extractedData = await page.evaluate(async () => {
      function cleanHtml(text) {
        if (!text) return '';
        return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      }

      function cleanCharges(charges) {
        if (!charges) return '';
        let clean = charges.replace(/\*{3}\s*REFERENCE CCS ENTRY\s*\*{3}/gi, '').trim();
        clean = clean.replace(/\s+/g, ' ').trim();
        return clean;
      }

      function mapKnockoutModel(model, index, getValue) {
        const caseNumber = getValue(model.CaseNumber) || '';
        const style = getValue(model.Style) || '';
        const court = getValue(model.Court) || '';
        const caseType = getValue(model.CaseType) || '';
        const caseSubType = getValue(model.CaseSubType) || '';
        const fileDate = getValue(model.FileDate) || '';
        const statusDate = getValue(model.CaseStatusDate) || '';
        const status = getValue(model.CaseStatus) || '';
        const charges = getValue(model.Charges) || '';
        const parties = getValue(model.Parties) || '';
        const attorneys = getValue(model.Attorneys) || '';
        const caseToken = getValue(model.CaseToken) || getValue(model.CaseID) || '';

        const fullCaseType = caseSubType ? `${caseType}, ${caseSubType}` : caseType;
        const fullStatus = statusDate ? `${statusDate}, ${status}` : status;
        const dispMatch = (statusDate || fullStatus).match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
        const dispositionDate = dispMatch ? dispMatch[1] : (statusDate || '');

        return {
          index: index + 1,
          case_number: caseNumber,
          title: cleanHtml(style),
          court: court,
          case_type: fullCaseType,
          filed: fileDate,
          status: fullStatus,
          dispositionDate: dispositionDate,
          charges: cleanCharges(charges),
          parties: parties,
          attorneys: attorneys,
          caseToken: caseToken,
          _source: 'knockout'
        };
      }

      // Strategy 1: Knockout extraction across modern and legacy binding targets
      let cases = null;
      try {
        if (typeof ko !== 'undefined' && ko.dataFor) {
          const getValue = (prop) => (!prop ? '' : typeof prop === 'function' ? prop() : prop);

          // 1A. Table ViewModel
          const table = document.querySelector('table');
          if (table) {
            const tableData = ko.dataFor(table);
            if (tableData && tableData.ob && tableData.ob.Results) {
              const results = typeof tableData.ob.Results === 'function' ? tableData.ob.Results() : tableData.ob.Results;
              if (Array.isArray(results) && results.length > 0) {
                cases = results.map((model, index) => mapKnockoutModel(model, index, getValue));
              }
            }
          }

          // 1B. Row Context Parent ViewModel
          if (!cases || cases.length === 0) {
            const firstRow = document.querySelector('tr.result-row');
            if (firstRow && ko.contextFor) {
              const ctx = ko.contextFor(firstRow);
              if (ctx && ctx.$parent && ctx.$parent.ob && ctx.$parent.ob.Results) {
                const results = typeof ctx.$parent.ob.Results === 'function' ? ctx.$parent.ob.Results() : ctx.$parent.ob.Results;
                if (Array.isArray(results) && results.length > 0) {
                  cases = results.map((model, index) => mapKnockoutModel(model, index, getValue));
                }
              }
            }
          }

          // 1C. Direct Row Data
          if (!cases || cases.length === 0) {
            const rows = document.querySelectorAll('tr.result-row');
            if (rows.length > 0) {
              const directCases = [];
              rows.forEach((r, idx) => {
                const d = ko.dataFor(r);
                if (d && (d.CaseNumber || d.CaseID || d.Style)) {
                  directCases.push(mapKnockoutModel(d, idx, getValue));
                }
              });
              if (directCases.length > 0) cases = directCases;
            }
          }

          // 1D. Legacy OD_BODY
          if (!cases || cases.length === 0) {
            const container = document.getElementById('OD_BODY');
            if (container) {
              const koContext = ko.dataFor(container);
              if (koContext && koContext.ob && koContext.ob.Results) {
                const results = typeof koContext.ob.Results === 'function' ? koContext.ob.Results() : koContext.ob.Results;
                if (Array.isArray(results) && results.length > 0) {
                  cases = results.map((model, index) => mapKnockoutModel(model, index, getValue));
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Knockout extraction failed in evaluate:', e);
      }

      // Strategy 2: DOM scraping fallback
      if (!cases || cases.length === 0) {
        const rows = document.querySelectorAll('tr.result-row');
        cases = [];
        rows.forEach((row, index) => {
          try {
            const titleEl = row.querySelector('.result-title');
            const caseNumEl = row.querySelector('.result-subtitle[title="Case Number"]');
            const detailRows = row.querySelectorAll('.result-row-details .row');

            const caseData = {
              index: index + 1,
              case_number: caseNumEl ? caseNumEl.textContent.trim() : '',
              title: titleEl ? cleanHtml(titleEl.textContent.trim()) : '',
              court: '',
              case_type: '',
              filed: '',
              status: '',
              dispositionDate: '',
              charges: '',
              parties: '',
              attorneys: '',
              caseToken: '',
              _source: 'dom'
            };

            detailRows.forEach(detailRow => {
              const label = detailRow.querySelector('.text-muted');
              const value = detailRow.querySelector('.col-sm-10 .small, .col-xs-11 .small');
              if (!label || !value) return;

              const labelText = label.textContent.trim().toLowerCase();
              const valueText = value.textContent.trim();

              switch (labelText) {
                case 'court': caseData.court = valueText; break;
                case 'case type': caseData.case_type = valueText; break;
                case 'filed': caseData.filed = valueText; break;
                case 'status': caseData.status = valueText; break;
                case 'charges': caseData.charges = cleanCharges(valueText); break;
                case 'parties': caseData.parties = valueText; break;
                case 'attorneys': caseData.attorneys = valueText; break;
              }
            });

            if (caseData.status) {
              const dispMatch = caseData.status.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
              if (dispMatch) caseData.dispositionDate = dispMatch[1];
            }

            if (!caseData.filed) {
              const rightCol = row.querySelector('.result-col-right .small[data-bind*="FileDate"]');
              if (rightCol) caseData.filed = rightCol.textContent.trim();
            }

            if (titleEl) {
              let href = titleEl.getAttribute('href') || '';
              if (!href) {
                const a = titleEl.querySelector('a');
                if (a) href = a.getAttribute('href') || '';
              }
              const hrefMatch = href.match(/CaseToken=([^&]+)/i);
              if (hrefMatch) {
                caseData.caseToken = hrefMatch[1];
              } else {
                const onclick = titleEl.getAttribute('onclick') || '';
                const tokenMatch = onclick.match(/CaseToken[=:][\s'"]*([^'"&]+)/i);
                if (tokenMatch) caseData.caseToken = tokenMatch[1];
              }
            }

            // Bridge caseToken from Knockout row context if DOM link lacks it
            if (!caseData.caseToken && typeof ko !== 'undefined' && ko.dataFor) {
              try {
                const rowKo = ko.dataFor(row);
                if (rowKo) {
                  const getValue = (prop) => (!prop ? '' : typeof prop === 'function' ? prop() : prop);
                  caseData.caseToken = getValue(rowKo.CaseToken) || getValue(rowKo.CaseID) || '';
                }
              } catch (_) {
                /* Row data binding unavailable */
              }
            }

            if (caseData.case_number) {
              cases.push(caseData);
            }
          } catch (rowErr) {
            // Skip unparseable row
          }
        });
      }

      // Fetch CCS for the first case that has a caseToken
      let sampleCCS = null;
      let sampleCaseToken = null;
      if (cases && cases.length > 0) {
        const firstTokenCase = cases.find(c => c.caseToken);
        if (firstTokenCase) {
          sampleCaseToken = firstTokenCase.caseToken;
          try {
            const url = `https://public.courts.in.gov/mycase/Case/CaseSummary?SRCT=&CaseToken=${encodeURIComponent(sampleCaseToken)}&_=${Date.now()}`;
            const response = await fetch(url, {
              method: 'GET',
              credentials: 'same-origin',
              headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });
            if (response.ok) {
              sampleCCS = await response.json();
            }
          } catch (err) {
            console.warn('CCS fetch failed:', err);
          }
        }
      }

      return {
        cases: cases || [],
        sampleCaseToken,
        sampleCCS
      };
    });

    console.log(`📦 Extracted ${extractedData.cases.length} cases from MyCase search.`);

    // If sample CCS was returned, parse and attach it
    if (extractedData.sampleCCS && extractedData.sampleCaseToken) {
      console.log(`📑 Parsing CCS details for sample CaseToken: ${extractedData.sampleCaseToken}...`);
      const parsedCCS = parseCCSJson(extractedData.sampleCCS);
      const targetCase = extractedData.cases.find(c => c.caseToken === extractedData.sampleCaseToken);
      if (targetCase) {
        targetCase.ccs = parsedCCS;
        if (parsedCCS.dispositionDate && !targetCase.dispositionDate) {
          targetCase.dispositionDate = parsedCCS.dispositionDate;
        }
      }
    }

    // Assemble full payload according to bookmarklet export format
    const payload = {
      source: 'Indiana Expungement Assistant Bookmarklet',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      searchContext: searchEntity,
      totalCases: extractedData.cases.length,
      hasCCS: Boolean(extractedData.sampleCCS),
      cases: extractedData.cases
    };

    console.log('🛡️ Validating extracted JSON against Zod schema...');
    const validation = validateMyCasePayload(payload);

    if (!validation.success) {
      const errorMsg = 'Zod schema validation failed for extracted MyCase payload.';
      console.error(`❌ ${errorMsg}`);
      console.error(JSON.stringify(validation.errors, null, 2));

      fs.writeFileSync(CANARY_ERROR_FILE, JSON.stringify({
        timestamp: new Date().toISOString(),
        message: errorMsg,
        errors: validation.errors,
        totalCases: payload.totalCases,
        sampleCase: payload.cases[0] || null
      }, null, 2), 'utf8');

      process.exit(1);
    }

    console.log('✅ Zod schema validation passed successfully!');
    console.log(`   ✓ Total cases verified: ${payload.totalCases}`);
    console.log(`   ✓ Disposition dates present: ${payload.cases.filter(c => c.dispositionDate).length}/${payload.totalCases}`);
    if (payload.cases[0]?.ccs) {
      console.log(`   ✓ Sample CCS Charges: ${payload.cases[0].ccs.charges.length}`);
      console.log(`   ✓ Sample CCS Docket Entries: ${payload.cases[0].ccs.docketEntries.length}`);
    }

    // Clean up any stale error file on success
    if (fs.existsSync(CANARY_ERROR_FILE)) {
      fs.unlinkSync(CANARY_ERROR_FILE);
    }

    process.exit(0);

  } catch (err) {
    console.error('💥 Fatal error during MyCase canary execution:', err);
    fs.writeFileSync(CANARY_ERROR_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      message: err.message,
      stack: err.stack
    }, null, 2), 'utf8');

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runCanary();
