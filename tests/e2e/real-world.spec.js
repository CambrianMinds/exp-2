const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.describe('Real-World Expungement Scenarios', () => {

  // Helper to accept disclaimers and gate
  async function acceptGate(page) {
    const gateCheck = page.locator('#gateAckCheck');
    if (await gateCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gateCheck.check();
      await page.click('#btnAcceptGate');
      await expect(page.locator('#disclaimerGate')).toBeHidden();
    }
  }

  // Helper to inject scan results
  async function injectScanResults(page, casesPayload, reportSummary, reportCounties) {
    await page.addInitScript(({ casesPayload, reportSummary, reportCounties }) => {
      localStorage.setItem('lastScanResults', JSON.stringify({
        cases: casesPayload,
        report: {
          summary: reportSummary,
          counties: reportCounties
        }
      }));
    }, { casesPayload, reportSummary, reportCounties });
  }

  // Helper to fill profile
  async function fillProfile(page) {
    await page.click('button[data-tab="profile"]');
    await expect(page.locator('#tab-profile')).toHaveClass(/active/);
    await page.fill('#fullName', 'Real World Test');
    await page.fill('#dob', '1985-06-15');
    await page.fill('#ssn', '999-99-9999');
    await page.fill('#streetAddress', '555 Test Ln');
    await page.fill('#city', 'Indianapolis');
    await page.fill('#zipCode', '46204');
    await page.click('button[type="submit"]');
  }

  // Helper to generate and validate PDF
  async function generateAndValidatePDF(page, expectedSize = 1000) {
    await page.click('button[data-tab="generate"]');
    await expect(page.locator('#tab-generate')).toHaveClass(/active/);

    await page.evaluate(() => {
      document.getElementById('ackOneShot').checked = true;
      document.getElementById('ackAllCounties').checked = true;
      document.getElementById('ackNotLawyer').checked = true;
      document.getElementById('ackProSe').checked = true;
      document.getElementById('ackProSe').dispatchEvent(new Event('change', { bubbles: true }));
    });

    const generateBtn = page.locator('#btnGenerate');
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    const confirmBtn = page.locator('#btnModalConfirm');
    await expect(confirmBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      confirmBtn.click()
    ]);

    const downloadPath = await download.path();
    const pdfBuffer = fs.readFileSync(downloadPath);
    expect(pdfBuffer.length).toBeGreaterThan(expectedSize);
  }

  test('Standard Misdemeanor Expungement (Section 8)', async ({ page }) => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 6);
    const dateStr = pastDate.toLocaleDateString('en-US');

    await injectScanResults(page, 
      [
        { caseNumber: '49D01-1801-CM-000001', county: 'Marion', type: 'CM', charges: 'Public Intoxication', status: `${dateStr}, Disposed - Conviction`, eligible: true, eligibilityRule: 'Sec8' }
      ],
      { eligible: 1, pending: 0, ineligible: 0 },
      { '49': { cases: [{ eligibility: { eligible: true, rule: 'Sec8' }, case_number: '49D01-1801-CM-000001', court: 'Marion Superior' }] } }
    );

    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');
    await acceptGate(page);

    await page.click('button[data-tab="results"]');
    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('.case-card')).toHaveCount(1);
    await expect(page.locator('.case-card')).toContainText('CM');

    await fillProfile(page);
    await generateAndValidatePDF(page);
  });

  test('Level 6 Felony Expungement (Section 9)', async ({ page }) => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 9);
    const dateStr = pastDate.toLocaleDateString('en-US');

    await injectScanResults(page, 
      [
        { caseNumber: '29D01-1501-F6-000002', county: 'Hamilton', type: 'F6', charges: 'Theft', status: `${dateStr}, Disposed - Conviction`, eligible: true, eligibilityRule: 'Sec9' }
      ],
      { eligible: 1, pending: 0, ineligible: 0 },
      { '29': { cases: [{ eligibility: { eligible: true, rule: 'Sec9' }, case_number: '29D01-1501-F6-000002', court: 'Hamilton Superior' }] } }
    );

    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');
    await acceptGate(page);

    await page.click('button[data-tab="results"]');
    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('.case-card')).toHaveCount(1);
    await expect(page.locator('.case-card')).toContainText('F6');

    await fillProfile(page);
    await generateAndValidatePDF(page);
  });

  test('Multi-County Expungement Coordination', async ({ page }) => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 6);
    const dateStr = pastDate.toLocaleDateString('en-US');

    await injectScanResults(page, 
      [
        { caseNumber: '49D01-1801-CM-000001', county: 'Marion', type: 'CM', charges: 'Charge A', status: `${dateStr}, Disposed - Conviction`, eligible: true },
        { caseNumber: '29D01-1802-CM-000002', county: 'Hamilton', type: 'CM', charges: 'Charge B', status: `${dateStr}, Disposed - Conviction`, eligible: true }
      ],
      { eligible: 2, pending: 0, ineligible: 0 },
      { 
        '49': { cases: [{ eligibility: { eligible: true }, case_number: '49D01-1801-CM-000001', court: 'Marion Superior' }] },
        '29': { cases: [{ eligibility: { eligible: true }, case_number: '29D01-1802-CM-000002', court: 'Hamilton Superior' }] }
      }
    );

    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');
    await acceptGate(page);

    await page.click('button[data-tab="results"]');
    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('body')).toContainText('Marion');
    await expect(page.locator('body')).toContainText('Hamilton');

    await fillProfile(page);
    
    await page.click('button[data-tab="generate"]');
    await expect(page.locator('#tab-generate')).toHaveClass(/active/);
    
    await page.evaluate(() => {
      document.getElementById('ackOneShot').checked = true;
      document.getElementById('ackAllCounties').checked = true;
      document.getElementById('ackNotLawyer').checked = true;
      document.getElementById('ackProSe').checked = true;
      document.getElementById('ackProSe').dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.click('#btnGenerate');
    const confirmBtn = page.locator('#btnModalConfirm');
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      confirmBtn.click()
    ]);
    
    const downloadPath = await download.path();
    const buffer = fs.readFileSync(downloadPath);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('Ineligibility - Pending Charges', async ({ page }) => {
    await injectScanResults(page, 
      [
        { caseNumber: '49D01-2401-CM-999999', county: 'Marion', type: 'CM', charges: 'Pending Charge', status: 'Pending', eligible: false, eligibilityRule: 'Pending' }
      ],
      { eligible: 0, pending: 1, ineligible: 0 },
      { '49': { cases: [{ eligibility: { eligible: false, rule: 'Pending' }, case_number: '49D01-2401-CM-999999' }] } }
    );

    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');
    await acceptGate(page);

    await page.click('button[data-tab="results"]');
    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('.case-card')).toContainText('NOT ELIGIBLE', { ignoreCase: true });

    await fillProfile(page);
    
    await page.click('button[data-tab="generate"]');
    
    const generateBtn = page.locator('#btnGenerate');
    await expect(generateBtn).toBeDisabled();
    
    const ineligibleMessage = page.locator('text=/pending/i');
    if (await ineligibleMessage.count() > 0) {
      await expect(ineligibleMessage.first()).toBeVisible();
    }
  });

  test('Aesthetics and Accessibility Validation', async ({ page }) => {
    await page.goto('/docs/index.html');
    await page.waitForLoadState('networkidle');

    await page.emulateMedia({ colorScheme: 'dark' });
    
    // Check for bento grid which we recently implemented on the landing page
    await expect(page.locator('.hero-tier-grid')).toBeVisible();

    const card = page.locator('.hero-tier-card').first();
    await card.hover();
    
    const hasMouseVars = await card.evaluate((el) => {
      return el.style.getPropertyValue('--mouse-x') !== '';
    });
    
    expect(hasMouseVars).toBe(true);
  });
});
