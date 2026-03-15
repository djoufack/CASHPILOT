import { useCallback, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  Award,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileSignature,
  MessageSquare,
  Plus,
  Star,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { usePerformance } from '@/hooks/usePerformance';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ---------- constants ---------- */

const STATUS_FLOW = ['draft', 'self_assessment_done', 'manager_review_done', 'signed'];

const STATUS_LABELS = {
  draft: 'Brouillon',
  self_assessment_done: 'Auto-eval.',
  manager_review_done: 'Manager OK',
  signed: 'Signe',
};

const STATUS_COLORS = {
  draft: 'bg-white/10 text-gray-300 border-white/10',
  self_assessment_done: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  manager_review_done: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  signed: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
};

const _PERFORMANCE_LABELS = ['Insuffisant', 'A ameliorer', 'Conforme', 'Superieur', 'Exceptionnel'];
const _POTENTIAL_LABELS = ['Faible', 'Moyen', 'Eleve'];

const REVIEW_TYPES = [
  { value: 'annual', label: 'Annuel' },
  { value: 'mid_year', label: 'Mi-annee' },
  { value: 'probation', label: 'Periode essai' },
  { value: 'project', label: 'Projet' },
];

const emptyObjective = () => ({
  id: crypto.randomUUID(),
  title: '',
  weight: 0,
  self_rating: null,
  manager_rating: null,
  comment: '',
});

const emptyForm = () => ({
  employee_id: '',
  reviewer_id: '',
  review_period: new Date().getFullYear().toString(),
  review_type: 'annual',
  objectives: [emptyObjective()],
  competencies: [],
});

/* ---------- helpers ---------- */

const employeeName = (emp) => emp?.full_name || emp?.id || '-';

const formatDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR');
};

