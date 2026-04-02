import { describe, it, expect } from 'vitest';
import { readFunctionErrorData } from '@/utils/supabaseFunctionErrors';

describe('readFunctionErrorData', () => {
  it('returns null for null error', async () => {
    expect(await readFunctionErrorData(null)).toBe(null);
  });

  it('returns null for error without context', async () => {
    expect(await readFunctionErrorData({})).toBe(null);
    expect(await readFunctionErrorData({ context: {} })).toBe(null);
  });

  it('returns parsed JSON from context', async () => {
    const error = {
      context: {
        json: async () => ({ message: 'Error detail' }),
      },
    };
    const result = await readFunctionErrorData(error);
    expect(result).toEqual({ message: 'Error detail' });
  });

  it('returns null if json() throws', async () => {
    const error = {
      context: {
        json: async () => { throw new Error('parse fail'); },
      },
    };
    expect(await readFunctionErrorData(error)).toBe(null);
  });
});
