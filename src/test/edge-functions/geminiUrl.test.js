import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGeminiGenerateContentUrl, getGeminiModel } from '../../../supabase/functions/_shared/gemini.ts';

describe('Gemini URL helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to a current Gemini model', () => {
    vi.stubGlobal('Deno', {
      env: {
        get: vi.fn().mockReturnValue(null),
      },
    });

    expect(getGeminiModel()).toBe('gemini-2.5-flash');
  });

  it('uses the configured model and normalizes models/ prefixes', () => {
    const url = buildGeminiGenerateContentUrl('test-key', 'models/gemini-2.5-flash-lite');

    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=test-key'
    );
  });
});
