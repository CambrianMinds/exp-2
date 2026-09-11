const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  console.log('Navigating...');
  await page.goto('https://public.courts.in.gov/mycase', { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#tabByParty', { timeout: 15000 });
  console.log('Clicking #tabByParty...');
  await page.click('#tabByParty');
  
  const lastNameInput = page.locator('input[placeholder="last name"]').first();
  await lastNameInput.waitFor({ state: 'visible' });
  console.log('Filling last name with "State of Indiana"...');
  await lastNameInput.fill('State of Indiana');

  console.log('Clicking Search...');
  const searchBtn = page.locator('button[type="submit"]:has-text("Search"), button.btn-primary:has-text("Search")').first();
  await searchBtn.click();

  console.log('Waiting for results...');
  await page.waitForSelector('tr.result-row, table.results', { timeout: 25000 });
  console.log('Results table loaded!');

  const rowCount = await page.locator('tr.result-row').count();
  console.log('Row count:', rowCount);

  const firstRowText = await page.locator('tr.result-row').first().innerText();
  console.log('First row snippet:', firstRowText.slice(0, 300).replace(/\n+/g, ' | '));

  await browser.close();
}

test().catch(console.error);
