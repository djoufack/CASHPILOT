Plan : Ajouter la vue Kanban a toutes les pages avec entites multi-statuts
Objectif
Creer un composant GenericKanbanView reutilisable (comme GenericCalendarView et GenericAgendaView) et l'integrer dans toutes les pages qui affichent des entites a statuts multiples. Ajouter egalement les vues Calendar/Agenda/Kanban a SupplierInvoices (actuellement liste uniquement).

1. Etat actuel
Pattern de vues existant
Toutes les pages utilisent le meme pattern :


const [viewMode, setViewMode] = useState('list');
<Tabs value={viewMode} onValueChange={setViewMode}>
  <TabsTrigger value="list"><List /> List</TabsTrigger>
  <TabsTrigger value="calendar"><CalendarDays /> Calendar</TabsTrigger>
  <TabsTrigger value="agenda"><CalendarClock /> Agenda</TabsTrigger>
</Tabs>
Composants generiques existants
src/components/GenericCalendarView.jsx — calendar reutilisable (events, statusColors, legend)
src/components/GenericAgendaView.jsx — agenda reutilisable (items, dateField, onEdit/onDelete/onView)
Kanban existant (non reutilisable)
src/components/KanbanBoard.jsx — specifique aux taches (hardcoded TaskCard, useTaskStatus)
Utilise @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (deja installes)
Entites cibles
Entite	Page	Champ statut	Valeurs	Vues actuelles
Factures client	InvoicesPage.jsx	payment_status	unpaid, partial, paid, overpaid	List/Calendar/Agenda
Devis	QuotesPage.jsx	status	draft, sent, accepted, rejected, expired	List/Calendar/Agenda
Bons de commande	PurchaseOrdersPage.jsx	status	draft, sent, confirmed, completed, cancelled	List/Calendar/Agenda
Projets	ProjectsPage.jsx	status	active, in_progress, on_hold, completed, cancelled	List/Calendar/Agenda
Creances	DebtManagerPage.jsx	status	pending, partial, paid, overdue, cancelled	List/Calendar/Agenda
Dettes	DebtManagerPage.jsx	status	pending, partial, paid, overdue, cancelled	List/Calendar/Agenda
Factures fournisseur	SupplierInvoices.jsx	payment_status	pending, paid, overdue	Liste seule
Avoirs	CreditNotesPage.jsx	status	draft, issued, applied	List/Calendar/Agenda
Bons de livraison	DeliveryNotesPage.jsx	status	pending, shipped, delivered	List/Calendar/Agenda
2. Fichier a creer
src/components/GenericKanbanView.jsx (NOUVEAU, ~200 lignes)
API du composant :


