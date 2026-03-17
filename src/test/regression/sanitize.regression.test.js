import { describe, it, expect } from 'vitest';
import { sanitizeHTML, sanitizeText, escapeHTML, escapeXML, sanitizeObject, purifyHTML } from '@/utils/sanitize';

// ============================================================================
// Regression: Centralized sanitization in src/utils/sanitize.js
// Bug: Sanitization was inconsistent across the codebase — some files used
//      ad-hoc regex, some used nothing. Now all sanitization is centralized
//      through DOMPurify-based helpers and lightweight escape functions.
// These tests target specific XSS vectors and edge cases that previously
// slipped through the fragmented approach.
// ============================================================================

// ---------------------------------------------------------------------------
// sanitizeHTML — XSS regression vectors
// ---------------------------------------------------------------------------
describe('sanitizeHTML XSS regression vectors', () => {
  it('should strip data-URI based XSS in anchor href', () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">click</a>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('data:text/html');
  });

  it('should strip SVG-based XSS (onload in svg)', () => {
    const input = '<svg onload="alert(1)"><circle r="10"/></svg>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('<svg');
  });

  it('should strip math tag XSS', () => {
    const input = '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('should strip object/embed tags', () => {
    const input = '<object data="evil.swf"></object><embed src="evil.swf">';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('should strip form action hijacking', () => {
    const input = '<form action="https://evil.com"><input type="submit"></form>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('evil.com');
  });

  it('should allow only whitelisted tags and attributes', () => {
    // Verify the allow-list works correctly after centralization
    // ALLOWED_TAGS: b, i, em, strong, a, p, br, ul, ol, li, span
    // ALLOWED_ATTR: href, target, rel, class
    const input = '<b class="x">bold</b><div id="y">div</div><p>para</p>';
    const result = sanitizeHTML(input);
    expect(result).toContain('bold');
    expect(result).not.toContain('<div');
    expect(result).not.toContain('id="y"'); // id is not in ALLOWED_ATTR
    expect(result).toContain('<p>para</p>');
  });
});

// ---------------------------------------------------------------------------
// sanitizeText — must strip ALL tags
// ---------------------------------------------------------------------------
describe('sanitizeText regression — zero tags allowed', () => {
  it('should strip even whitelisted HTML tags (zero tolerance for text)', () => {
    const input = '<b>bold</b> <i>italic</i> <a href="#">link</a>';
    const result = sanitizeText(input);
    expect(result).toBe('bold italic link');
  });

  it('should strip nested deeply crafted tags', () => {
    const input = '<div><span><b><i><a href="x">deep</a></i></b></span></div>';
    const result = sanitizeText(input);
    expect(result).toBe('deep');
  });

  it('should handle encoded HTML entities in text context', () => {
    const result = sanitizeText('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('should return empty string for tag-only input', () => {
    expect(sanitizeText('<br><hr><img src="x">')).toBe('');
  });

  it('should handle very long input without crashing', () => {
    const count = 1000;
    const longInput = '<b>x</b>'.repeat(count);
    const result = sanitizeText(longInput);
    // Must not crash, must strip all tags, and must preserve the text content
    expect(result).not.toContain('<b');
    expect(result).not.toContain('</b>');
    expect(result.length).toBeGreaterThanOrEqual(count);
    expect(result).toMatch(/^x+$/);
  });
});

// ---------------------------------------------------------------------------
// escapeHTML — character-level regression
// ---------------------------------------------------------------------------
describe('escapeHTML regression — character escaping', () => {
  it('should escape a typical XSS payload completely', () => {
    const payload = '"><img src=x onerror=alert(1)>';
    const result = escapeHTML(payload);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    expect(result).toContain('&quot;');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('should escape mixed content preserving readable text', () => {
    const input = 'Price: 5 < 10 & tax = 20% (it\'s "fine")';
    const result = escapeHTML(input);
    expect(result).toBe('Price: 5 &lt; 10 &amp; tax = 20% (it&#039;s &quot;fine&quot;)');
  });

  it('should handle multi-line strings', () => {
    const input = 'Line 1 <b>\nLine 2 & "quotes"';
    const result = escapeHTML(input);
    expect(result).toContain('&lt;b&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('\n');
  });

  it('should handle boolean input gracefully', () => {
    // escapeHTML coerces to String — should not throw
    expect(escapeHTML(false)).toBe('');
    expect(escapeHTML(0)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// escapeXML — regression for export formats (UBL, Factur-X, SAF-T)
// ---------------------------------------------------------------------------
describe('escapeXML regression — XML export safety', () => {
  it('should use &apos; (not &#039;) for single quotes per XML spec', () => {
    expect(escapeXML("it's")).toContain('&apos;');
    expect(escapeXML("it's")).not.toContain('&#039;');
  });

  it('should escape all five XML special characters', () => {
    const input = '&<>"\'';
    const result = escapeXML(input);
    expect(result).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('should return empty string for null', () => {
    expect(escapeXML(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(escapeXML(undefined)).toBe('');
  });

  it('should handle numeric input coerced to string', () => {
    expect(escapeXML(42)).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// sanitizeObject — deep recursion regression
// ---------------------------------------------------------------------------
describe('sanitizeObject regression — recursive sanitization', () => {
  it('should sanitize deeply nested XSS in form payloads', () => {
    const payload = {
      invoice: {
        client: {
          name: '<script>steal(document.cookie)</script>ACME',
          address: {
            street: '<img onerror="hack()" src=x>123 Main St',
          },
        },
        amount: 1500,
      },
    };
    const result = sanitizeObject(payload);
    expect(result.invoice.client.name).not.toContain('<script');
    expect(result.invoice.client.name).toContain('ACME');
    expect(result.invoice.client.address.street).not.toContain('onerror');
    expect(result.invoice.client.address.street).toContain('123 Main St');
    expect(result.invoice.amount).toBe(1500);
  });

  it('should handle mixed arrays and objects', () => {
    const payload = {
      tags: ['<b>safe</b>', '<script>bad</script>good'],
      meta: { nested: [{ val: '<iframe src="x"></iframe>clean' }] },
    };
    const result = sanitizeObject(payload);
    expect(result.tags[0]).toBe('safe');
    expect(result.tags[1]).not.toContain('<script');
    expect(result.tags[1]).toContain('good');
    expect(result.meta.nested[0].val).not.toContain('<iframe');
    expect(result.meta.nested[0].val).toContain('clean');
  });
});

// ---------------------------------------------------------------------------
// purifyHTML — full HTML sanitization regression
// ---------------------------------------------------------------------------
describe('purifyHTML regression — full HTML allowed with DOMPurify', () => {
  it('should allow standard HTML tags but strip script', () => {
    const input = '<div><p>Hello</p><script>alert(1)</script></div>';
    const result = purifyHTML(input);
    expect(result).toContain('<div>');
    expect(result).toContain('<p>Hello</p>');
    expect(result).not.toContain('<script');
  });

  it('should strip event handlers from allowed tags', () => {
    const input = '<div onclick="alert(1)">content</div>';
    const result = purifyHTML(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('content');
  });

  it('should handle empty/falsy input', () => {
    expect(purifyHTML('')).toBe('');
    expect(purifyHTML(null)).toBe('');
    expect(purifyHTML(undefined)).toBe('');
  });
});
