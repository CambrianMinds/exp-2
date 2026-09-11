const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Indiana Expungement Assistant E2E', () => {
  test('should load the app and require disclaimers before generating PDF', async ({ page }) => {
    // Inject mock cases into localStorage before the page loads
    await page.addInitScript(() => {
      localStorage.setItem('lastScanResults', JSON.stringify({
        cases: [
          { caseNumber: '49D01-2001-CM-001234', county: 'Marion', type: 'CM', charges: 'Theft', eligible: true }
        ],
        report: {
          summary: { eligible: 1 },
          counties: { '49': { cases: [{ eligibility: { eligible: true } }] } }
        }
      }));
    });

    // Navigate to local HTML file via web server
    await page.goto('/docs/app/app.html');
    // Wait for JS modules to load and attach event listeners
    await page.waitForLoadState('networkidle');

    // Accept the pro se disclaimer gate if visible
    const gateCheck = page.locator('#gateAckCheck');
    if (await gateCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gateCheck.check();
      await page.click('#btnAcceptGate');
      await expect(page.locator('#disclaimerGate')).toBeHidden();
    }

    // Click the Generate tab
    await page.click('button[data-tab="generate"]');
    await expect(page.locator('#tab-generate')).toHaveClass(/active/);

    // Find the Generate button
    const generateBtn = page.locator('#btnGenerate');
    
    // Ensure button is disabled initially
    await expect(generateBtn).toBeDisabled();

    // To actually generate, we need to fill the required fields in the profile tab
    await page.click('button[data-tab="profile"]');
    await expect(page.locator('#tab-profile')).toHaveClass(/active/);
    await page.fill('#fullName', 'John Doe');
    await page.fill('#dob', '1990-01-01');
    await page.fill('#ssn', '123-45-6789');
    await page.fill('#streetAddress', '123 Main St');
    await page.fill('#city', 'Indianapolis');
    await page.fill('#zipCode', '46204');
    
    // Save the profile to update AppState
    await page.click('button[type="submit"]');

    // Go back to the Generate tab
    await page.click('button[data-tab="generate"]');
    await expect(page.locator('#tab-generate')).toHaveClass(/active/);

    // Check all disclaimers (use force in case they are visually hidden by custom CSS styling)
    await page.check('#ackOneShot', { force: true });
    await page.check('#ackAllCounties', { force: true });
    await page.check('#ackNotLawyer', { force: true });
    await page.check('#ackProSe', { force: true });

    // Generate button should now be enabled
    await expect(generateBtn).toBeEnabled();
    
    // Click generate which opens the confirmation modal
    await generateBtn.click();
    
    // Wait for the modal to appear and click confirm
    const confirmBtn = page.locator('#btnModalConfirm');
    await expect(confirmBtn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      confirmBtn.click()
    ]);

    // Validate the PDF
    const downloadPath = await download.path();
    const pdfBuffer = fs.readFileSync(downloadPath);
    
    // Ensure the PDF is not empty
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });

  test('should support Choose File(s) upload and populate cases', async ({ page }) => {
    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');

    // Accept disclaimer gate if shown
    const gateCheck = page.locator('#gateAckCheck');
    if (await gateCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gateCheck.check();
      await page.click('#btnAcceptGate');
      await expect(page.locator('#disclaimerGate')).toBeHidden();
    }

    // Set file via input triggered by Choose File(s)
    const mockCasePayload = JSON.stringify({
      cases: [
        {
          case_number: '49D01-1804-CM-014920',
          title: 'State of Indiana v. John Doe',
          court: 'Marion Superior Court',
          case_type: 'CM - Criminal Misdemeanor',
          filed: '04/15/2018',
          status: '05/10/2018, Disposed - Conviction',
          charges: 'Operating a Vehicle While Intoxicated'
        }
      ]
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#btnSelectFiles');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: 'test-cases.json',
        mimeType: 'application/json',
        buffer: Buffer.from(mockCasePayload)
      }
    ]);

    // Parity modal should open with the parsed case
    const parityModal = page.locator('#parityModal');
    await expect(parityModal).toBeVisible();
    await expect(page.locator('#parityCaseCount')).toHaveText('1');

    // Confirm parity to proceed to Results tab
    await page.click('#btnParityConfirm');
    await expect(parityModal).toBeHidden();

    // Should transition to Results tab showing the case
    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('#resultsContent')).toBeVisible();
    await expect(page.locator('.case-number')).toContainText('49D01-1804-CM-014920');
  });

  test('should support drag and drop upload onto #dropZone', async ({ page }) => {
    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');

    // Accept disclaimer gate if shown
    const gateCheck = page.locator('#gateAckCheck');
    if (await gateCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gateCheck.check();
      await page.click('#btnAcceptGate');
      await expect(page.locator('#disclaimerGate')).toBeHidden();
    }

    const dropZone = page.locator('#dropZone');
    await expect(dropZone).toBeVisible();

    const mockCasePayload = JSON.stringify([
      {
        case_number: '29D03-1509-F6-007812',
        title: 'State of Indiana v. Jane Smith',
        court: 'Hamilton Superior Court 3',
        case_type: 'F6 - Level 6 Felony',
        filed: '09/01/2015',
        status: '11/20/2015, Disposed - Conviction',
        charges: 'Theft'
      }
    ]);

    // Simulate drag and drop using DataTransfer
    await dropZone.dispatchEvent('dragenter', { dataTransfer: {} });
    await expect(dropZone).toHaveClass(/drag-active/);

    await dropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [
          new File([mockCasePayload], 'dropped-cases.json', { type: 'application/json' })
        ]
      }
    });

    // Parity modal should appear with 1 case
    const parityModal = page.locator('#parityModal');
    await expect(parityModal).toBeVisible();
    await expect(page.locator('#parityCaseCount')).toHaveText('1');

    // Confirm and verify results
    await page.click('#btnParityConfirm');
    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('.case-number')).toContainText('29D03-1509-F6-007812');
  });

  test('should load demo cases when Load Demo Cases is clicked', async ({ page }) => {
    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');

    // Accept disclaimer gate if shown
    const gateCheck = page.locator('#gateAckCheck');
    if (await gateCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gateCheck.check();
      await page.click('#btnAcceptGate');
    }

    await page.click('#btnLoadDemo');

    // Parity modal should open with 4 demo cases
    const parityModal = page.locator('#parityModal');
    await expect(parityModal).toBeVisible();
    await expect(page.locator('#parityCaseCount')).toHaveText('4');

    await page.click('#btnParityConfirm');
    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('.case-card')).toHaveCount(4);
  });

  test('should toggle paste drawer and import pasted JSON', async ({ page }) => {
    await page.goto('/docs/app/app.html');
    await page.waitForLoadState('networkidle');

    // Accept disclaimer gate if shown
    const gateCheck = page.locator('#gateAckCheck');
    if (await gateCheck.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gateCheck.check();
      await page.click('#btnAcceptGate');
    }

    const pasteContainer = page.locator('#pasteContainer');
    await expect(pasteContainer).toBeHidden();

    await page.click('#btnPasteToggle');
    await expect(pasteContainer).toBeVisible();

    const mockCase = JSON.stringify([
      {
        case_number: '49G01-2001-F5-000100',
        case_type: 'F5',
        charges: 'Battery - Dismissed',
        status: '08/20/2021, Disposed - Dismissed'
      }
    ]);

    await page.fill('#pasteInput', mockCase);
    await page.click('#btnProcessPaste');

    const parityModal = page.locator('#parityModal');
    await expect(parityModal).toBeVisible();
    await page.click('#btnParityConfirm');

    await expect(page.locator('#tab-results')).toHaveClass(/active/);
    await expect(page.locator('.case-number')).toContainText('49G01-2001-F5-000100');
  });
});

