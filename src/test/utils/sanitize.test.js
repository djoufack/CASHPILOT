import { describe, it, expect } from 'vitest';
import {
  sanitizeHTML,
  sanitizeText,
  sanitizeObject,
  escapeHTML,
} from '@/utils/sanitize';

// ============================================================================
// sanitizeHTML
// ============================================================================
describe('sanitizeHTML', () => {
  it('should allow safe HTML tags', () => {
    const input = '<b>Bold</b> and <i>italic</i>';
    const result = sanitizeHTML(input);
    expect(result).toContain('<b>Bold</b>');
    expect(result).toContain('<i>italic</i>');
  });

  it('should allow paragraph tags', () => {
    const input = '<p>Paragraph text</p>';
    expect(sanitizeHTML(input)).toBe('<p>Paragraph text</p>');
  });

  it('should allow list tags', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    expect(sanitizeHTML(input)).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('should allow anchor tags with href', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHTML(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('Link');
  });

  it('should allow br tags', () => {
    const input = 'Line 1<br>Line 2';
    expect(sanitizeHTML(input)).toContain('<br>');
  });

  it('should allow span tags with class', () => {
    const input = '<span class="highlight">text</span>';
    const result = sanitizeHTML(input);
    expect(result).toContain('class="highlight"');
  });

  it('should strip script tags (XSS prevention)', () => {
    const input = '<script>alert("XSS")</script>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('should strip event handlers (XSS prevention)', () => {
    const input = '<img onerror="alert(1)" src="x">';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('should strip iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<iframe');
  });

  it('should strip style tags', () => {
    const input = '<style>body{display:none}</style>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<style');
    expect(result).not.toContain('display:none');
  });

  it('should strip disallowed attributes', () => {
    const input = '<p onclick="alert(1)">text</p>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('<p>text</p>');
  });

  it('should handle javascript: protocol in href', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('javascript:');
  });

  it('should return empty string for null input', () => {
    expect(sanitizeHTML(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(sanitizeHTML(undefined)).toBe('');
  });

  it('should return empty string for empty string input', () => {
    expect(sanitizeHTML('')).toBe('');
  });

  it('should handle nested disallowed tags', () => {
    const input = '<div><script>alert("xss")</script><p>Safe content</p></div>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Safe content');
  });
});

// ============================================================================
// sanitizeText
// ============================================================================
describe('sanitizeText', () => {
  it('should strip ALL HTML tags', () => {
    const input = '<b>Bold</b> and <script>alert(1)</script>';
    const result = sanitizeText(input);
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Bold');
  });

  it('should return plain text', () => {
    const input = '<p>Hello <strong>World</strong></p>';
    expect(sanitizeText(input)).toBe('Hello World');
  });

  it('should return empty string for null', () => {
    expect(sanitizeText(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(sanitizeText(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('should handle text with no HTML', () => {
    expect(sanitizeText('Plain text')).toBe('Plain text');
  });

  it('should strip XSS attempts in text context', () => {
    const input = '<img src=x onerror=alert(1)>';
    const result = sanitizeText(input);
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });
});

// ============================================================================
// sanitizeObject
// ============================================================================
describe('sanitizeObject', () => {
  it('should sanitize string values in an object', () => {
    const input = {
      name: '<script>alert(1)</script>John',
      age: 30,
    };
    const result = sanitizeObject(input);
    expect(result.name).not.toContain('<script>');
    expect(result.name).toContain('John');
    expect(result.age).toBe(30);
  });

  it('should sanitize nested objects', () => {
    const input = {
      user: {
        name: '<b>Bob</b>',
        bio: '<script>hack()</script>Developer',
      },
    };
    const result = sanitizeObject(input);
    expect(result.user.name).toBe('Bob');
    expect(result.user.bio).not.toContain('<script>');
    expect(result.user.bio).toContain('Developer');
  });

  it('should sanitize arrays', () => {
    const input = ['<b>item1</b>', '<script>x</script>item2'];
    const result = sanitizeObject(input);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe('item1');
    expect(result[1]).not.toContain('<script>');
  });

  it('should handle nested arrays in objects', () => {
    const input = {
      tags: ['<b>safe</b>', '<script>xss</script>'],
    };
    const result = sanitizeObject(input);
    expect(result.tags[0]).toBe('safe');
    expect(result.tags[1]).not.toContain('<script>');
  });

  it('should preserve non-string values', () => {
    const input = {
      count: 42,
      active: true,
      score: 3.14,
    };
    const result = sanitizeObject(input);
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.score).toBe(3.14);
  });

  it('should handle null values in object', () => {
    const input = {
      name: 'Test',
      value: null,
    };
    const result = sanitizeObject(input);
    expect(result.name).toBe('Test');
    expect(result.value).toBeNull();
  });

  it('should return null for null input', () => {
    expect(sanitizeObject(null)).toBeNull();
  });

  it('should return undefined for undefined input', () => {
    expect(sanitizeObject(undefined)).toBeUndefined();
  });

  it('should return primitive values as-is', () => {
    expect(sanitizeObject(42)).toBe(42);
    expect(sanitizeObject('text')).toBe('text');
    expect(sanitizeObject(true)).toBe(true);
  });
});

// ============================================================================
// escapeHTML
// ============================================================================
describe('escapeHTML', () => {
  it('should escape ampersand', () => {
    expect(escapeHTML('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape less than', () => {
    expect(escapeHTML('a < b')).toBe('a &lt; b');
  });

  it('should escape greater than', () => {
    expect(escapeHTML('a > b')).toBe('a &gt; b');
  });

  it('should escape double quotes', () => {
    expect(escapeHTML('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHTML("It's fine")).toBe('It&#039;s fine');
  });

  it('should escape all special characters together', () => {
    const input = '<script>alert("XSS" & \'hack\')</script>';
    const result = escapeHTML(input);
    expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot; &amp; &#039;hack&#039;)&lt;/script&gt;');
  });

  it('should return empty string for null', () => {
    expect(escapeHTML(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(escapeHTML(undefined)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('should not alter text without special characters', () => {
    expect(escapeHTML('Hello World 123')).toBe('Hello World 123');
  });

  it('should convert number input to string and escape', () => {
    expect(escapeHTML(42)).toBe('42');
  });

  it('should handle HTML injection attempt', () => {
    const input = '<img src=x onerror=alert(1)>';
    const result = escapeHTML(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;img');
  });
});
