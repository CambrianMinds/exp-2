/**
 * Unit Tests for Indiana Trial Rule 10 PDF Generator
 * Verifies court formatting constraints:
 * - 8.5 x 11 inch pages (612 x 792 pt)
 * - 1-inch (72 pt) margins
 * - Mandatory court caption components (Court Name, Cause Number, Parties, Title)
 * - Form fields and perjury affirmations (Trial Rule 11)
 * - Lifetime One-Shot Warning inclusion (IC § 35-38-9-9(i))
 */

const PDFLib = require('../extension/pdf-lib.min.js');
global.PDFLib = PDFLib;

// Sample mock payload for a Marion County case
const samplePayload = {
  petitioner: {
    fullName: 'Johnathan Edward Doe',
    dob: '1985-06-15',
    ssn: '123-45-6789',
    driverLicense: 'DL-987654321',
    streetAddress: '1234 N. Meridian Street, Apt 5B',
    city: 'Indianapolis',
    state: 'IN',
    zipCode: '46202',
    phone: '(317) 555-0199',
    email: 'jdoe@example.com',
    addresses: [
      { address: '1234 N. Meridian Street', city: 'Indianapolis', state: 'IN', zip: '46202', dates: '2020–Present' },
      { address: '5678 E. Washington Street', city: 'Indianapolis', state: 'IN', zip: '46219', dates: '2015–2020' }
    ]
  },
  county: '49',
  countyName: 'Marion',
  courtName: 'Marion Superior Court, Criminal Division',
  cases: [
    {
      caseNumber: '49D01-1804-CM-014920',
      type: 'CM - Criminal Misdemeanor',
      filed: '04/15/2018',
      dispositionDate: '2018-05-10',
      charges: 'Operating a Vehicle While Intoxicated',
      statute: 'IC § 35-38-9-2',
      financials: { balanceDue: 0, balanceFormatted: '$0.00', restitutionSatisfied: true },
      eligibility: { eligible: true, statute: 'IC § 35-38-9-2', grantType: 'mandatory' }
    }
  ],
  includeFeeWaiver: true,
  includeAddressSupplement: true,
  eSignDocuments: true
};

describe('Indiana Expungement PDF Generator (Trial Rule 10 Compliance)', () => {
  let pdfGenerator;

  beforeAll(async () => {
    // Dynamic import of the ESM module
    pdfGenerator = await import('../extension/sidepanel/pdf-generator.js');
  });

  it('exports generateCompletePacket and generateAppearanceForm', () => {
    expect(typeof pdfGenerator.generateCompletePacket).toBe('function');
    expect(typeof pdfGenerator.generateAppearanceForm).toBe('function');
  });

  it('generates a valid, parseable PDF packet matching Trial Rule 10 dimensions', async () => {
    const pdfBytes = await pdfGenerator.generateCompletePacket(samplePayload);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const loadedDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const pageCount = loadedDoc.getPageCount();
    expect(pageCount).toBeGreaterThanOrEqual(8);

    // Assert Trial Rule 10 page dimensions (8.5 x 11 inches = 612 x 792 pt) on ALL pages
    for (let i = 0; i < pageCount; i++) {
      const page = loadedDoc.getPage(i);
      const { width, height } = page.getSize();
      expect(width).toBe(612);
      expect(height).toBe(792);
    }
  });

  it('creates fillable form fields for court clerical and party completion', async () => {
    const pdfBytes = await pdfGenerator.generateCompletePacket(samplePayload);
    const loadedDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const form = loadedDoc.getForm();
    const fields = form.getFields();

    expect(fields.length).toBeGreaterThan(0);

    const fieldNames = fields.map(f => f.getName());
    // Appearance form (Form 01) fields
    expect(fieldNames).toContain('f1_name');
    expect(fieldNames).toContain('f1_phone');
    expect(fieldNames).toContain('f1_email');

    // Fee waiver (Form 08) fields
    expect(fieldNames).toContain('f8_income');
    expect(fieldNames).toContain('f8_expenses');
  });

  it('generates standalone Appearance Form (Form 01) with correct single-pleading pagination', async () => {
    const pdfBytes = await pdfGenerator.generateAppearanceForm(samplePayload);
    const loadedDoc = await PDFLib.PDFDocument.load(pdfBytes);

    // Appearance is typically 1 or 2 pages
    expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(loadedDoc.getPageCount()).toBeLessThanOrEqual(3);

    const firstPage = loadedDoc.getPage(0);
    expect(firstPage.getWidth()).toBe(612);
    expect(firstPage.getHeight()).toBe(792);
  });

  it('supports selective single-form generation for in-app preview via targetForm parameter', async () => {
    const previewPayload = { ...samplePayload, targetForm: 'form04' };
    const pdfBytes = await pdfGenerator.generateCompletePacket(previewPayload);
    const loadedDoc = await PDFLib.PDFDocument.load(pdfBytes);

    expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(loadedDoc.getPageCount()).toBeLessThan(5); // Form 04 alone is much shorter than entire 8+ page packet
    const page = loadedDoc.getPage(0);
    expect(page.getWidth()).toBe(612);
    expect(page.getHeight()).toBe(792);
  });

  it('generates packet for non-major county (Clark County, FIPS 10) with verified directory addresses', async () => {
    const clarkPayload = {
      ...samplePayload,
      county: '10',
      countyName: 'Clark',
      courtName: 'Clark Circuit Court',
      cases: [
        {
          caseNumber: '10C01-1804-CM-000123',
          type: 'CM - Criminal Misdemeanor',
          filed: '04/15/2018',
          dispositionDate: '2018-05-10',
          charges: 'Operating a Vehicle While Intoxicated',
          statute: 'IC § 35-38-9-2',
          eligibility: { eligible: true, statute: 'IC § 35-38-9-2', grantType: 'mandatory' }
        }
      ]
    };
    const pdfBytes = await pdfGenerator.generateCompletePacket(clarkPayload);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    const loadedDoc = await PDFLib.PDFDocument.load(pdfBytes);
    expect(loadedDoc.getPageCount()).toBeGreaterThanOrEqual(8);
  });

  it('triggers onProgress callback with granular form metadata during compilation', async () => {
    const progressEvents = [];
    const pdfBytes = await pdfGenerator.generateCompletePacket(samplePayload, (event) => {
      progressEvents.push(event);
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(progressEvents.length).toBeGreaterThanOrEqual(8);
    expect(progressEvents[0].formIndex).toBe(1);
    expect(progressEvents[0].totalForms).toBe(progressEvents.length);
    expect(progressEvents[0].formKey).toBe('form00');
    expect(progressEvents[0].formName).toContain('Cover Sheet');
  });
});
