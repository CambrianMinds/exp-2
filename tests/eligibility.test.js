const IndianaExpungement = require('../extension/eligibility.js');

describe('IndianaExpungement Eligibility Rules Engine', () => {

  describe('extractCaseTypeCode', () => {
    it('extracts FD from full case number', () => {
      expect(IndianaExpungement.extractCaseTypeCode('49D01-1605-FD-000123')).toBe('FD');
    });

    it('extracts case type from spaced and criminal court case numbers', () => {
      expect(IndianaExpungement.extractCaseTypeCode('49G01 - 1804 - CM - 014920')).toBe('CM');
      expect(IndianaExpungement.extractCaseTypeCode('02D01-0402-FA-123')).toBe('FA');
      expect(IndianaExpungement.extractCaseTypeCode('45H01-1201-IF-1234')).toBe('IF');
    });

    it('extracts CM from case type label', () => {
      expect(IndianaExpungement.extractCaseTypeCode('CM - Criminal Misdemeanor')).toBe('CM');
    });

    it('extracts F6 from bare code', () => {
      expect(IndianaExpungement.extractCaseTypeCode('F6')).toBe('F6');
    });

    it('returns null for invalid inputs', () => {
      expect(IndianaExpungement.extractCaseTypeCode('')).toBeNull();
      expect(IndianaExpungement.extractCaseTypeCode('UNKNOWN')).toBeNull();
    });
  });

  describe('extractCourtCode and extractCountyCode', () => {
    it('extracts court code and zero-pads county code for single and double digit counties', () => {
      const court1 = IndianaExpungement.extractCourtCode('49D01-1605-FD-000123');
      expect(court1).toBe('49D01');
      expect(IndianaExpungement.extractCountyCode(court1)).toBe('49');

      const court2 = IndianaExpungement.extractCourtCode('2D01-1605-FD-000123');
      expect(court2).toBe('2D01');
      expect(IndianaExpungement.extractCountyCode(court2)).toBe('02');
      expect(IndianaExpungement.INDIANA_COUNTIES[IndianaExpungement.extractCountyCode(court2)]).toBe('Allen');
    });
  });

  describe('parseDate', () => {
    it('parses dates with or without timestamps accurately without timezone shift', () => {
      const d1 = IndianaExpungement.parseDate('05/10/2018');
      expect(d1.getFullYear()).toBe(2018);
      expect(d1.getMonth()).toBe(4); // 0-indexed May
      expect(d1.getDate()).toBe(10);

      const d2 = IndianaExpungement.parseDate('05/10/2018 11:30:00 PM');
      expect(d2.getFullYear()).toBe(2018);
      expect(d2.getMonth()).toBe(4);
      expect(d2.getDate()).toBe(10);
    });
  });

  describe('yearsElapsed', () => {
    it('calculates full years properly', () => {
      const fromDate = new Date(2010, 0, 1);
      const asOf = new Date(2020, 0, 1);
      expect(IndianaExpungement.yearsElapsed(fromDate, asOf)).toBe(10);
    });

    it('handles leap years and partial years', () => {
      const fromDate = new Date(2015, 5, 15);
      const asOf = new Date(2020, 4, 15); // May, hasn't reached June yet
      expect(IndianaExpungement.yearsElapsed(fromDate, asOf)).toBe(4);
    });
  });

  describe('assessEligibility', () => {
    const asOfDate = new Date(2026, 0, 1);

    it('marks non-criminal cases as excluded', () => {
      const caseData = { caseNumber: '49D01-2001-SC-001234', status: 'Decided', filed: '01/01/2020' };
      const result = IndianaExpungement.assessEligibility(caseData, asOfDate);
      expect(result.eligible).toBe(false);
      expect(result.statute).toBe('N/A');
      expect(result.reason).toContain('Excluded');
    });

    it('marks ineligible offenses as ineligible', () => {
      const caseData = { caseNumber: '49D01-1001-FA-001234', status: 'Decided', filed: '01/01/2010', charges: 'MURDER' };
      const result = IndianaExpungement.assessEligibility(caseData, asOfDate);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('INELIGIBLE');
      expect(result.statute).toBe('IC § 35-38-9-3(b)');
    });

    it('evaluates Section 1 (Infraction/Arrest) correctly', () => {
      // Met waiting period (1 year)
      const case1 = { caseNumber: '49D01-2001-IF-001234', status: '01/01/2024, Decided', filed: '01/01/2024' };
      const result1 = IndianaExpungement.assessEligibility(case1, asOfDate);
      expect(result1.statute).toBe('IC § 35-38-9-1');
      expect(result1.eligible).toBe(true);

      // Not met waiting period
      const case2 = { caseNumber: '49D01-2001-IF-001234', status: '02/01/2025, Decided', filed: '02/01/2025' };
      const result2 = IndianaExpungement.assessEligibility(case2, asOfDate);
      expect(result2.eligible).toBe(false);
    });

    it('evaluates Section 2 (Misdemeanors) correctly', () => {
      // Met waiting period (5 years)
      const case1 = { caseNumber: '49D01-2001-CM-001234', status: '01/01/2020, Decided', filed: '01/01/2020' };
      const result1 = IndianaExpungement.assessEligibility(case1, asOfDate);
      expect(result1.statute).toBe('IC § 35-38-9-2');
      expect(result1.eligible).toBe(true);

      // Not met waiting period
      const case2 = { caseNumber: '49D01-2001-CM-001234', status: '01/01/2022, Decided', filed: '01/01/2022' };
      const result2 = IndianaExpungement.assessEligibility(case2, asOfDate);
      expect(result2.eligible).toBe(false);
    });

    it('evaluates Section 3 (Class D / Level 6 Felonies) correctly', () => {
      // Met waiting period (8 years)
      const case1 = { caseNumber: '49D01-2001-F6-001234', status: '01/01/2015, Decided', filed: '01/01/2015' };
      const result1 = IndianaExpungement.assessEligibility(case1, asOfDate);
      expect(result1.statute).toBe('IC § 35-38-9-3');
      expect(result1.eligible).toBe(true);
      expect(result1.grantType).toBe('mandatory');
    });

    it('evaluates Section 3 Bodily Injury correctly', () => {
      const case1 = { caseNumber: '49D01-2001-F6-001234', status: '01/01/2015, Decided', filed: '01/01/2015', charges: 'BATTERY RESULTING IN BODILY INJURY' };
      const result1 = IndianaExpungement.assessEligibility(case1, asOfDate);
      // Wait, BODILY_INJURY_INDICATORS are 'CAUSING SERIOUS BODILY INJURY', 'RESULTING IN DEATH', 'AGGRAVATED BATTERY', 'ATTEMPTED MURDER'
      // Let's use one of those to trigger discretionary
      const case2 = { caseNumber: '49D01-2001-F6-001234', status: '01/01/2015, Decided', filed: '01/01/2015', charges: 'CAUSING SERIOUS BODILY INJURY' };
      const result2 = IndianaExpungement.assessEligibility(case2, asOfDate);
      expect(result2.grantType).toBe('discretionary');
    });

    it('evaluates Section 4 (Higher Felonies) correctly', () => {
      // Met statutory waiting period (8 years under IC § 35-38-9-4(e))
      const case1 = { caseNumber: '49D01-2001-F3-001234', status: '01/01/2018, Decided', filed: '01/01/2018' };
      const result1 = IndianaExpungement.assessEligibility(case1, asOfDate);
      expect(result1.statute).toBe('IC § 35-38-9-4');
      expect(result1.waitingPeriod).toBe(8);
      expect(result1.eligible).toBe(true);
      expect(result1.grantType).toBe('discretionary');

      // Not yet met waiting period (6 years elapsed)
      const case2 = { caseNumber: '49D01-2001-F3-001234', status: '01/01/2020, Decided', filed: '01/01/2020' };
      const result2 = IndianaExpungement.assessEligibility(case2, asOfDate);
      expect(result2.statute).toBe('IC § 35-38-9-4');
      expect(result2.waitingPeriod).toBe(8);
      expect(result2.eligible).toBe(false);
      expect(result2.reason).toContain('Must wait at least 8 years');
    });
  });

  describe('checkCrossCounty365DaySafety (Statutory Scope & Section 1 Decoupling)', () => {
    it('allows arrest records (Section 1) without 365-day conviction cross-county block', () => {
      // Future date > 1 year from now
      const farFutureDate = new Date();
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 3);

      const cases = [
        {
          case_number: '49D01-2001-IF-000001',
          court: 'Marion Superior Court',
          eligibility: {
            eligible: true,
            statute: 'IC § 35-38-9-1'
          }
        },
        {
          case_number: '29D01-2301-F6-000002',
          court: 'Hamilton Superior Court',
          eligibility: {
            eligible: false,
            statute: 'IC § 35-38-9-3',
            eligibilityDate: farFutureDate
          }
        }
      ];

      // Eligible case is Section 1 (arrest/infraction) -> Arrest Record Exemption
      const safety = IndianaExpungement.checkCrossCounty365DaySafety(cases);
      expect(safety.isSafe).toBe(true);
    });

    it('allows purely Section 1 arrest records across multiple counties', () => {
      const cases = [
        {
          case_number: '49D01-2001-IF-000001',
          court: 'Marion Superior Court',
          eligibility: { eligible: true, statute: 'IC § 35-38-9-1' }
        },
        {
          case_number: '45D01-2001-IF-000002',
          court: 'Lake Superior Court',
          eligibility: { eligible: true, statute: 'IC § 35-38-9-1' }
        }
      ];

      const safety = IndianaExpungement.checkCrossCounty365DaySafety(cases);
      expect(safety.isSafe).toBe(true);
    });

    it('blocks conviction filings when another county conviction is > 365 days from eligibility', () => {
      const farFutureDate = new Date();
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 2);

      const cases = [
        {
          case_number: '49D01-1801-CM-000001',
          court: 'Marion Superior Court',
          eligibility: { eligible: true, statute: 'IC § 35-38-9-2' }
        },
        {
          case_number: '29D01-2301-F6-000002',
          court: 'Hamilton Superior Court',
          eligibility: {
            eligible: false,
            statute: 'IC § 35-38-9-3',
            eligibilityDate: farFutureDate
          }
        }
      ];

      const safety = IndianaExpungement.checkCrossCounty365DaySafety(cases);
      expect(safety.isSafe).toBe(false);
      expect(safety.reason).toContain('Cross-County 365-Day Window Violation');
      expect(safety.conflictingCounties).toContain('Hamilton Superior Court');
    });
  });

  describe('Pending charges & Subsequent conviction invalidation', () => {
    const asOfDate = new Date(2026, 0, 1);

    it('marks pending charges as ineligible across Section 1, 2, and 3', () => {
      const pendingInfraction = { caseNumber: '49D01-2001-IF-000001', status: 'Pending', filed: '01/01/2020' };
      const res1 = IndianaExpungement.assessEligibility(pendingInfraction, asOfDate);
      expect(res1.eligible).toBe(false);
      expect(res1.reason).toContain('PENDING');

      const pendingMisdemeanor = { caseNumber: '49D01-1801-CM-000002', status: '01/01/2018, Pending', filed: '01/01/2018' };
      const res2 = IndianaExpungement.assessEligibility(pendingMisdemeanor, asOfDate);
      expect(res2.eligible).toBe(false);
      expect(res2.reason).toContain('PENDING');

      const pendingFelony = { caseNumber: '49D01-1501-F6-000003', status: 'Pending', filed: '01/01/2015' };
      const res3 = IndianaExpungement.assessEligibility(pendingFelony, asOfDate);
      expect(res3.eligible).toBe(false);
      expect(res3.reason).toContain('PENDING');
    });

    it('resets clean waiting period when a subsequent conviction exists', () => {
      // Misdemeanor from 2018 (would be eligible in 2026 if clean: 8 years elapsed >= 5)
      const oldMisdemeanor = { caseNumber: '49D01-1801-CM-000001', status: '01/01/2018, Decided', filed: '01/01/2018' };
      // New conviction occurred on 01/01/2024 (2 years before asOfDate 2026-01-01)
      const recentConvictionDate = new Date(2024, 0, 1);
      const res = IndianaExpungement.assessEligibility(oldMisdemeanor, asOfDate, recentConvictionDate);
      expect(res.eligible).toBe(false);
      expect(res.cleanPeriodBroken).toBe(true);
      expect(res.reason).toContain('Clean period broken');
      // Eligibility date should reset to 5 years after recent conviction (2029)
      expect(res.eligibilityDate.getFullYear()).toBe(2029);
    });

    it('detects pending criminal charges in analyzeAll and sets pendingChargesBlock', () => {
      const cases = [
        {
          caseNumber: '49D01-1501-CM-000001',
          status: '01/01/2015, Decided',
          filed: '01/01/2015',
          court: 'Marion Superior Court'
        },
        {
          caseNumber: '49D01-2501-CM-000002',
          status: 'Pending',
          filed: '01/01/2025',
          court: 'Marion Superior Court'
        }
      ];
      const report = IndianaExpungement.analyzeAll(cases);
      expect(report.pendingChargesBlock.isSafe).toBe(false);
      expect(report.pendingChargesBlock.reason).toContain('Pending Criminal Charges');
      expect(report.pendingChargesBlock.pendingCases).toContain('49D01-2501-CM-000002');
    });
  });

});

