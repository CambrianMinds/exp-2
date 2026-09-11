/**
 * Zod Schema for Indiana MyCase Bookmarklet Extraction Payload
 * 
 * Validates that Tyler Technologies Odyssey SPA / MyCase updates have not
 * broken search result structures, table layout, caseToken extraction,
 * or CCS docket and disposition parsing.
 */

const { z } = require('zod');

const CCSChargeSchema = z.object({
  count: z.string().optional(),
  offense: z.string().min(1, 'Offense description must not be empty'),
  statute: z.string().optional(),
  level: z.string().optional(),
  disposition: z.string().optional(),
  dispositionDate: z.string().optional()
});

const CCSDocketEntrySchema = z.object({
  date: z.string().min(1, 'Docket entry date must not be empty'),
  type: z.string().optional(),
  description: z.string().optional(),
  text: z.string().optional()
});

const CCSSchema = z.object({
  charges: z.array(CCSChargeSchema).min(1, 'CCS must contain at least 1 charge record'),
  docketEntries: z.array(CCSDocketEntrySchema).min(1, 'CCS must contain at least 1 docket entry'),
  financialSummary: z.any().optional(),
  arrestingAgency: z.string().nullable().optional(),
  sentenceDetails: z.any().optional(),
  dispositionDate: z.string().optional()
});

const CaseRecordSchema = z.object({
  index: z.number().int().positive().optional(),
  case_number: z.string().min(5, 'Valid case number is required (e.g. XXDXX-YYYY-CC-NNNNNN)'),
  title: z.string().min(1, 'Case title / style is required'),
  court: z.string().min(1, 'Court name is required'),
  case_type: z.string().min(1, 'Case type is required'),
  filed: z.string().min(1, 'Filed date is required'),
  status: z.string().min(1, 'Case status is required'),
  dispositionDate: z.string().min(1, 'Missing dispositionDate on case record'),
  charges: z.string().optional(),
  parties: z.string().optional(),
  attorneys: z.string().optional(),
  caseToken: z.string().min(1, 'caseToken is required for CCS deep-scraping'),
  _source: z.string().optional(),
  ccs: CCSSchema.optional()
});

const MyCaseExportPayloadSchema = z.object({
  source: z.string().min(1, 'Source identifier is required'),
  version: z.string().min(1, 'Payload version is required'),
  exportedAt: z.string().min(1, 'Export timestamp is required'),
  searchContext: z.string().optional(),
  totalCases: z.number().int().positive('Total cases must be greater than 0'),
  hasCCS: z.boolean().optional(),
  cases: z.array(CaseRecordSchema).min(1, 'Extracted cases array must contain at least 1 case')
}).refine(data => {
  // Ensure that cases.length matches totalCases
  return data.cases.length > 0 && data.cases.length === data.totalCases;
}, {
  message: 'cases.length must match totalCases and be greater than 0',
  path: ['cases']
}).refine(data => {
  // Ensure that at least one case has an extracted dispositionDate
  const hasAnyDispositionDate = data.cases.some(c => c.dispositionDate && c.dispositionDate.trim().length > 0);
  return hasAnyDispositionDate;
}, {
  message: 'At least one case must have a non-empty dispositionDate',
  path: ['cases']
});

/**
 * Validates extracted MyCase data against the Zod schema.
 * @param {Object} data - The extracted payload
 * @returns {{ success: boolean, data?: Object, errors?: Array<{ path: string, message: string }> }}
 */
function validateMyCasePayload(data) {
  const result = MyCaseExportPayloadSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message
  }));

  return { success: false, errors };
}

module.exports = {
  CCSChargeSchema,
  CCSDocketEntrySchema,
  CCSSchema,
  CaseRecordSchema,
  MyCaseExportPayloadSchema,
  validateMyCasePayload
};
