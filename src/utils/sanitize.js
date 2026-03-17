import DOMPurify from 'dompurify';

// ============================================================================
// DOMPurify-based sanitization
// ============================================================================

/**
 * Sanitize HTML string — removes XSS attack vectors
 * Use for any user-generated HTML content before rendering
 */
export const sanitizeHTML = (dirty) => {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });
};

/**
 * Sanitize plain text — strips ALL HTML tags
 * Use for text inputs, names, descriptions, etc.
 */
export const sanitizeText = (dirty) => {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
};

/**
 * Sanitize an object's string values recursively
 * Useful for sanitizing form data before submission
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Sanitize full HTML (all tags allowed) via DOMPurify then assign to element.innerHTML.
 * Use this instead of raw `element.innerHTML = ...` to prevent XSS.
 */
export const setSafeHtml = (element, html) => {
  element.innerHTML = DOMPurify.sanitize(String(html || ''));
};

/**
 * Sanitize full HTML via DOMPurify (returns the sanitized string).
 * Use when you need the sanitized HTML as a string, e.g. for dangerouslySetInnerHTML
 * or for assigning to innerHTML directly.
 */
export const purifyHTML = (html) => {
  return DOMPurify.sanitize(String(html || ''));
};

// ============================================================================
// Character escaping (no DOMPurify — lightweight string transforms)
// ============================================================================

/**
 * Escape special characters for safe display in HTML context.
 * Uses &#039; for single quotes (HTML entity).
 * Lighter alternative when DOMPurify is overkill.
 */
export const escapeHTML = (str) => {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(str).replace(/[&<>"']/g, (char) => map[char]);
};

/**
 * Escape special characters for safe embedding in XML content.
 * Uses &apos; for single quotes (XML standard).
 * Use for UBL, Factur-X, SAF-T, and other XML export formats.
 */
export const escapeXML = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeObject,
  setSafeHtml,
  purifyHTML,
  escapeHTML,
  escapeXML,
};
