import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  GraduationCap,
  Plus,
  Clock,
  Users,
  Euro,
  Award,
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTraining } from '@/hooks/useTraining';
import { useToast } from '@/components/ui/use-toast';

/* ── status config ───────────────────────────────────────────── */
const STATUS_MAP = {
  planned: { label: 'Planifie', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  registered: { label: 'Inscrit', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'En cours', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  completed: { label: 'Terminé', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  failed: { label: 'Echec', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  cancelled: { label: 'Annulé', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const TAG_COLORS = {
  technique: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  management: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  soft_skills: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  compliance: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  safety: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};
const fallbackTagCls = 'bg-gray-500/20 text-gray-400 border-gray-500/30';

/* ── helpers ─────────────────────────────────────────────────── */
const fmtCurrency = (v, cur = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format(v || 0);

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '-');

const empName = (e) => e?.full_name || [e?.first_name, e?.last_name].filter(Boolean).join(' ') || '-';

/* ── component ───────────────────────────────────────────────── */
const TrainingPage = () => {
  const { loading, trainings, enrollments, employees, createTraining, enrollEmployee, updateEnrollment } =
    useTraining();
  const { toast } = useToast();

  const [tab, setTab] = useState('catalogue');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  /* form state */
  const [form, setForm] = useState({
    title: '',
    description: '',
    provider: '',
    provider_type: '',
    format: '',
    duration_hours: '',
    cost_per_person: '',
    currency: 'EUR',
    cpf_eligible: false,
    opco_eligible: false,
    is_mandatory: false,
    tags: [],
    is_active: true,
  });
  const [enrollForm, setEnrollForm] = useState({ training_id: '', employee_id: '' });
  const [submitting, setSubmitting] = useState(false);

  /* ── derived data ──────────────────────────────────────────── */
  const allTags = useMemo(() => {
    const s = new Set(trainings.flatMap((t) => (Array.isArray(t.tags) ? t.tags : [])).filter(Boolean));
    return [...s].sort();
  }, [trainings]);

  const filteredTrainings = useMemo(() => {
    const q = search.toLowerCase().trim();
    return trainings.filter((t) => {
      if (tagFilter !== 'all') {
        const tags = Array.isArray(t.tags) ? t.tags : [];
        if (!tags.includes(tagFilter)) return false;
      }
      if (q && !t.title?.toLowerCase().includes(q) && !t.provider?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trainings, search, tagFilter]);

  const enrollmentCountMap = useMemo(() => {
    const m = {};
    enrollments.forEach((e) => {
      const tid = e.training_id;
      m[tid] = (m[tid] || 0) + 1;
    });
    return m;
  }, [enrollments]);

  const selectedEnrollments = useMemo(() => {
    if (!selectedTraining) return [];
    return enrollments.filter((e) => e.training_id === selectedTraining.id);
  }, [enrollments, selectedTraining]);

  const completionRate = useMemo(() => {
    if (selectedEnrollments.length === 0) return 0;
    const done = selectedEnrollments.filter((e) => e.status === 'completed').length;
    return Math.round((done / selectedEnrollments.length) * 100);
  }, [selectedEnrollments]);

  /* ── handlers ──────────────────────────────────────────────── */
  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Erreur', description: 'Le titre est obligatoire.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createTraining(form);
      toast({ title: 'Formation creee', description: `"${form.title}" ajoutee au catalogue.` });
      setForm({
        title: '',
        description: '',
        provider: '',
        provider_type: '',
        format: '',
        duration_hours: '',
        cost_per_person: '',
        currency: 'EUR',
        cpf_eligible: false,
        opco_eligible: false,
        is_mandatory: false,
        tags: [],
        is_active: true,
      });
      setShowCreateDialog(false);
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnroll = async () => {
    if (!enrollForm.training_id || !enrollForm.employee_id) {
      toast({
        title: 'Erreur',
        description: 'Veuillez selectionner une formation et un employe.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      await enrollEmployee(enrollForm);
      toast({ title: 'Inscription reussie' });
      setEnrollForm({ training_id: '', employee_id: '' });
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── render ────────────────────────────────────────────────── */
  return (
    <>
      <Helmet>
        <title>Formation | CashPilot</title>
      </Helmet>

      <div className="container mx-auto">
        {/* header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-orange-400" /> Formation
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Catalogue, inscriptions et suivi des formations</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" /> Nouvelle formation
          </Button>
        </div>

        {/* tabs */}
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setSelectedTraining(null);
          }}
          className="mb-6"
        >
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-lg">
            <TabsTrigger
              value="catalogue"
              className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400"
            >
              <BookOpen className="w-4 h-4 mr-2" /> Catalogue
            </TabsTrigger>
            <TabsTrigger
              value="inscriptions"
              className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400"
            >
              <Users className="w-4 h-4 mr-2" /> Inscriptions
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ────────────────── Fiche formation (detail) ─────────── */}
        {selectedTraining && (
          <div className="space-y-6 mb-8">
            <Button
              variant="ghost"
              className="text-gray-400 hover:text-white"
              onClick={() => setSelectedTraining(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>

            <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-white">{selectedTraining.title}</h2>
                {Array.isArray(selectedTraining.tags) &&
                  selectedTraining.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className={TAG_COLORS[tag] || fallbackTagCls}>
                      {tag}
                    </Badge>
                  ))}
                {selectedTraining.cpf_eligible && (
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    CPF
                  </Badge>
                )}
                {selectedTraining.opco_eligible && (
                  <Badge variant="outline" className="bg-sky-500/20 text-sky-400 border-sky-500/30">
                    OPCO
                  </Badge>
                )}
              </div>

              {selectedTraining.description && (
                <p className="text-gray-400 text-sm leading-relaxed">{selectedTraining.description}</p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat
                  icon={<Clock className="w-4 h-4" />}
                  label="Duree"
                  value={`${selectedTraining.duration_hours || 0}h`}
                />
                <Stat
                  icon={<Euro className="w-4 h-4" />}
                  label="Cout/pers."
                  value={fmtCurrency(selectedTraining.cost_per_person, selectedTraining.currency)}
                />
                <Stat icon={<Users className="w-4 h-4" />} label="Inscrits" value={selectedEnrollments.length} />
                <Stat icon={<Award className="w-4 h-4" />} label="Completion" value={`${completionRate}%`} accent />
              </div>
            </div>

            {/* enrolled employees */}
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Employes inscrits</h3>
              </div>
              {selectedEnrollments.length === 0 ? (
                <p className="text-gray-500 text-sm p-6">Aucune inscription pour cette formation.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                        <th className="px-6 py-3">Employe</th>
                        <th className="px-6 py-3">Statut</th>
                        <th className="px-6 py-3">Date inscription</th>
                        <th className="px-6 py-3">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEnrollments.map((en) => {
                        const st = STATUS_MAP[en.status] || STATUS_MAP.registered;
                        return (
                          <tr key={en.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-6 py-3 text-gray-200">{empName(en.hr_employees)}</td>
                            <td className="px-6 py-3">
                              <Badge variant="outline" className={st.cls}>
                                {st.label}
                              </Badge>
                            </td>
                            <td className="px-6 py-3 text-gray-400">
                              {fmtDate(en.created_at || en.planned_start_date)}
                            </td>
                            <td className="px-6 py-3 text-gray-300">{en.score != null ? en.score : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────── Catalogue tab ───────────────────── */}
        {tab === 'catalogue' && !selectedTraining && (
          <div className="space-y-6">
            {/* filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Rechercher une formation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-gray-100"
                />
              </div>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-white/5 border-white/10 text-gray-100">
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les tags</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* grid */}
            {loading ? (
              <p className="text-gray-500 text-center py-12">Chargement...</p>
            ) : filteredTrainings.length === 0 ? (
              <p className="text-gray-500 text-center py-12">Aucune formation trouvee.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTrainings.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTraining(t)}
                    className="text-left rounded-xl bg-white/5 border border-white/10 p-5 hover:border-orange-400/40 hover:bg-white/[0.07] transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(t.tags) &&
                          t.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className={TAG_COLORS[tag] || fallbackTagCls}>
                              {tag}
                            </Badge>
                          ))}
                        {t.cpf_eligible && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]"
                          >
                            CPF
                          </Badge>
                        )}
                        {t.opco_eligible && (
                          <Badge variant="outline" className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px]">
                            OPCO
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0 mt-1" />
                    </div>

                    <h3 className="text-white font-semibold mb-2 line-clamp-2">{t.title}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {t.duration_hours || 0}h
                      </span>
                      <span className="flex items-center gap-1">
                        <Euro className="w-3.5 h-3.5" /> {fmtCurrency(t.cost_per_person, t.currency)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {enrollmentCountMap[t.id] || 0}
                      </span>
                    </div>

                    {t.provider && (
                      <p className="text-[11px] text-gray-600 mt-3 truncate">Prestataire : {t.provider}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ────────────────── Inscriptions tab ────────────────── */}
        {tab === 'inscriptions' && !selectedTraining && (
          <div className="space-y-6">
            {/* quick enroll */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Inscrire un employe</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select
                  value={enrollForm.training_id}
                  onValueChange={(v) => setEnrollForm((p) => ({ ...p, training_id: v }))}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-gray-100">
                    <SelectValue placeholder="Choisir une formation" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainings.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={enrollForm.employee_id}
                  onValueChange={(v) => setEnrollForm((p) => ({ ...p, employee_id: v }))}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-gray-100">
                    <SelectValue placeholder="Choisir un employe" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {empName(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleEnroll}
                  disabled={submitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  <Plus className="w-4 h-4 mr-1" /> Inscrire
                </Button>
              </div>
            </div>

            {/* enrollment table */}
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                      <th className="px-6 py-3">Employe</th>
                      <th className="px-6 py-3">Formation</th>
                      <th className="px-6 py-3">Statut</th>
                      <th className="px-6 py-3">Date inscription</th>
                      <th className="px-6 py-3">Date completion</th>
                      <th className="px-6 py-3">Score</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          Chargement...
                        </td>
                      </tr>
                    ) : enrollments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          Aucune inscription.
                        </td>
                      </tr>
                    ) : (
                      enrollments.map((en) => {
                        const st = STATUS_MAP[en.status] || STATUS_MAP.registered;
                        return (
                          <tr key={en.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-6 py-3 text-gray-200">{empName(en.hr_employees)}</td>
                            <td className="px-6 py-3 text-gray-300">{en.hr_training_catalog?.title || '-'}</td>
                            <td className="px-6 py-3">
                              <Badge variant="outline" className={st.cls}>
                                {st.label}
                              </Badge>
                            </td>
                            <td className="px-6 py-3 text-gray-400">
                              {fmtDate(en.created_at || en.planned_start_date)}
                            </td>
                            <td className="px-6 py-3 text-gray-400">{fmtDate(en.actual_end_date)}</td>
                            <td className="px-6 py-3 text-gray-300">{en.score != null ? en.score : '-'}</td>
                            <td className="px-6 py-3">
                              <div className="flex gap-1">
                                {!['completed', 'cancelled', 'failed'].includes(en.status) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-400 hover:text-emerald-300 text-xs h-7 px-2"
                                    onClick={async () => {
                                      try {
                                        await updateEnrollment(en.id, {
                                          status: 'completed',
                                          actual_end_date: new Date().toISOString().slice(0, 10),
                                        });
                                        toast({ title: 'Marque comme termine' });
                                      } catch (err) {
                                        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    Terminer
                                  </Button>
                                )}
                                {en.status !== 'cancelled' && en.status !== 'completed' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-300 text-xs h-7 px-2"
                                    onClick={async () => {
                                      try {
                                        await updateEnrollment(en.id, { status: 'cancelled' });
                                        toast({ title: 'Inscription annulee' });
                                      } catch (err) {
                                        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    Annuler
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ────────────── Nouvelle formation dialog ───────────── */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[600px] bg-[#0f1528] border-white/10 text-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gradient">Nouvelle formation</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 mt-4">
              <div className="grid gap-2">
                <Label className="text-gray-300">Titre *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="bg-white/5 border-white/10 text-gray-100"
                  placeholder="Ex: React avance"
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-gray-300">Description</Label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md bg-white/5 border border-white/10 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/50"
                  placeholder="Description de la formation..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-gray-300">Type de prestataire</Label>
                  <Select
                    value={form.provider_type}
                    onValueChange={(v) => setForm((p) => ({ ...p, provider_type: v }))}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-gray-100">
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Interne</SelectItem>
                      <SelectItem value="external">Externe</SelectItem>
                      <SelectItem value="online">En ligne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-gray-300">Format</Label>
                  <Select value={form.format} onValueChange={(v) => setForm((p) => ({ ...p, format: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-gray-100">
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="classroom">Presentiel</SelectItem>
                      <SelectItem value="online">En ligne</SelectItem>
                      <SelectItem value="hybrid">Hybride</SelectItem>
                      <SelectItem value="elearning">E-learning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-gray-300">Duree (heures)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.duration_hours}
                    onChange={(e) => setForm((p) => ({ ...p, duration_hours: e.target.value }))}
                    className="bg-white/5 border-white/10 text-gray-100"
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-gray-300">Tags (separes par des virgules)</Label>
                  <Input
                    value={Array.isArray(form.tags) ? form.tags.join(', ') : ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        tags: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    className="bg-white/5 border-white/10 text-gray-100"
                    placeholder="technique, management, ..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-gray-300">Cout par personne</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_per_person}
                    onChange={(e) => setForm((p) => ({ ...p, cost_per_person: e.target.value }))}
                    className="bg-white/5 border-white/10 text-gray-100"
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-gray-300">Devise</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-gray-300">Prestataire</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                  className="bg-white/5 border-white/10 text-gray-100"
                  placeholder="Nom du prestataire"
                />
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.cpf_eligible}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, cpf_eligible: v }))}
                  />
                  <Label className="text-gray-300 text-sm">Eligible CPF</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.opco_eligible}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, opco_eligible: v }))}
                  />
                  <Label className="text-gray-300 text-sm">Eligible OPCO</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_mandatory}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, is_mandatory: v }))}
                  />
                  <Label className="text-gray-300 text-sm">Obligatoire</Label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowCreateDialog(false)}
                  className="text-gray-400 hover:text-white"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {submitting ? 'Creation...' : 'Creer la formation'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

/* ── small stat block ────────────────────────────────────────── */
function Stat({ icon, label, value, accent }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
        {icon} {label}
      </div>
      <p className={`text-lg font-semibold ${accent ? 'text-orange-400' : 'text-gray-100'}`}>{value}</p>
    </div>
  );
}

export default TrainingPage;
