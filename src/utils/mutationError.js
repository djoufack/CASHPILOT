/**
 * Standardised mutation error handler for CashPilot hooks.
 * Shows a user-facing toast and logs the error to console.
 *
 * @param {Function} toast - The toast function from useToast()
 * @param {Error|unknown} err - The caught error
 * @param {string} context - Short description of the failed operation (for dev logs)
 */
export function handleMutationError(toast, err, context = '') {
  const message = err?.message || 'Une erreur inattendue est survenue.';
  if (import.meta.env.DEV) {
    console.error(`[mutation error] ${context}:`, err);
  }
  toast({
    title: 'Erreur',
    description: message.slice(0, 150),
    variant: 'destructive',
  });
}
