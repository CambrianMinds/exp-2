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
  waitingPeriod: z.number().nonnegative().nullable().optional(),
  waitingPeriodMet: z.boolean(),
  eligibilityDate: z.date().nullable().optional(),
  reason: z.string(),
  warnings: z.array(z.string()),
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
});
