/**
 * Questionator - Utility Functions
 */

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string} str - Raw string.
 * @returns {string} Safe HTML string.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely copies text to the user's clipboard.
 * @param {string} text - Text to copy.
 * @returns {Promise<boolean>} True if successful.
 */
export async function copyToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to execCommand if clipboard API fails
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

/**
 * Formats a byte size into human-readable string.
 * @param {number} bytes - Number of bytes.
 * @returns {string} E.g. "1.2 MB"
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes || typeof bytes !== 'number') return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Formats an integer with thousands separator.
 * @param {number} num
 * @returns {string} E.g. "38,421"
 */
export function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  return num.toLocaleString();
}

/**
 * Formats a decimal number as a percentage string.
 * @param {number} decimal - Value between 0 and 1 or 0 and 100.
 * @returns {string} E.g. "92%"
 */
export function formatPercent(decimal) {
  if (decimal === null || decimal === undefined) return '0%';
  const val = decimal <= 1 ? decimal * 100 : decimal;
  return `${Math.round(val)}%`;
}
