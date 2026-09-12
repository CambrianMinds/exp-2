// DOM References
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// Date Utilities
/**
 * Safely convert a date value (Date object or ISO string) to an ISO string.
 * Handles the case where chrome.runtime.sendMessage serializes Date objects
 * to ISO strings, making .toISOString() throw a TypeError.
 */
export function safeISOString(dateValue) {
  if (!dateValue) return null;
  try {
    const d = new Date(dateValue);
    return d instanceof Date && !isNaN(d) ? d.toISOString() : null;
  } catch (_) {
    return null;
  }
}

// Utilities
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// ─── Client-Side Audit Logger & Session Manifest ────────────────────────
const AUDIT_STORAGE_KEY = 'indiana_expungement_audit_log_v1';
const DRAFT_STORAGE_KEY = 'indiana_expungement_draft_v1';

export class AuditLogger {
  /**
   * Record a timestamped audit event in local session storage.
   * Never transmits data over the network.
   */
  static log(action, details = {}) {
    try {
      const existing = this.getLogs();
      const event = {
        timestamp: new Date().toISOString(),
        action,
        details
      };
      existing.push(event);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(existing));
      }
    } catch (e) {
      console.warn('[AuditLogger] Unable to save audit event:', e);
    }
  }

  static getLogs() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem(AUDIT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch (e) {
      /* ignore */
    }
    return [];
  }

  static clear() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(AUDIT_STORAGE_KEY);
      }
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * Build a complete, structured session manifest for user record-keeping.
   */
  static generateManifest(cases = [], report = null, profile = null) {
    return {
      manifestVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      generator: 'Indiana Expungement Assistant (IC § 35-38-9)',
      statutoryBasis: 'Indiana Code Title 35, Article 38, Chapter 9',
      petitionerSummary: profile ? {
        name: profile.fullName || 'Pro Se Petitioner',
        county: profile.county || 'Unspecified',
        addressCount: Array.isArray(profile.addresses) ? profile.addresses.length : 0
      } : null,
      caseCount: cases.length,
      statutoryAssessment: report ? {
        eligible: report.summary?.eligible || 0,
        ineligible: report.summary?.ineligible || 0,
        excluded: report.summary?.excluded || 0,
        pending: report.summary?.pending || 0,
        estimatedFilingFee: report.summary?.totalFilingFee || 0
      } : null,
      cases: cases.map(c => ({
        caseNumber: c.case_number || c.caseNumber,
        court: c.court,
        caseType: c.case_type || c.type,
        filed: c.filed,
        dispositionDate: c.dispositionDate || c.eligibility?.dispositionDate,
        charges: c.charges,
        status: c.status,
        eligibility: c.eligibility ? {
          eligible: c.eligibility.eligible,
          statute: c.eligibility.statute,
          statuteLabel: c.eligibility.statuteLabel,
          grantType: c.eligibility.grantType,
          waitingPeriodMet: c.eligibility.waitingPeriodMet,
          reason: c.eligibility.reason,
          warnings: c.eligibility.warnings || []
        } : null
      })),
      auditTrail: this.getLogs()
    };
  }
}

// ─── File Download Helper ───────────────────────────────────────────────
export function downloadJsonFile(obj, filename = 'expungement_data.json') {
  const jsonStr = JSON.stringify(obj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// ─── Draft Persistence Helpers ──────────────────────────────────────────
export function saveDraftSession(cases = [], profile = null) {
  try {
    if (typeof localStorage !== 'undefined') {
      const draft = {
        savedAt: new Date().toISOString(),
        cases,
        profile
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  } catch (e) {
    console.warn('[Draft] Failed to save draft:', e);
  }
}

export function loadDraftSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (e) {
    console.warn('[Draft] Failed to load draft:', e);
  }
  return null;
}

export function clearDraftSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (e) {
    /* ignore */
  }
}

// ─── Privacy-Preserving Client-Side Usage Metrics ───────────────────
// Zero server calls, zero telemetry, stored purely in user's localStorage
const METRICS_PACKETS_KEY = 'indiana_expunge_local_packets_count';
const METRICS_CASES_KEY = 'indiana_expunge_local_cases_count';

export function recordLocalGenerationStat(caseCount = 1) {
  try {
    if (typeof localStorage !== 'undefined') {
      const currentPackets = parseInt(localStorage.getItem(METRICS_PACKETS_KEY) || '0', 10);
      const currentCases = parseInt(localStorage.getItem(METRICS_CASES_KEY) || '0', 10);
      localStorage.setItem(METRICS_PACKETS_KEY, String(currentPackets + 1));
      localStorage.setItem(METRICS_CASES_KEY, String(currentCases + caseCount));
    }
  } catch (e) {
    /* ignore storage limitations */
  }
}

export function getLocalUsageStats() {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        packetsGenerated: parseInt(localStorage.getItem(METRICS_PACKETS_KEY) || '0', 10),
        casesProcessed: parseInt(localStorage.getItem(METRICS_CASES_KEY) || '0', 10)
      };
    }
  } catch (e) {
    /* ignore */
  }
  return { packetsGenerated: 0, casesProcessed: 0 };
}

