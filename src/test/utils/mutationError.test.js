import { describe, it, expect, vi } from 'vitest';
import { handleMutationError } from '@/utils/mutationError';

describe('handleMutationError', () => {
  it('calls toast with error message', () => {
    const toast = vi.fn();
    handleMutationError(toast, new Error('Something failed'), 'test op');
    expect(toast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Something failed',
      variant: 'destructive',
    });
  });

  it('truncates long messages to 150 chars', () => {
    const toast = vi.fn();
    const longMsg = 'x'.repeat(200);
    handleMutationError(toast, new Error(longMsg));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0].description.length).toBeLessThanOrEqual(150);
  });

  it('handles null error gracefully', () => {
    const toast = vi.fn();
    handleMutationError(toast, null, 'ctx');
    expect(toast).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Une erreur inattendue est survenue.',
      variant: 'destructive',
    });
  });

  it('handles error without message', () => {
    const toast = vi.fn();
    handleMutationError(toast, { code: 42 });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erreur', variant: 'destructive' })
    );
  });

  it('handles string error', () => {
    const toast = vi.fn();
    handleMutationError(toast, 'raw string error');
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
