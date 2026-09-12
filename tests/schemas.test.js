/**
 * Runtime Data Contract & Schema Verification Tests
 * Uses Zod schemas to ensure external MyCase data structures,
 * normalized internal case models, and statutory eligibility outputs
 * comply strictly with required formats.
 */

const { z } = require('zod');
const {
  CCSSchema,
  CaseRecordSchema
} = require('../scripts/canary/schema.js');
const IndianaExpungement = require('../extension/eligibility.js');

// Schema matching assessEligibility() output
const EligibilityResultSchema = z.object({
  caseNumber: z.string(),
  typeCode: z.string(),
  typeInfo: z.object({
    level: z.string(),
    class: z.string().nullable().optional(),
    severity: z.number()
  }).nullable().optional(),
  dispositionDate: z.date().nullable().optional(),
  yearsElapsed: z.number().nonnegative(),
  isPending: z.boolean(),
  charges: z.string(),
  eligible: z.boolean(),
  statute: z.string().min(1, 'Statutory citation must be non-empty'),
  statuteLabel: z.string().min(1),
  statuteUrl: z.string().url().optional(),
  waitingPeriod: z.number().nonnegative().nullable().optional(),
  waitingPeriodMet: z.boolean(),
  eligibilityDate: z.date().nullable().optional(),
  reason: z.string(),
  warnings: z.array(z.string()),
  validationErrors: z.array(z.string()).optional(),
  dateParseFailed: z.boolean().optional(),
  sentenceCompletedDate: z.date().nullable().optional(),
  sentenceYearsElapsed: z.number().nullable().optional(),
  sentencePeriodMet: z.boolean().optional(),
  filingFee: z.number().nullable().optional(),
  grantType: z.enum(['mandatory', 'discretionary']).nullable().optional(),
  exclusionReason: z.string().optional(),
  mitigationType: z.string().optional(),
  mitigationSteps: z.string().optional()
});

