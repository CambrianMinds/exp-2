/**
 * Unit Tests for MyCase Scraper Extraction Strategies
 * Tests Knockout.js observable extraction, DOM fallback extraction,
 * and Chronological Case Summary (CCS) JSON parsing.
 */

const Scraper = require('../extension/content.js');

describe('MyCase Scraper Unit Tests', () => {

  describe('Knockout.js Observable Extraction (_tryKnockoutExtraction)', () => {
    let originalDoc;
    let originalKo;
    let originalWindow;

    beforeEach(() => {
      originalDoc = global.document;
      originalKo = global.ko;
      originalWindow = global.window;
    });

    afterEach(() => {
      global.document = originalDoc;
      global.ko = originalKo;
      global.window = originalWindow;
    });

    it('successfully extracts and normalizes cases from Knockout observable model', () => {
      const mockContainer = { id: 'OD_BODY' };

      const mockObservableResults = [
        {
          CaseNumber: () => '49D01-1804-CM-014920',
          Style: () => 'State of Indiana v. <b>John Doe</b>',
          Court: () => 'Marion Superior Court, Criminal Division 1',
          CaseType: () => 'CM - Criminal Misdemeanor',
          CaseSubType: () => '',
          FileDate: () => '04/15/2018',
          CaseStatusDate: () => '05/10/2018',
          CaseStatus: () => 'Disposed - Conviction',
          Charges: () => 'Operating a Vehicle While Intoxicated',
          Parties: () => 'Doe, John (Defendant)',
          Attorneys: () => 'Public Defender',
          CaseToken: () => 'token-49d01-cm-123'
        },
        {
          CaseNumber: '29D03-1509-F6-007812', // static string property (non-function)
          Style: 'State of Indiana v. Jane Smith',
          Court: 'Hamilton Superior Court 3',
          CaseType: 'F6 - Level 6 Felony',
          CaseSubType: 'Theft',
          FileDate: '09/01/2015',
          CaseStatusDate: '11/20/2015',
          CaseStatus: 'Disposed - Conviction',
          Charges: '*** REFERENCE CCS ENTRY *** Theft - Prior Conviction',
          Parties: 'Smith, Jane (Defendant)',
          Attorneys: 'Private Counsel',
          CaseID: 'token-29d03-f6-456'
        }
      ];

      global.document = {
        getElementById: (id) => (id === 'OD_BODY' ? mockContainer : null)
      };

      global.ko = {
        dataFor: (el) => (el === mockContainer ? { ob: { Results: () => mockObservableResults } } : null)
      };

      const extracted = Scraper._tryKnockoutExtraction(global.document);

      expect(extracted).not.toBeNull();
      expect(extracted.length).toBe(2);

      // Verify first case (observable functions)
      expect(extracted[0].case_number).toBe('49D01-1804-CM-014920');
      expect(extracted[0].title).toBe('State of Indiana v. John Doe'); // HTML tags stripped
      expect(extracted[0].court).toBe('Marion Superior Court, Criminal Division 1');
      expect(extracted[0].case_type).toBe('CM - Criminal Misdemeanor');
      expect(extracted[0].filed).toBe('04/15/2018');
      expect(extracted[0].status).toBe('05/10/2018, Disposed - Conviction');
      expect(extracted[0].dispositionDate).toBe('05/10/2018');
      expect(extracted[0].charges).toBe('Operating a Vehicle While Intoxicated');
      expect(extracted[0].caseToken).toBe('token-49d01-cm-123');
      expect(extracted[0]._source).toBe('knockout');

      // Verify second case (static props, sub-type concatenation, reference cleaner)
      expect(extracted[1].case_number).toBe('29D03-1509-F6-007812');
      expect(extracted[1].case_type).toBe('F6 - Level 6 Felony, Theft');
      expect(extracted[1].charges).toBe('Theft - Prior Conviction');
      expect(extracted[1].dispositionDate).toBe('11/20/2015');
      expect(extracted[1].caseToken).toBe('token-29d03-f6-456');
    });

    it('returns null if OD_BODY element or Knockout context is missing', () => {
      global.document = {
        getElementById: () => null
      };
      global.ko = undefined;

      const result = Scraper._tryKnockoutExtraction(global.document);
      expect(result).toBeNull();
    });

    it('handles edge cases gracefully: empty array or missing fields', () => {
      const mockContainer = { id: 'OD_BODY' };
      global.document = {
        getElementById: (id) => (id === 'OD_BODY' ? mockContainer : null)
      };
      global.ko = {
        dataFor: () => ({ ob: { Results: [] } })
      };

      const emptyResults = Scraper._tryKnockoutExtraction(global.document);
      expect(emptyResults).toEqual([]);

      // Test with missing properties
      global.ko.dataFor = () => ({
        ob: {
          Results: [
            {
              CaseNumber: null,
              Style: undefined,
              Charges: null
            }
          ]
        }
      });

      const sparseResults = Scraper._tryKnockoutExtraction(global.document);
      expect(sparseResults.length).toBe(1);
      expect(sparseResults[0].case_number).toBe('');
      expect(sparseResults[0].charges).toBe('');
      expect(sparseResults[0].index).toBe(1);
    });
  });

  describe('DOM Fallback Scraping (_tryScrapeDOM)', () => {
    it('correctly scrapes and normalizes case data from mock HTML table elements', () => {
      const mockTitleEl = {
        textContent: ' State of Indiana v. Alex Morgan ',
        getAttribute: (attr) => (attr === 'href' ? '/mycase/Case/CaseSummary?CaseToken=abc123token' : null),
        querySelector: () => null
      };

      const mockCaseNumEl = {
        textContent: ' 49G01-2001-F5-000100 ',
        getAttribute: () => null
      };

      const mockRows = [
        {
          querySelector: (selector) => {
            if (selector === '.result-title') return mockTitleEl;
            if (selector.includes('Case Number')) return mockCaseNumEl;
            if (selector.includes('FileDate')) return { textContent: '01/15/2020' };
            return null;
          },
          querySelectorAll: (selector) => {
            if (selector === '.result-row-details .row') {
              return [
                {
                  querySelector: (sel) => {
                    if (sel === '.text-muted') return { textContent: 'Court' };
                    if (sel.includes('.small')) return { textContent: 'Marion Superior Court, Criminal 1' };
                    return null;
                  }
                },
                {
                  querySelector: (sel) => {
                    if (sel === '.text-muted') return { textContent: 'Case Type' };
                    if (sel.includes('.small')) return { textContent: 'F5 - Level 5 Felony' };
                    return null;
                  }
                },
                {
                  querySelector: (sel) => {
                    if (sel === '.text-muted') return { textContent: 'Status' };
                    if (sel.includes('.small')) return { textContent: '08/20/2021, Disposed - Dismissed' };
                    return null;
                  }
                },
                {
                  querySelector: (sel) => {
                    if (sel === '.text-muted') return { textContent: 'Charges' };
                    if (sel.includes('.small')) return { textContent: 'Battery Resulting in Bodily Injury' };
                    return null;
                  }
                }
              ];
            }
            return [];
          }
        }
      ];

      const mockRoot = {
        querySelectorAll: (sel) => (sel === 'tr.result-row' ? mockRows : [])
      };

      const results = Scraper._tryScrapeDOM(mockRoot);
      expect(results.length).toBe(1);
      expect(results[0].case_number).toBe('49G01-2001-F5-000100');
      expect(results[0].title).toBe('State of Indiana v. Alex Morgan');
      expect(results[0].court).toBe('Marion Superior Court, Criminal 1');
      expect(results[0].case_type).toBe('F5 - Level 5 Felony');
      expect(results[0].status).toBe('08/20/2021, Disposed - Dismissed');
      expect(results[0].dispositionDate).toBe('08/20/2021');
      expect(results[0].charges).toBe('Battery Resulting in Bodily Injury');
      expect(results[0].caseToken).toBe('abc123token');
      expect(results[0]._source).toBe('dom');
    });
  });

  describe('Chronological Case Summary JSON Parsing (_parseCCSJson)', () => {
    it('parses Odyssey CCS JSON structure with charges, docket entries, and restitution', () => {
      const mockOdysseyJson = {
        CaseNumber: '49D01-1903-CM-009999',
        Charges: [
          {
            ChargeNumber: '01',
            OffenseDescription: 'Operating While Intoxicated',
            Statute: '9-30-5-2',
            Degree: 'Misdemeanor Class A',
            Plea: 'Guilty'
          }
        ],
        Events: [
          {
            EventDate: '03/10/2019',
            Description: 'Arrest / Information Filed',
            CaseEvent: {
              Comment: 'Arresting Agency: Indianapolis Metropolitan Police Department'
            }
          },
          {
            EventDate: '06/15/2019',
            Description: 'Sentencing Hearing',
            CaseEvent: {
              Comment: 'Restitution ordered in the amount of $250.00'
            },
            DispEvent: {
              Charges: [
                {
                  ChargeNumber: '01',
                  DispositionType: 'Conviction'
                }
              ]
            }
          },
          {
            EventDate: '12/10/2019',
            Description: 'Restitution Satisfaction',
            CaseEvent: {
              Comment: 'Full restitution of $250.00 satisfied and court costs paid in full'
            }
          }
        ],
        Parties: [
          {
            BaseConnKey: 'DF',
            FeeSummary: {
              Balance: '$0.00',
              AsOf: '12/10/2019'
            }
          }
        ]
      };

      const ccs = Scraper._parseCCSJson(mockOdysseyJson);

      expect(ccs).toBeDefined();
      expect(ccs.charges.length).toBe(1);
      expect(ccs.charges[0].offense).toBe('Operating While Intoxicated');
      expect(ccs.charges[0].disposition).toBe('Conviction');
      expect(ccs.charges[0].dispositionDate).toBe('06/15/2019');
      expect(ccs.dispositionDate).toBe('06/15/2019');

      expect(ccs.docketEntries.length).toBe(3);
      expect(ccs.docketEntries.some(e => e.text.includes('Indianapolis Metropolitan Police Department'))).toBe(true);

      expect(ccs.financials).toBeDefined();
      expect(ccs.financials.balanceDue).toBe(0);
      expect(ccs.financials.restitutionOrdered).toBe(true);
      expect(ccs.financials.restitutionSatisfied).toBe(true);
    });

    it('flags outstanding restitution balance when balanceDue is positive', () => {
      const mockUnpaidJson = {
        Charges: [],
        Events: [
          {
            EventDate: '01/01/2020',
            Description: 'Restitution Order',
            CaseEvent: {
              Comment: 'Restitution ordered: $500.00'
            }
          }
        ],
        Parties: [
          {
            BaseConnKey: 'DF',
            FeeSummary: {
              Balance: '$500.00',
              AsOf: '01/01/2020'
            }
          }
        ]
      };

      const ccs = Scraper._parseCCSJson(mockUnpaidJson);
      expect(ccs.financials.restitutionOrdered).toBe(true);
      expect(ccs.financials.balanceDue).toBe(500);
      expect(ccs.financials.restitutionSatisfied).toBe(false);
    });

    it('matches charge count with zero-padding variations (01 vs 1) and handles DFT defendant key', () => {
      const mockJson = {
        Charges: [
          {
            ChargeNumber: '01',
            OffenseDescription: 'SEE CCS ENTRY FOR OFFENSE DESCRIPTION'
          }
        ],
        Events: [
          {
            EventDate: '05/01/2021',
            Description: 'Initial Hearing',
            CaseEvent: {
              Comment: 'CT. 1 RECKLESS DRIVING (RJO)'
            }
          },
          {
            EventDate: '10/10/2021',
            Description: 'Disposed',
            DispEvent: {
              Charges: [
                {
                  ChargeNumber: 1, // numeric 1 vs string '01'
                  DispositionType: 'Dismissed'
                }
              ]
            }
          }
        ],
        Parties: [
          {
            BaseConnKey: 'PL',
            Connection: 'Plaintiff'
          },
          {
            BaseConnKey: 'DFT',
            Connection: 'Defendant',
            FeeSummary: {
              Balance: '$0.00'
            }
          }
        ]
      };

      const ccs = Scraper._parseCCSJson(mockJson);
      expect(ccs.charges[0].offense).toBe('RECKLESS DRIVING');
      expect(ccs.charges[0].disposition).toBe('Dismissed');
      expect(ccs.financials.balanceDue).toBe(0);
    });

    it('handles root-level FeeSummary and parses accounting credit balance in parentheses', () => {
      const mockCreditJson = {
        Charges: [],
        Events: [],
        FeeSummary: {
          Balance: '($25.00)',
          AsOf: '01/01/2023'
        }
      };

      const ccs = Scraper._parseCCSJson(mockCreditJson);
      expect(ccs.financials.balanceDue).toBe(-25);
      expect(ccs.financials.restitutionSatisfied).toBe(true);
      expect(ccs.financialSummary.balance).toBe('($25.00)');
    });

    it('normalizes ISO dates and infers case type from cause number when missing', () => {
      const mockContainer = { id: 'OD_BODY' };
      global.document = {
        getElementById: (id) => (id === 'OD_BODY' ? mockContainer : null)
      };
      global.ko = {
        dataFor: () => ({
          ob: {
            Results: [
              {
                CaseNumber: '49D01–1804–CM–014920', // contains en-dashes
                CaseType: '', // missing case type
                CaseStatusDate: '2020-05-15', // ISO format date
                CaseStatus: 'Disposed'
              }
            ]
          }
        })
      };

      const results = Scraper._tryKnockoutExtraction(global.document);
      expect(results).toHaveLength(1);
      expect(results[0].case_number).toBe('49D01-1804-CM-014920'); // normalized to ASCII hyphens
      expect(results[0].case_type).toBe('CM'); // inferred from cause number
      expect(results[0].dispositionDate).toBe('05/15/2020'); // converted to US format
    });
  });
});