/* ---------- sub-components ---------- */

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function LabelBadge({ label, type }) {
  if (!label) return <span className="text-gray-500 text-xs">-</span>;
  const colors =
    type === 'performance'
      ? {
          Insuffisant: 'bg-red-500/20 text-red-300',
          'A ameliorer': 'bg-orange-500/20 text-orange-300',
          Conforme: 'bg-blue-500/20 text-blue-300',
          Superieur: 'bg-emerald-500/20 text-emerald-300',
          Exceptionnel: 'bg-purple-500/20 text-purple-300',
        }
      : {
          Faible: 'bg-red-500/20 text-red-300',
          Moyen: 'bg-amber-500/20 text-amber-300',
          Eleve: 'bg-emerald-500/20 text-emerald-300',
        };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[label] || 'bg-white/10 text-gray-300'}`}
    >
      {label}
    </span>
  );
}

function RatingStars({ value, max = 5, onChange }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i + 1)}
          className={`transition-colors ${i < (value || 0) ? 'text-orange-400' : 'text-white/20 hover:text-white/40'}`}
        >
          <Star className="h-4 w-4 fill-current" />
        </button>
      ))}
    </div>
  );
}

/* ---------- Campaign helpers ---------- */

function groupByCampaign(reviews) {
  const map = {};
  for (const r of reviews) {
    const key = `${r.review_period || 'N/A'}::${r.review_type || 'annual'}`;
    if (!map[key]) {
      map[key] = {
        period: r.review_period || 'N/A',
        type: r.review_type || 'annual',
        reviews: [],
        completed: 0,
        total: 0,
      };
    }
    map[key].reviews.push(r);
    map[key].total += 1;
    if (r.status === 'signed') map[key].completed += 1;
  }
  return Object.values(map).sort((a, b) => b.period.localeCompare(a.period));
}

/* ========== MAIN COMPONENT ========== */

export default function PerformanceReviewPage() {
  const {
    loading,
    reviews,
    employees,
    createReview,
    updateReview,
    submitSelfAssessment: _submitSelfAssessment,
    submitManagerReview: _submitManagerReview,
    signReview,
  } = usePerformance();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('campaigns');
  const [selectedReview, setSelectedReview] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const campaigns = useMemo(() => groupByCampaign(reviews), [reviews]);

  /* ---------- form handlers ---------- */

  const resetForm = useCallback(() => {
    setForm(emptyForm());
    setEditingReview(null);
    setShowForm(false);
  }, []);

  const openCreateForm = useCallback(() => {
    setForm(emptyForm());
    setEditingReview(null);
    setShowForm(true);
    setActiveTab('form');
  }, []);

  const openEditForm = useCallback((review) => {
    setForm({
      employee_id: review.employee_id || '',
      reviewer_id: review.reviewer_id || '',
      review_period: review.review_period || new Date().getFullYear().toString(),
      review_type: review.review_type || 'annual',
      objectives: review.objectives?.length
        ? review.objectives.map((o) => ({ ...o, id: o.id || crypto.randomUUID() }))
        : [emptyObjective()],
      competencies: review.competencies || [],
    });
    setEditingReview(review);
    setShowForm(true);
    setActiveTab('form');
  }, []);

  const handleFieldChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addObjective = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      objectives: [...prev.objectives, emptyObjective()],
    }));
  }, []);

  const removeObjective = useCallback((id) => {
    setForm((prev) => ({
      ...prev,
      objectives: prev.objectives.filter((o) => o.id !== id),
    }));
  }, []);

  const updateObjective = useCallback((id, field, value) => {
    setForm((prev) => ({
      ...prev,
      objectives: prev.objectives.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.employee_id) {
      toast({ title: 'Erreur', description: 'Selectionnez un collaborateur.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingReview) {
        await updateReview(editingReview.id, {
          reviewer_id: form.reviewer_id || null,
          review_period: form.review_period,
          review_type: form.review_type,
          objectives: form.objectives,
          competencies: form.competencies,
        });
        toast({ title: 'Entretien mis a jour' });
      } else {
        await createReview(form);
        toast({ title: 'Entretien cree' });
      }
      resetForm();
      setActiveTab('reviews');
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [form, editingReview, createReview, updateReview, resetForm, toast]);

  const handleSign = useCallback(
    async (reviewId) => {
      setSaving(true);
      try {
        await signReview(reviewId);
        toast({ title: 'Entretien signe' });
        setSelectedReview(null);
      } catch (err) {
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    },
    [signReview, toast]
  );

  /* ---------- detail view ---------- */

  const detailReview = useMemo(
    () => (selectedReview ? reviews.find((r) => r.id === selectedReview) : null),
    [selectedReview, reviews]
  );

  /* ---------- render ---------- */

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <Helmet>
        <title>Entretiens | CashPilot</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-orange-400" />
              Entretiens de performance
            </h1>
            <p className="text-sm text-gray-400 mt-1">Campagnes, entretiens et evaluations des collaborateurs</p>
          </div>
          <Button onClick={openCreateForm} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel entretien
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger
              value="campaigns"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <Calendar className="h-4 w-4 mr-1.5" />
              Campagnes
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <Users className="h-4 w-4 mr-1.5" />
              Entretiens
            </TabsTrigger>
            {showForm && (
              <TabsTrigger
                value="form"
                className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
              >
                <Edit3 className="h-4 w-4 mr-1.5" />
                {editingReview ? 'Modifier' : 'Creer'}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ===== TAB: Campagnes ===== */}
          <TabsContent value="campaigns" className="space-y-4 mt-4">
            {loading && <p className="text-gray-400 text-sm">Chargement...</p>}
            {!loading && campaigns.length === 0 && (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-12 text-center text-gray-400">
                  <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Aucune campagne. Creez un premier entretien pour demarrer.</p>
                </CardContent>
              </Card>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => {
                const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
                const typeLabel = REVIEW_TYPES.find((t) => t.value === c.type)?.label || c.type;
                return (
                  <Card
                    key={`${c.period}-${c.type}`}
                    className="bg-white/5 border-white/10 hover:border-orange-400/30 transition-colors"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-orange-400" />
                          {c.period}
                        </span>
                        <Badge className="bg-white/10 text-gray-300 border-white/10 text-xs">{typeLabel}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Progression</span>
                        <span className="text-white font-medium">
                          {c.completed}/{c.total}
                        </span>
                      </div>
                      <Progress value={pct} className="h-2 bg-white/10" />
                      <div className="flex gap-2 flex-wrap mt-2">
                        {STATUS_FLOW.map((s) => {
                          const count = c.reviews.filter((r) => r.status === s).length;
                          if (count === 0) return null;
                          return (
                            <span key={s} className="text-xs text-gray-400">
                              <StatusBadge status={s} /> {count}
                            </span>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ===== TAB: Entretiens ===== */}
          <TabsContent value="reviews" className="space-y-4 mt-4">
            {loading && <p className="text-gray-400 text-sm">Chargement...</p>}
            <Card className="bg-white/5 border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-gray-400">
                      <th className="px-4 py-3 font-medium">Collaborateur</th>
                      <th className="px-4 py-3 font-medium">Evaluateur</th>
                      <th className="px-4 py-3 font-medium">Periode</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 font-medium">Performance</th>
                      <th className="px-4 py-3 font-medium">Potentiel</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.length === 0 && !loading && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          Aucun entretien
                        </td>
                      </tr>
                    )}
                    {reviews.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => setSelectedReview(r.id)}
                      >
                        <td className="px-4 py-3 font-medium text-white">{employeeName(r.employee)}</td>
                        <td className="px-4 py-3 text-gray-300">{employeeName(r.reviewer)}</td>
                        <td className="px-4 py-3 text-gray-300">{r.review_period || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {REVIEW_TYPES.find((t) => t.value === r.review_type)?.label || r.review_type}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          <LabelBadge label={r.performance_label} type="performance" />
                        </td>
                        <td className="px-4 py-3">
                          <LabelBadge label={r.potential_label} type="potential" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-orange-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditForm(r);
                            }}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ===== TAB: Formulaire ===== */}
          {showForm && (
            <TabsContent value="form" className="space-y-6 mt-4">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-orange-400" />
                    {editingReview ? "Modifier l'entretien" : 'Nouvel entretien'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Row 1: Employee + Reviewer */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Collaborateur *</Label>
                      <Select value={form.employee_id} onValueChange={(v) => handleFieldChange('employee_id', v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Selectionnez..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {employeeName(e)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Evaluateur</Label>
                      <Select value={form.reviewer_id} onValueChange={(v) => handleFieldChange('reviewer_id', v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Selectionnez..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {employeeName(e)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Period + Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">Periode</Label>
                      <Input
                        value={form.review_period}
                        onChange={(e) => handleFieldChange('review_period', e.target.value)}
                        placeholder="2026"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Type</Label>
                      <Select value={form.review_type} onValueChange={(v) => handleFieldChange('review_type', v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REVIEW_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Objectives builder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-300 text-base font-semibold flex items-center gap-2">
                        <Target className="h-4 w-4 text-orange-400" />
                        Objectifs
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addObjective}
                        className="text-orange-400 hover:text-orange-300"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>
                    {form.objectives.map((obj, idx) => (
                      <div key={obj.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs text-gray-500 mt-2 shrink-0">#{idx + 1}</span>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2 space-y-1">
                              <Label className="text-xs text-gray-400">Intitule</Label>
                              <Input
                                value={obj.title}
                                onChange={(e) => updateObjective(obj.id, 'title', e.target.value)}
                                placeholder="Objectif..."
                                className="bg-white/5 border-white/10 text-white text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-400">Poids (%)</Label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={obj.weight}
                                onChange={(e) => updateObjective(obj.id, 'weight', Number(e.target.value))}
                                className="bg-white/5 border-white/10 text-white text-sm"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeObjective(obj.id)}
                            className="text-red-400 hover:text-red-300 shrink-0 mt-1"
                            disabled={form.objectives.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-400">Commentaire</Label>
                          <Input
                            value={obj.comment}
                            onChange={(e) => updateObjective(obj.id, 'comment', e.target.value)}
                            placeholder="Remarques..."
                            className="bg-white/5 border-white/10 text-white text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                    <Button variant="ghost" onClick={resetForm} className="text-gray-400">
                      Annuler
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {saving ? 'Enregistrement...' : editingReview ? 'Mettre a jour' : "Creer l'entretien"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ===== DIALOG: Fiche entretien ===== */}
      <Dialog open={!!detailReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent className="bg-[#0f1528] border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          {detailReview && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Award className="h-5 w-5 text-orange-400" />
                  Fiche d&apos;entretien &mdash; {employeeName(detailReview.employee)}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {REVIEW_TYPES.find((t) => t.value === detailReview.review_type)?.label || detailReview.review_type}{' '}
                  &bull; Periode : {detailReview.review_period || '-'} &bull; Cree le{' '}
                  {formatDate(detailReview.created_at)}
                </DialogDescription>
              </DialogHeader>

              {/* Status + Labels */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <StatusBadge status={detailReview.status} />
                {detailReview.performance_label && (
                  <LabelBadge label={detailReview.performance_label} type="performance" />
                )}
                {detailReview.potential_label && <LabelBadge label={detailReview.potential_label} type="potential" />}
              </div>

              {/* Evaluateur */}
              <div className="mt-4 text-sm text-gray-400">
                <span className="text-gray-500">Evaluateur :</span>{' '}
                <span className="text-white">{employeeName(detailReview.reviewer)}</span>
              </div>

              {/* Objectives table */}
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-400" />
                  Objectifs
                </h3>
                {!detailReview.objectives || detailReview.objectives.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun objectif defini.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400 text-left">
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Objectif</th>
                          <th className="px-3 py-2 font-medium">Poids</th>
                          <th className="px-3 py-2 font-medium">Auto-eval</th>
                          <th className="px-3 py-2 font-medium">Manager</th>
                          <th className="px-3 py-2 font-medium">Commentaire</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailReview.objectives.map((obj, idx) => (
                          <tr key={obj.id || idx} className="border-b border-white/5">
                            <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2 text-white">{obj.title || '-'}</td>
                            <td className="px-3 py-2 text-gray-300">{obj.weight ? `${obj.weight}%` : '-'}</td>
                            <td className="px-3 py-2">
                              <RatingStars value={obj.self_rating} />
                            </td>
                            <td className="px-3 py-2">
                              <RatingStars value={obj.manager_rating} />
                            </td>
                            <td className="px-3 py-2 text-gray-400 max-w-[200px] truncate">{obj.comment || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Competencies */}
              {detailReview.competencies && detailReview.competencies.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <Award className="h-4 w-4 text-orange-400" />
                    Competences
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detailReview.competencies.map((c, idx) => (
                      <Badge key={idx} className="bg-white/10 text-gray-300 border-white/10">
                        {typeof c === 'string' ? c : c.name || c.label || JSON.stringify(c)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Ratings summary */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-gray-400">Note globale (auto)</p>
                  <RatingStars value={detailReview.overall_self_rating} />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-gray-400">Note globale (manager)</p>
                  <RatingStars value={detailReview.overall_manager_rating} />
                </div>
              </div>

              {/* Comments */}
              <div className="mt-6 space-y-4">
                {detailReview.employee_comments && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Commentaires collaborateur
                    </h4>
                    <p className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg p-3">
                      {detailReview.employee_comments}
                    </p>
                  </div>
                )}
                {detailReview.manager_comments && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Commentaires manager
                    </h4>
                    <p className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg p-3">
                      {detailReview.manager_comments}
                    </p>
                  </div>
                )}
                {detailReview.development_plan && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <Target className="h-3 w-3" /> Plan de developpement
                    </h4>
                    <p className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg p-3">
                      {detailReview.development_plan}
                    </p>
                  </div>
                )}
              </div>

              {/* Sign date */}
              {detailReview.signed_at && (
                <p className="mt-4 text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Signe le {formatDate(detailReview.signed_at)}
                </p>
              )}

              {/* Footer actions */}
              <DialogFooter className="mt-6 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedReview(null);
                    openEditForm(detailReview);
                  }}
                  className="text-gray-400 hover:text-orange-400"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
                {detailReview.status !== 'signed' && (
                  <Button
                    size="sm"
                    onClick={() => handleSign(detailReview.id)}
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <FileSignature className="h-4 w-4 mr-1" />
                    {saving ? 'Signature...' : 'Signer'}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