describe('Runtime Schema & Data Contract Validation', () => {

  describe('MyCase Export & CCS Data Schemas', () => {
    it('validates a complete CCS schema with charges, docket entries, and financials', () => {
      const sampleCCS = {
        charges: [
          { count: '01', offense: 'Reckless Driving', level: 'CM', disposition: 'Conviction', dispositionDate: '01/15/2019' }
        ],
        docketEntries: [
          { date: '01/01/2019', description: 'Information Filed', text: 'State files information' }
        ],
        financialSummary: { balanceDue: 0, balanceFormatted: '$0.00' },
        arrestingAgency: 'Indiana State Police',
        dispositionDate: '01/15/2019'
      };

      const result = CCSSchema.safeParse(sampleCCS);
      expect(result.success).toBe(true);
    });

    it('rejects malformed CCS data when required charge fields are missing', () => {
      const invalidCCS = {
        charges: [
          { count: '01', offense: '' } // offense must not be empty
        ],
        docketEntries: [] // must contain at least 1 docket entry
      };

      const result = CCSSchema.safeParse(invalidCCS);
      expect(result.success).toBe(false);
    });

    it('validates a canonical CaseRecordSchema', () => {
      const sampleRecord = {
        case_number: '49D01-1804-CM-014920',
        title: 'State of Indiana v. Marcus Vance',
        court: 'Marion Superior Court, Criminal Division 1',
        case_type: 'CM - Criminal Misdemeanor',
        filed: '04/15/2018',
        status: '05/10/2018, Disposed - Conviction',
        dispositionDate: '05/10/2018',
        charges: 'Operating a Vehicle While Intoxicated',
        caseToken: 'token-49d01-123'
      };

      const result = CaseRecordSchema.safeParse(sampleRecord);
      expect(result.success).toBe(true);
    });
  });

  describe('Eligibility Evaluation Output Schema', () => {
    it('validates statutory evaluation output for a mandatory misdemeanor grant', () => {
      const sampleCase = {
        caseNumber: '49D01-1804-CM-014920',
        case_number: '49D01-1804-CM-014920',
        status: '05/10/2018, Disposed - Conviction',
        dispositionDate: '2018-05-10',
        case_type: 'CM - Criminal Misdemeanor',
        charges: 'Operating a Vehicle While Intoxicated'
      };

      const evalDate = new Date(2026, 8, 7);
      const evalResult = IndianaExpungement.assessEligibility(sampleCase, evalDate);

      const parsed = EligibilityResultSchema.safeParse(evalResult);
      expect(parsed.success).toBe(true);
      expect(evalResult.eligible).toBe(true);
      expect(evalResult.statute).toBe('IC § 35-38-9-2');
      expect(evalResult.grantType).toBe('mandatory');
    });

    it('validates statutory evaluation output for a Section 1 non-conviction dismissal', () => {
      const sampleCase = {
        caseNumber: '49D01-2001-IF-009142',
        case_number: '49D01-2001-IF-009142',
        status: '08/14/2021, Dismissed with Prejudice',
        dispositionDate: '2021-08-14',
        case_type: 'IF - Infraction',
        charges: 'Traffic Infraction'
      };

      const evalDate = new Date(2026, 8, 7);
      const evalResult = IndianaExpungement.assessEligibility(sampleCase, evalDate);

      const parsed = EligibilityResultSchema.safeParse(evalResult);
      expect(parsed.success).toBe(true);
      expect(evalResult.eligible).toBe(true);
      expect(evalResult.statute).toBe('IC § 35-38-9-1');
      expect(evalResult.grantType).toBe('mandatory');
    });

    it('validates statutory evaluation output for an ineligible strictly excluded offense', () => {
      const sampleCase = {
        caseNumber: '49G01-1001-MR-000001',
        case_number: '49G01-1001-MR-000001',
        status: '01/01/2011, Disposed - Conviction',
        dispositionDate: '2011-01-01',
        case_type: 'MR - Murder',
        charges: 'Murder'
      };

      const evalDate = new Date(2026, 8, 7);
      const evalResult = IndianaExpungement.assessEligibility(sampleCase, evalDate);

      const parsed = EligibilityResultSchema.safeParse(evalResult);
      expect(parsed.success).toBe(true);
      expect(evalResult.eligible).toBe(false);
      expect(evalResult.mitigationType).toBe('strictly_excluded');
      expect(evalResult.exclusionReason).toBeDefined();
    });
  });

  describe('Date Parsing Fallback & Resilient Error Recovery', () => {
    it('parses ASP.NET serialized /Date(...)/ timestamps from Odyssey API', () => {
      // 1525924800000 = May 10, 2018 UTC
      const parsed = IndianaExpungement.parseDate('/Date(1525924800000)/');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getTime()).toBe(1525924800000);

      const parsedWithOffset = IndianaExpungement.parseDate('/Date(1525924800000-0500)/');
      expect(parsedWithOffset).toBeInstanceOf(Date);
      expect(parsedWithOffset.getTime()).toBe(1525924800000);
    });

    it('parses epoch millisecond numeric strings', () => {
      const parsed = IndianaExpungement.parseDate('1525924800000');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getTime()).toBe(1525924800000);
    });

    it('parses textual dates with various conventions', () => {
      const d1 = IndianaExpungement.parseDate('May 10, 2018');
      expect(d1).toBeInstanceOf(Date);
      expect(d1.getFullYear()).toBe(2018);
      expect(d1.getMonth()).toBe(4); // May
      expect(d1.getDate()).toBe(10);

      const d2 = IndianaExpungement.parseDate('10-MAY-2018');
      expect(d2).toBeInstanceOf(Date);
      expect(d2.getFullYear()).toBe(2018);
      expect(d2.getMonth()).toBe(4);
      expect(d2.getDate()).toBe(10);
    });

    it('flags unparseable dates with structured error object instead of silent 0-year false negative', () => {
      const corruptedCase = {
        caseNumber: '49D01-1804-CM-014920',
        case_number: '49D01-1804-CM-014920',
        status: 'CORRUPTED_TIMESTAMP_NO_DATE, Disposed - Conviction',
        case_type: 'CM - Criminal Misdemeanor',
        charges: 'Operating a Vehicle While Intoxicated'
      };

      const result = IndianaExpungement.assessEligibility(corruptedCase, new Date(2026, 0, 1));
      expect(result.eligible).toBe(false);
      expect(result.dateParseFailed).toBe(true);
      expect(result.validationErrors).toContain('Missing or unparseable disposition date');
      expect(result.reason).toContain('MANUAL REVIEW REQUIRED');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Pre-Processing Case Validation Layer (validateCaseRecord)', () => {
    it('validates a correct Indiana court record', () => {
      const record = {
        case_number: '49D01-1804-CM-014920',
        case_type: 'CM - Criminal Misdemeanor',
        filed: '04/10/2018',
        status: '05/10/2018, Disposed - Conviction',
        dispositionDate: '2018-05-10'
      };

      const val = IndianaExpungement.validateCaseRecord(record);
      expect(val.isValid).toBe(true);
      expect(val.errors).toHaveLength(0);
      expect(val.normalized.countyCode).toBe('49');
      expect(val.normalized.countyName).toBe('Marion');
      expect(val.normalized.typeCode).toBe('CM');
    });

    it('identifies malformed cause number and unknown county code', () => {
      const record = {
        case_number: 'INVALID-CAUSE-NO',
        case_type: 'CM',
        filed: '04/10/2018'
      };

      const val = IndianaExpungement.validateCaseRecord(record);
      expect(val.isValid).toBe(true); // Still object valid, but warns on format
      expect(val.warnings.some(w => w.includes('Trial Rule 77'))).toBe(true);
    });

    it('flags chronological anomaly when disposition precedes filed date', () => {
      const anomalyRecord = {
        case_number: '49D01-1804-CM-014920',
        case_type: 'CM',
        filed: '05/10/2018',
        dispositionDate: '04/10/2018',
        status: '04/10/2018, Conviction'
      };

      const val = IndianaExpungement.validateCaseRecord(anomalyRecord);
      expect(val.warnings.some(w => w.includes('Chronological anomaly'))).toBe(true);
    });
  });

  describe('IC § 35-38-9-4 Sentence Completion Tracking', () => {
    const asOfDate = new Date(2026, 0, 1);

    it('blocks eligibility if sentence completion occurred less than 3 years ago', () => {
      const caseData = {
        caseNumber: '49D01-1401-F3-000123',
        status: '01/01/2015, Disposed - Conviction',
        filed: '01/01/2014',
        dispositionDate: '2015-01-01', // 11 years elapsed (conviction wait met: 11 >= 8)
        sentenceCompletedDate: '2024-06-01', // Only 1.5 years elapsed (< 3 years)
        case_type: 'F3 - Level 3 Felony',
        charges: 'Robbery'
      };

      const result = IndianaExpungement.assessEligibility(caseData, asOfDate);
      expect(result.statute).toBe('IC § 35-38-9-4');
      expect(result.eligible).toBe(false);
      expect(result.sentencePeriodMet).toBe(false);
      expect(result.reason).toContain('Under IC § 35-38-9-4(c)(2), you must wait at least 3 years after sentence completion');
    });

    it('grants discretionary eligibility when both 8 years from conviction AND 3 years from sentence completion are met', () => {
      const caseData = {
        caseNumber: '49D01-1401-F3-000123',
        status: '01/01/2015, Disposed - Conviction',
        filed: '01/01/2014',
        dispositionDate: '2015-01-01', // 11 years elapsed (>= 8)
        sentenceCompletedDate: '2020-01-01', // 6 years elapsed (>= 3)
        case_type: 'F3 - Level 3 Felony',
        charges: 'Robbery'
      };

      const result = IndianaExpungement.assessEligibility(caseData, asOfDate);
      expect(result.statute).toBe('IC § 35-38-9-4');
      expect(result.eligible).toBe(true);
      expect(result.grantType).toBe('discretionary');
    });

    it('emits statutory advisory warning when sentence completion date is not present on higher felonies', () => {
      const caseData = {
        caseNumber: '49D01-1401-F3-000123',
        status: '01/01/2015, Disposed - Conviction',
        filed: '01/01/2014',
        dispositionDate: '2015-01-01',
        case_type: 'F3 - Level 3 Felony',
        charges: 'Robbery'
      };

      const result = IndianaExpungement.assessEligibility(caseData, asOfDate);
      expect(result.warnings.some(w => w.includes('IC § 35-38-9-4(c)'))).toBe(true);
    });
  });
});
