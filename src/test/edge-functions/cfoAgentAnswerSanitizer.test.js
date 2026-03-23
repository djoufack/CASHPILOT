import { describe, expect, it } from 'vitest';
import { sanitizeCfoAnswer } from '../../../supabase/functions/cfo-agent/answerSanitizer.ts';

describe('cfo-agent answer sanitizer', () => {
  it('removes internal section wording from assistant output', () => {
    const input = 'Puisque vous m\'avez fourni une section "TOP CLIENTS PAR CA FACTURE", je vais utiliser ces donnees.';

    const output = sanitizeCfoAnswer(input);

    expect(output).not.toContain('TOP CLIENTS PAR CA FACTURE');
    expect(output).not.toContain("vous m'avez fourni une section");
    expect(output).toContain('donnees de facturation clients');
  });

  it('replaces other internal labels with business wording', () => {
    const input = 'FACTURES AVEC CLIENT ASSOCIE et FACTURES SANS CLIENT ASSOCIE';
    const output = sanitizeCfoAnswer(input);

    expect(output).toContain('factures associees aux clients');
    expect(output).toContain('factures non associees a un client');
  });
});
