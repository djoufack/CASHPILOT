const INTERNAL_SECTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/section\s+["«]?TOP CLIENTS PAR CA FACTURE["»]?/gi, 'donnees de facturation clients'],
  [/donnees\s+["«]?TOP CLIENTS PAR CA FACTURE["»]?/gi, 'donnees de facturation clients'],
  [/TOP CLIENTS PAR CA FACTURE/gi, 'donnees de facturation clients'],
  [/FACTURES AVEC CLIENT ASSOCIE/gi, 'factures associees aux clients'],
  [/FACTURES SANS CLIENT ASSOCIE/gi, 'factures non associees a un client'],
  [/vous m['’]avez fourni(?:e)?\s+une?\s+section/gi, 'les donnees disponibles incluent'],
];

export function sanitizeCfoAnswer(answer: string): string {
  let cleaned = String(answer || '').trim();
  if (!cleaned) return cleaned;

  for (const [pattern, replacement] of INTERNAL_SECTION_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return cleaned;
}
