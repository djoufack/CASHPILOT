# Skill : Sprint 4 — IA & Differenciateurs

## Metadata

| Champ | Valeur |
|-------|--------|
| Nom | `sprint-4-ia-differenciateurs` |
| Version | 1.0.0 |
| Agent | `agent-sprint-4-ia-differenciateurs.md` |
| Declencheur | Master Orchestrateur apres Sprint 3 PASS |

---

## Synopsis

Ce skill implemente les 10 taches du Sprint 4 pour integrer l'IA (Gemini 2.0 Flash) comme
avantage competitif decisif : chatbot comptable, categorisation auto, detection anomalies,
previsions, OCR multi-documents, rapports generes par IA.

```
PHASE 1         PHASE 2           PHASE 3          PHASE 4           PHASE 5         PHASE 6
Audit      -->  Decomposition --> Execution    --> Verification  --> Validation  --> Commit
(Explore)       (task-to-do/)     (2 waves)        (Orchestrateur)   (Humain)        (Git)
```

---

## Fichiers de reference existants

| Fichier | Contenu | Lignes |
|---------|---------|--------|
| `supabase/functions/extract-invoice/index.ts` | Pattern Edge Function IA : auth → credits → Gemini API → response | 203 |
| `src/hooks/useCreditsGuard.js` | 13 couts existants, pattern `guardedAction(cost, label, action)` | ~100 |
| `src/services/invoiceExtractionService.js` | Pattern appel Edge Function depuis le frontend | ~80 |
| `src/hooks/useInvoiceExtraction.js` | Pattern hook IA : loading, error, result, credits check | ~60 |

---

## Pattern Edge Function IA (a repliquer)

Toutes les nouvelles Edge Functions IA doivent suivre CE pattern exact :

```typescript
// 1. Auth check
const authHeader = req.headers.get('Authorization');
const { data: { user }, error } = await supabase.auth.getUser(token);

// 2. Credit check + debit
const { data: credits } = await supabase.from('user_credits').select('balance').eq('user_id', user.id).single();
if (credits.balance < COST) return new Response(JSON.stringify({ error: 'insufficient_credits' }), { status: 402 });
await supabase.from('user_credits').update({ balance: credits.balance - COST }).eq('user_id', user.id);

// 3. Gemini API call
const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
});

// 4. Error handling + refund on failure
if (!response.ok) {
  await supabase.from('user_credits').update({ balance: credits.balance }).eq('user_id', user.id); // refund
  return new Response(JSON.stringify({ error: 'ai_error' }), { status: 500 });
}
```

---

## Inventaire des taches

### Wave 1 — Taches independantes (7 agents paralleles)