<GenericKanbanView
  columns={[{ id: 'pending', title: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' }, ...]}
  items={[{ id, title, subtitle, amount, date, status, statusLabel, statusColor }, ...]}
  onStatusChange={async (itemId, newStatus) => { /* persist to DB */ }}
  onView={(item) => {}}   // optionnel
  onEdit={(item) => {}}   // optionnel
  onDelete={(item) => {}} // optionnel
  emptyMessage="Drop items here"
/>
Architecture interne (basee sur KanbanBoard.jsx) :

GenericKanbanView : DndContext + sensors (PointerSensor distance:5, KeyboardSensor) + closestCorners + DragOverlay
KanbanColumn : useDroppable, header avec titre + count, SortableContext
SortableKanbanItem : useSortable, CSS transform/transition/opacity
KanbanCard : carte par defaut (title, subtitle, amount, date, badge status, GripVertical, boutons actions)
Logique drag-and-drop :

handleDragStart → set activeItem pour DragOverlay
handleDragEnd → detecter colonne cible (over.id = colonne ou item dans colonne), update optimiste localItems, appeler onStatusChange(id, newStatus)
useEffect sync localItems avec items prop
Style KanbanCard (meme pattern que AgendaCard dans GenericAgendaView.jsx) :

bg-gray-800, border-gray-700, rounded-lg
titre blanc, subtitle gray-500, montant orange-400
date avec icone Calendar, badge status colore
Boutons : Eye, Edit, Trash2 (optionnels)
GripVertical pour le drag handle
3. Fichiers a modifier (12 fichiers)
3a. src/pages/InvoicesPage.jsx
Import GenericKanbanView + Kanban de lucide-react
Ajouter colonnes : unpaid, partial, paid, overpaid
Ajouter <TabsTrigger value="kanban"> apres agenda
Ajouter <TabsContent value="kanban"> avec GenericKanbanView, items=invoiceAgendaItems (deja existant), onStatusChange=updateInvoiceStatus
3b. src/pages/QuotesPage.jsx
Import GenericKanbanView + Kanban
Colonnes : draft, sent, accepted, rejected, expired
Ajouter TabsTrigger + TabsContent kanban
Verifier que updateQuote est destructure depuis useQuotes()
3c. src/pages/PurchaseOrdersPage.jsx
Import GenericKanbanView + Kanban
Colonnes : draft, sent, confirmed, completed, cancelled
Ajouter TabsTrigger + TabsContent kanban
Verifier que updatePurchaseOrder est destructure depuis usePurchaseOrders()
3d. src/pages/ProjectsPage.jsx
Import GenericKanbanView + Kanban
Colonnes : active, in_progress, on_hold, completed, cancelled
Ajouter TabsTrigger + TabsContent kanban
Verifier que updateProject est destructure depuis useProjects()
3e. src/pages/DebtManagerPage.jsx
Import GenericKanbanView + Kanban
Colonnes : pending, partial, paid, overdue, cancelled
Ajouter un onglet "Kanban" qui affiche deux boards empiles : Creances + Dettes
Mapper les items depuis receivables et payables
Callbacks : updateReceivable, updatePayable
3f. src/components/suppliers/SupplierInvoices.jsx
Changement le plus important : ajouter le systeme de Tabs complet (actuellement liste seule)
Import Tabs/TabsList/TabsTrigger/TabsContent + GenericCalendarView + GenericAgendaView + GenericKanbanView + icones
const [viewMode, setViewMode] = useState('list');
Colonnes kanban : pending, paid, overdue
Calendar events + statusColors + legend
Agenda items mapping
Kanban items = meme array que agenda items
Wrapper la table existante dans <TabsContent value="list">
3g. src/pages/CreditNotesPage.jsx
Import GenericKanbanView + Kanban
Colonnes : draft, issued, applied
Ajouter TabsTrigger + TabsContent kanban
3h. src/pages/DeliveryNotesPage.jsx
Import GenericKanbanView + Kanban
Colonnes : pending, shipped, delivered
Ajouter TabsTrigger + TabsContent kanban
3i-k. src/i18n/locales/en.json, fr.json, nl.json
Ajouter dans la section common :


en: "kanban": "Kanban", "kanbanDropHere": "Drop items here"
fr: "kanban": "Kanban", "kanbanDropHere": "Deposez les elements ici"
nl: "kanban": "Kanban", "kanbanDropHere": "Plaats items hier"
4. Avantage cle : reutilisation des items agenda
Chaque page definit deja un array xxxAgendaItems avec la forme { id, title, subtitle, date, status, statusLabel, statusColor, amount }. Le GenericKanbanView utilise exactement le meme format. Aucun nouveau mapping n'est necessaire — on passe les memes items aux deux composants.

5. Ordre d'implementation (parallelisable)
Phase 1 : Composant core
Creer GenericKanbanView.jsx
Phase 2 : Integrations simples (pages avec deja 3 vues)
InvoicesPage.jsx — 4 colonnes
QuotesPage.jsx — 5 colonnes
PurchaseOrdersPage.jsx — 5 colonnes
ProjectsPage.jsx — 5 colonnes
CreditNotesPage.jsx — 3 colonnes
DeliveryNotesPage.jsx — 3 colonnes
Phase 3 : Integrations complexes
DebtManagerPage.jsx — 2 boards empiles
SupplierInvoices.jsx — ajout complet du systeme de Tabs (4 vues)
Phase 4 : i18n
en.json, fr.json, nl.json
6. Verification
npm run build sans erreurs
Verifier visuellement chaque page : le tab Kanban apparait, les colonnes s'affichent, les cartes se repartissent par statut
Drag-and-drop : deplacer une carte d'une colonne a l'autre met a jour le statut en DB
SupplierInvoices : les 4 vues (List/Calendar/Agenda/Kanban) fonctionnent
Responsive : les colonnes scrollent horizontalement sur mobile
7. Fichiers de reference
Fichier	Utilite
src/components/KanbanBoard.jsx	Pattern DnD (sensors, DndContext, handleDragEnd, DragOverlay, useDroppable, useSortable)
src/components/GenericAgendaView.jsx	Pattern API generique + style KanbanCard (AgendaCard)
src/components/GenericCalendarView.jsx	Pattern API generique
src/pages/InvoicesPage.jsx	Pattern Tabs + items mapping + integration vues
User approved the plan
 --------

Resultat
1 composant cree :

GenericKanbanView.jsx — composant Kanban reutilisable avec drag-and-drop (@dnd-kit)
8 pages modifiees avec onglet Kanban :

Page	Colonnes	Statut
InvoicesPage.jsx	unpaid, partial, paid, overpaid	Done
QuotesPage.jsx	draft, sent, accepted, rejected, expired	Done
PurchaseOrdersPage.jsx	draft, sent, confirmed, completed, cancelled	Done
ProjectsPage.jsx	active, in_progress, on_hold, completed, cancelled	Done
DebtManagerPage.jsx	2 boards (creances + dettes) : pending, partial, paid, overdue, cancelled	Done
CreditNotesPage.jsx	draft, issued, applied	Done
DeliveryNotesPage.jsx	pending, shipped, delivered	Done
SupplierInvoices.jsx	pending, paid, overdue + Calendar + Agenda	Done
3 fichiers i18n mis a jour (en/fr/nl) avec les cles kanban et kanbanDropHere

Build : 4445 modules, 0 erreurs.
