import { describe, it, expect } from 'vitest';
import { sanitizeHTML, sanitizeText, escapeHTML, sanitizeObject } from '../sanitize';

describe('sanitizeHTML', () => {
  it('removes script tags', () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHTML(dirty);
    expect(result).not.toContain('<script>');
    expect(result).toContain('<p>Hello</p>');
  });

  it('keeps allowed tags (b, i, a, p, etc.)', () => {
    const input = '<p>Text <b>bold</b> <a href="https://example.com">link</a></p>';
    const result = sanitizeHTML(input);
    expect(result).toContain('<b>bold</b>');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
  });

  it('removes disallowed attributes', () => {
    const input = '<p onclick="alert(1)" style="color:red">text</p>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('style');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
    expect(sanitizeHTML('')).toBe('');
  });
});

describe('sanitizeText', () => {
  it('strips all HTML tags', () => {
    const dirty = '<p>Hello <b>World</b></p>';
    expect(sanitizeText(dirty)).toBe('Hello World');
  });

  it('removes script tags and their content', () => {
    const dirty = 'Hello<script>alert(1)</script>World';
    const result = sanitizeText(dirty);
    expect(result).not.toContain('script');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText('')).toBe('');
  });
});

describe('escapeHTML', () => {
  it('encodes special HTML characters', () => {
    expect(escapeHTML('&')).toBe('&amp;');
    expect(escapeHTML('<')).toBe('&lt;');
    expect(escapeHTML('>')).toBe('&gt;');
    expect(escapeHTML('"')).toBe('&quot;');
    expect(escapeHTML("'")).toBe('&#039;');
  });

  it('encodes a string with mixed special chars', () => {
    const result = escapeHTML('<div class="test">a & b</div>');
    expect(result).toBe('&lt;div class=&quot;test&quot;&gt;a &amp; b&lt;/div&gt;');
  });

  it('returns empty string for falsy input', () => {
    expect(escapeHTML(null)).toBe('');
    expect(escapeHTML('')).toBe('');
    expect(escapeHTML(undefined)).toBe('');
  });

  it('handles non-string input by converting to string', () => {
    expect(escapeHTML(123)).toBe('123');
  });
});

describe('sanitizeObject', () => {
  it('sanitizes string values in an object', () => {
    const obj = { name: '<b>Test</b>', count: 5 };
    const result = sanitizeObject(obj);
    expect(result.name).toBe('Test');
    expect(result.count).toBe(5);
  });

  it('recursively sanitizes nested objects', () => {
    const obj = { nested: { value: '<script>alert(1)</script>hello' } };
    const result = sanitizeObject(obj);
    expect(result.nested.value).toContain('hello');
    expect(result.nested.value).not.toContain('script');
  });

  it('returns non-object input as-is', () => {
    expect(sanitizeObject(null)).toBeNull();
    expect(sanitizeObject(42)).toBe(42);
  });
});