#### Task 4.1 [HAUTE] — Chatbot IA comptable (Edge Function)
- **Fichiers** : `supabase/functions/ai-chatbot/index.ts` (CREER)
- **Probleme** : Aucun assistant IA interactif pour les utilisateurs.
- **Solution** :
  - Edge Function recevant { message, conversationHistory, context }
  - System prompt : "Tu es un assistant comptable expert. Tu aides les utilisateurs de CashPilot avec leurs questions de comptabilite, fiscalite, facturation."
  - Context : injecter les donnees pertinentes de l'utilisateur (solde, factures recentes, stats)
  - Gemini 2.0 Flash, temperature 0.3 (un peu plus creatif que l'extraction)
  - Credit cost : 2 credits par message
- **Criteres** : Edge Function deployable, system prompt comptable, credits 2/msg

#### Task 4.3 [HAUTE] — Categorisation auto des depenses
- **Fichiers** : `supabase/functions/ai-categorize/index.ts` (CREER), `src/hooks/useExpenses.js` (modifier)
- **Probleme** : Categorisation manuelle des depenses.
- **Solution** :
  - Edge Function : recoit { description, amount, date, vendor }, retourne { category, confidence, subcategory }
  - Categories predefinies : Fournitures, Transport, Restauration, Loyer, Telecom, Assurance, Services, Impots, Salaires, Marketing, Divers
  - Ajouter dans useExpenses : `autoCategorizExpense(expenseData)` qui appelle l'Edge Function
  - Credit cost : 1 credit par categorisation
- **Criteres** : Edge Function retourne category+confidence, hook modifie, credit 1/categorisation

#### Task 4.4 [HAUTE] — Detection anomalies comptables
- **Fichiers** : `supabase/functions/ai-anomaly-detect/index.ts` (CREER), `src/hooks/useAnomalyDetection.js` (CREER)
- **Probleme** : Aucune detection proactive des anomalies.
- **Solution** :
  - Edge Function : recoit les donnees comptables recentes (depenses, revenus, factures)
  - Prompt : analyser les patterns et detecter anomalies (doublons, montants inhabituels, ecarts, tendances)
  - Retourne : Array de { type, severity, description, affectedItems, recommendation }
  - Hook useAnomalyDetection : runDetection(), anomalies, loading, error
  - Credit cost : 5 credits par analyse
- **Criteres** : Edge Function retourne anomalies structurees, hook fonctionnel, credit 5/analyse

#### Task 4.6 [HAUTE] — Previsions tresorerie IA
- **Fichiers** : `supabase/functions/ai-forecast/index.ts` (CREER)
- **Probleme** : Tresorerie previsionnelle (Sprint 3) basee sur des regles simples, pas de ML.
- **Solution** :
  - Edge Function : recoit historique 6 mois (revenus, depenses, saisonnalite)
  - Prompt : generer previsions a 30/60/90 jours avec intervalles de confiance
  - Retourne : { predictions: [{ date, amount, confidence }], insights: string[], risks: string[] }
  - Credit cost : 5 credits par prevision
- **Criteres** : Edge Function retourne predictions + insights, credit 5/prevision

#### Task 4.7 [MOYENNE] — Suggestions de relance intelligentes
- **Fichiers** : `supabase/functions/ai-reminder-suggest/index.ts` (CREER)
- **Probleme** : Rappels de paiement (Sprint 2) generiques, pas personnalises.
- **Solution** :
  - Edge Function : recoit { client, invoiceHistory, paymentHistory, currentOverdue }
  - Prompt : suggerer le meilleur timing, ton et canal de relance base sur l'historique client
  - Retourne : { suggestedDate, tone (friendly/firm/urgent), channel (email/phone/letter), draftMessage }
  - Credit cost : 2 credits par suggestion
- **Criteres** : Edge Function retourne suggestion structuree, credit 2/suggestion

#### Task 4.8 [MOYENNE] — OCR ameliore multi-documents
- **Fichiers** : `supabase/functions/extract-invoice/index.ts` (modifier)
- **Probleme** : OCR uniquement pour factures fournisseurs. Pas pour bons de commande, notes de credit, tickets.
- **Solution** :
  - Ajouter parametre `documentType` : invoice (defaut), purchase_order, credit_note, receipt
  - Adapter le prompt Gemini selon le type de document
  - Retourner les champs specifiques a chaque type
  - Garder retrocompatibilite (defaut = invoice)
- **Criteres** : Parametre documentType accepte, prompts adaptes, retrocompatible

#### Task 4.9 [MOYENNE] — Rapport financier genere par IA
- **Fichiers** : `supabase/functions/ai-report/index.ts` (CREER)
- **Probleme** : Aucun rapport financier narratif genere automatiquement.
- **Solution** :
  - Edge Function : recoit { period (month/quarter/year), data (revenus, depenses, marges, tendances) }
  - Prompt : generer un rapport financier professionnel avec analyse, comparaisons, recommandations
  - Retourne : { title, summary, sections: [{ heading, content }], recommendations: string[] }
  - Format markdown pour rendu direct dans l'UI
  - Credit cost : 8 credits par rapport
- **Criteres** : Edge Function retourne rapport structure markdown, credit 8/rapport

### Wave 2 — Taches dependantes (3 agents, apres Wave 1)

#### Task 4.2 [HAUTE] — UI ChatWidget + hook
- **Depend de** : Task 4.1
- **Fichiers** : `src/components/AIChatWidget.jsx` (CREER), `src/hooks/useAIChat.js` (CREER)
- **Solution** :
  - useAIChat : sendMessage(text), messages[], loading, clearHistory
  - Gestion conversation history (max 20 messages)
  - Credits check avant envoi via useCreditsGuard
  - AIChatWidget : bulle flottante en bas a droite, fenetre chat avec messages, input, bouton envoyer
  - Design : glass morphism, dark theme compatible
- **Criteres** : Widget rend une fenetre chat, hook gere la conversation, build passe

#### Task 4.5 [HAUTE] — Dashboard anomalies UI
- **Depend de** : Task 4.4
- **Fichiers** : `src/components/AnomalyAlerts.jsx` (CREER)
- **Solution** :
  - Composant affichant les anomalies detectees avec severity color coding
  - Cards : icone selon type, description, items affectes, bouton action
  - Filtres par severity (critical, warning, info)
  - Integrable dans le dashboard principal
- **Criteres** : Composant rend les anomalies avec severity, filtres, build passe

#### Task 4.10 [MOYENNE] — Integrer credits IA pour toutes nouvelles fonctions
- **Depend de** : Wave 1 (pour connaitre les couts exacts)
- **Fichiers** : `src/hooks/useCreditsGuard.js` (modifier)
- **Solution** :
  - Ajouter dans CREDIT_COSTS :
    - AI_CHATBOT_MESSAGE: 2
    - AI_CATEGORIZE_EXPENSE: 1
    - AI_ANOMALY_DETECTION: 5
    - AI_FORECAST: 5
    - AI_REMINDER_SUGGEST: 2
    - AI_FINANCIAL_REPORT: 8
  - Verifier que chaque nouveau hook IA utilise guardedAction
- **Criteres** : 6 nouveaux couts dans CREDIT_COSTS, build passe

---

## PHASE 1 — Audit exploratoire

Lancer 2 agents Explore :
| Agent | Axe |
|-------|-----|
| Explore 1 | extract-invoice pattern, Gemini integration, credits system |
| Explore 2 | Hooks existants, UI components, depenses categorisation actuelle |

---

## PHASE 2 — Decomposition

Creer 10 fichiers dans `task-to-do/` suivant le format standard.

---

## PHASE 3 — Execution

Wave 1 : 7 agents (4.1, 4.3, 4.4, 4.6, 4.7, 4.8, 4.9)
Wave 2 : 3 agents (4.2, 4.5, 4.10)

---

## PHASE 4 — Verification (boucle jusqu'a 100%)

Lancer un agent de verification READ-ONLY. **BOUCLER jusqu'a 100% PASS** :

```
BOUCLE DE VERIFICATION :
1. Relire CHAQUE fichier modifie et verifier les criteres de chaque tache
2. Verification supplementaire : chaque Edge Function IA suit le pattern auth→credits→Gemini→error
3. Executer `npm run build`
4. Executer `npm run lint` (si configure)
5. Executer `npm run test`
6. Produire rapport PASS/FAIL par tache

SI une ou plusieurs taches sont FAIL :
   a. Pour chaque tache FAIL :
      - Identifier le critere non respecte
      - Relire la specification dans task-to-do/
      - Relancer le sous-agent avec le feedback precis
      - Attendre completion
   b. RECOMMENCER la verification depuis l'etape 1

SI build ou lint ou tests echouent :
   a. Lire les erreurs exactes (fichier, ligne, message)
   b. Identifier le(s) sous-agent(s) responsable(s)
   c. Relancer avec les erreurs comme contexte
   d. RECOMMENCER la verification depuis l'etape 1

CONDITION DE SORTIE (obligatoire) :
   - 100% des taches = PASS
   - Toutes les Edge Functions suivent le pattern IA uniforme
   - Build = 0 erreurs
   - Lint = 0 nouvelles erreurs
   - Tests = 0 echecs
   → Seulement alors, passer a la Phase 5
```

**L'orchestrateur ne passe JAMAIS a la Phase 5 tant que le resultat n'est pas 100% PASS.**

---

## PHASE 5 — Validation humaine

Presenter le bilan au Master Orchestrateur ou a l'utilisateur.
Demander autorisation pour commit.

---

## PHASE 6 — Commit

```bash
git commit -m "$(cat <<'EOF'
feat(ai): Sprint 4 - IA & Differenciateurs

- Chatbot IA comptable (Gemini 2.0 Flash)
- Categorisation auto depenses par IA
- Detection anomalies comptables
- Previsions tresorerie IA (30/60/90j)
- Suggestions relance intelligentes
- OCR multi-documents (factures, BC, NC, tickets)
- Rapport financier narratif genere par IA
- 6 nouveaux couts credits IA

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Gestion des erreurs

### Sous-agent perdu ou desoriente

Si un sous-agent ne complete pas sa tache correctement (output incomplet, fichiers non modifies,
erreur de comprehension, ou deviation par rapport a la specification) :

```
BOUCLE DE RECOVERY (aucune limite de tentatives) :

1. LIRE l'output du sous-agent pour diagnostiquer le probleme
2. RELIRE le fichier task-to-do/ correspondant (specification de reference)
3. RELIRE le(s) fichier(s) cible(s) pour constater l'etat actuel du code
4. CONSTRUIRE un nouveau prompt corrige contenant :
   - Le diagnostic precis de ce qui a echoue ou devie
   - La specification EXACTE de la tache (copie integrale du task-to-do)
   - Le contenu ACTUEL du/des fichier(s) a modifier
   - Des instructions explicites, non ambigues, etape par etape
   - Pour les Edge Functions IA : rappel du pattern auth→credits→Gemini→refund
5. RELANCER le sous-agent avec ce prompt corrige
6. ATTENDRE sa completion
7. VERIFIER si la tache est maintenant correctement implementee
8. Si NON → retourner a l'etape 1
9. Si OUI → marquer la tache comme completee

L'orchestrateur ne PASSE JAMAIS a la tache suivante tant que la tache
courante n'est pas correctement implementee.
Il n'y a PAS de limite de tentatives.
L'orchestrateur PERSISTE jusqu'a la reussite.
```

### Echec de verification (Phase 4)

```
Si la verification retourne des taches en FAIL :
    Pour chaque tache FAIL :
        1. Lire le detail de l'echec
        2. Relire la specification dans task-to-do/
        3. Relancer le sous-agent avec le feedback precis
        4. Re-verifier individuellement
    BOUCLER jusqu'a ce que TOUTES les taches soient PASS (0 exception)
```

### Echec build / lint / tests

```
Si build, lint ou tests echouent :
    1. Lire les erreurs exactes (fichier, ligne, message)
    2. Identifier la/les tache(s) responsable(s)
    3. Relancer le(s) sous-agent(s) avec les erreurs comme contexte
    4. Re-executer build + lint + tests
    BOUCLER jusqu'a 0 erreurs
    Ne JAMAIS passer a la Phase 5 avec des erreurs restantes
```

### Attention Edge Functions IA

Toujours verifier que chaque Edge Function IA :
- Fait le refund credits en cas d'echec API Gemini
- Suit le pattern uniforme auth→credits→Gemini→refund
- A le bon cout en credits dans useCreditsGuard

### Regle absolue

**L'orchestrateur de sprint ne rend JAMAIS la main au Master Orchestrateur
tant que 100% des taches ne sont pas PASS et que build + lint + tests
ne retournent pas 0 erreurs. Il persiste, corrige, relance, et re-verifie
en boucle jusqu'a atteindre ce resultat.**

---

## Principes

| # | Principe |
|---|----------|
| 1 | Parallelisme maximal (2 waves) |
| 2 | Isolation des taches |
| 3 | Specification explicite |
| 4 | Lecture avant ecriture |
| 5 | Zero confiance |
| 6 | Gate build + lint + tests |
| 7 | Consentement humain |
| 8 | Tracabilite complete |
| 9 | Pattern IA uniforme (auth→credits→Gemini→refund) |
| 10 | Credits obligatoires pour chaque fonction IA |
| 11 | **Persistence sans limite** : un agent perdu est recadre et relance jusqu'a reussite |
| 12 | **100% obligatoire** : aucun sprint ne se termine sans 100% PASS sur taches + build + tests |
