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
