import { useState, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Kanban,
  Mail,
  MapPin,
  Plus,
  Search,
  Star,
  Users,
  UserPlus,
  Video,
  Phone,
  FileText,
  Calendar,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLocale, formatDate as formatDateLocale, formatTime as formatTimeLocale } from '@/utils/dateLocale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useRecruitment } from '@/hooks/useRecruitment';
import { useToast } from '@/components/ui/use-toast';

/* ---------- helpers ---------- */

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return formatDateLocale(d);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return formatDateLocale(d) + ' ' + formatTimeLocale(d, { hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (value, currency = 'EUR') =>
  new Intl.NumberFormat(getLocale(), { style: 'currency', currency }).format(Number(value || 0));

const normalize = (s = '') =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const PIPELINE_STAGE_KEYS = ['new', 'screening', 'interview', 'technical_test', 'offer', 'hired'];

const PIPELINE_STAGE_COLORS = {
  new: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  screening: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  interview: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  technical_test: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  offer: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  hired: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const POSITION_STATUS_CLS = {
  open: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  closed: 'bg-red-500/20 text-red-300 border-red-500/30',
  draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  on_hold: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

const INTERVIEW_TYPE_ICONS = {
  phone: Phone,
  video: Video,
  onsite: MapPin,
  technical: FileText,
};

const INTERVIEW_STATUS_CLS = {
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  no_show: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const RatingStars = ({ rating, max = 5 }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: max }, (_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${i < (rating || 0) ? 'text-orange-400 fill-orange-400' : 'text-gray-600'}`}
      />
    ))}
  </div>
);

/* ---------- sub-components ---------- */

const defaultPositionForm = {
  title: '',
  department: '',
  location: '',
  employment_type: 'full_time',
  salary_min: '',
  salary_max: '',
  status: 'open',
  description: '',
};

const defaultCandidateForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  source: 'website',
  notes: '',
};

/* ---------- Main component ---------- */

const RecruitmentPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    positions,
    candidates,
    applications,
    interviews,
    loading,
    createPosition,
    createCandidate,
    createApplication,
    moveApplication,
    scheduleInterview,
  } = useRecruitment();

  const [activeTab, setActiveTab] = useState('positions');
  const [search, setSearch] = useState('');
  const [positionDialog, setPositionDialog] = useState(false);
  const [positionForm, setPositionForm] = useState(defaultPositionForm);
  const [candidateDialog, setCandidateDialog] = useState(false);
  const [candidateForm, setCandidateForm] = useState(defaultCandidateForm);
  const [applyDialog, setApplyDialog] = useState(false);
  const [applyForm, setApplyForm] = useState({ candidate_id: '', position_id: '' });
  const [interviewDialog, setInterviewDialog] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    application_id: '',
    interview_type: 'video',
    scheduled_at: '',
    notes: '',
  });

  /* ---------- derived data ---------- */

  const candidateAppCounts = useMemo(() => {
    const map = {};
    (applications || []).forEach((app) => {
      const cid = app.candidate_id;
      map[cid] = (map[cid] || 0) + 1;
    });
    return map;
  }, [applications]);

  const positionCandidateCounts = useMemo(() => {
    const map = {};
    (applications || []).forEach((app) => {
      const pid = app.position_id;
      map[pid] = (map[pid] || 0) + 1;
    });
    return map;
  }, [applications]);

  const filteredPositions = useMemo(() => {
    if (!search) return positions;
    const q = normalize(search);
    return positions.filter(
      (p) => normalize(p.title).includes(q) || normalize(p.department).includes(q) || normalize(p.location).includes(q)
    );
  }, [positions, search]);

  const filteredCandidates = useMemo(() => {
    if (!search) return candidates;
    const q = normalize(search);
    return candidates.filter(
      (c) =>
        normalize(c.first_name).includes(q) ||
        normalize(c.last_name).includes(q) ||
        normalize(c.email).includes(q) ||
        normalize(c.source).includes(q)
    );
  }, [candidates, search]);

  const filteredInterviews = useMemo(() => {
    if (!search) return interviews;
    const q = normalize(search);
    return interviews.filter((iv) => {
      const cand = iv.application?.candidate;
      const pos = iv.application?.position;
      return (
        normalize(cand?.first_name).includes(q) ||
        normalize(cand?.last_name).includes(q) ||
        normalize(pos?.title).includes(q) ||
        normalize(iv.interview_type).includes(q)
      );
    });
  }, [interviews, search]);

  const pipelineByStage = useMemo(() => {
    const map = {};
    PIPELINE_STAGE_KEYS.forEach((key) => {
      map[key] = [];
    });
    (applications || []).forEach((app) => {
      const stage = app.status || 'new';
      if (map[stage]) map[stage].push(app);
      else if (map.new) map.new.push(app);
    });
    return map;
  }, [applications]);

  /* ---------- handlers ---------- */

  const handleCreatePosition = useCallback(async () => {
    try {
      await createPosition({
        ...positionForm,
        salary_min: positionForm.salary_min ? Number(positionForm.salary_min) : null,
        salary_max: positionForm.salary_max ? Number(positionForm.salary_max) : null,
      });
      setPositionDialog(false);
      setPositionForm(defaultPositionForm);
    } catch (err) {
      toast({ title: t('recruitment.toast.error'), description: err.message, variant: 'destructive' });
    }
  }, [positionForm, createPosition, toast, t]);

  const handleCreateCandidate = useCallback(async () => {
    try {
      await createCandidate(candidateForm);
      setCandidateDialog(false);
      setCandidateForm(defaultCandidateForm);
    } catch (err) {
      toast({ title: t('recruitment.toast.error'), description: err.message, variant: 'destructive' });
    }
  }, [candidateForm, createCandidate, toast, t]);

  const handleApply = useCallback(async () => {
    try {
      await createApplication({ candidate_id: applyForm.candidate_id, position_id: applyForm.position_id });
      setApplyDialog(false);
      setApplyForm({ candidate_id: '', position_id: '' });
    } catch (err) {
      toast({ title: t('recruitment.toast.error'), description: err.message, variant: 'destructive' });
    }
  }, [applyForm, createApplication, toast, t]);

  const handleMoveApp = useCallback(
    async (appId, direction) => {
      const app = applications.find((a) => a.id === appId);
      if (!app) return;
      const currentIdx = PIPELINE_STAGE_KEYS.indexOf(app.status || 'new');
      const nextIdx = direction === 'forward' ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx < 0 || nextIdx >= PIPELINE_STAGE_KEYS.length) return;
      try {
        await moveApplication(appId, PIPELINE_STAGE_KEYS[nextIdx]);
      } catch (err) {
        toast({ title: t('recruitment.toast.error'), description: err.message, variant: 'destructive' });
      }
    },
    [applications, moveApplication, toast, t]
  );

  const handleScheduleInterview = useCallback(async () => {
    try {
      await scheduleInterview({
        application_id: interviewForm.application_id,
        interview_type: interviewForm.interview_type,
        scheduled_at: interviewForm.scheduled_at,
        notes: interviewForm.notes || null,
      });
      setInterviewDialog(false);
      setInterviewForm({ application_id: '', interview_type: 'video', scheduled_at: '', notes: '' });
    } catch (err) {
      toast({ title: t('recruitment.toast.error'), description: err.message, variant: 'destructive' });
    }
  }, [interviewForm, scheduleInterview, toast, t]);

  /* ---------- TAB 1 : Postes ouverts ---------- */

  const renderPositions = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder={t('recruitment.positions.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              setApplyDialog(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserPlus className="w-4 h-4 mr-1.5" /> {t('recruitment.positions.btnApply')}
          </Button>
          <Button
            size="sm"
            onClick={() => setPositionDialog(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" /> {t('recruitment.positions.btnNew')}
          </Button>
        </div>
      </div>

      {filteredPositions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{t('recruitment.positions.noPositions')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPositions.map((pos) => {
            const stCls = POSITION_STATUS_CLS[pos.status] || POSITION_STATUS_CLS.draft;
            const stLabel = t(`recruitment.positionStatus.${pos.status}`, { defaultValue: pos.status });
            const count = positionCandidateCounts[pos.id] || 0;
            return (
              <Card key={pos.id} className="bg-white/5 border-white/10 hover:border-orange-500/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base text-white leading-snug">{pos.title}</CardTitle>
                    <Badge className={`shrink-0 text-xs border ${stCls}`}>{stLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pos.department && (
                    <p className="text-sm text-gray-400 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" /> {pos.department}
                    </p>
                  )}
                  {pos.location && (
                    <p className="text-sm text-gray-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {pos.location}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {t('recruitment.positions.candidateCount', { count })}
                    </span>
                    {(pos.salary_min || pos.salary_max) && (
                      <span className="text-orange-400 font-medium">
                        {pos.salary_min ? formatCurrency(pos.salary_min) : '...'} -{' '}
                        {pos.salary_max ? formatCurrency(pos.salary_max) : '...'}
                      </span>
                    )}
                  </div>
                  {pos.employment_type && (
                    <span className="inline-block text-xs text-gray-500 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                      {t(`recruitment.employmentType.${pos.employment_type}`, { defaultValue: pos.employment_type })}
                    </span>
                  )}
                  <p className="text-xs text-gray-600">
                    {t('recruitment.positions.createdAt', { date: formatDate(pos.created_at) })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ---------- TAB 2 : Pipeline Kanban ---------- */

  const renderPipeline = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{t('recruitment.pipeline.title')}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Kanban className="w-4 h-4" />
          {t('recruitment.pipeline.total', { count: applications.length })}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {PIPELINE_STAGE_KEYS.map((stageKey) => {
          const stageApps = pipelineByStage[stageKey] || [];
          const stageIdx = PIPELINE_STAGE_KEYS.indexOf(stageKey);
          const stageColor = PIPELINE_STAGE_COLORS[stageKey];
          const stageLabel = t(`recruitment.stages.${stageKey}`);
          return (
            <div
              key={stageKey}
              className="flex-shrink-0 w-72 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur"
            >
              {/* column header */}
              <div className="flex items-center justify-between p-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${stageColor.split(' ')[0]}`} />
                  <span className="text-sm font-medium text-white">{stageLabel}</span>
                </div>
                <span className="text-xs text-gray-500 bg-white/5 rounded-full px-2 py-0.5">{stageApps.length}</span>
              </div>

              {/* cards */}
              <div className="p-2 space-y-2 max-h-[520px] overflow-y-auto">
                {stageApps.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-6">{t('recruitment.pipeline.noApplication')}</p>
                ) : (
                  stageApps.map((app) => {
                    const cand = app.candidate;
                    const pos = app.position;
                    return (
                      <div
                        key={app.id}
                        className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2 hover:border-orange-400/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {cand?.first_name || ''} {cand?.last_name || t('recruitment.candidates.unknownCandidate')}
                            </p>
                            <p className="text-xs text-gray-400 truncate max-w-[180px]">
                              {pos?.title || t('recruitment.candidates.unknownPosition')}
                            </p>
                          </div>
                          {app.ai_score != null && (
                            <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 rounded px-1.5 py-0.5">
                              {app.ai_score}%
                            </span>
                          )}
                        </div>
                        {/* navigation buttons */}
                        <div className="flex items-center justify-between pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-gray-400 hover:text-white disabled:opacity-30"
                            disabled={stageIdx === 0}
                            onClick={() => handleMoveApp(app.id, 'backward')}
                            title={t('recruitment.pipeline.backward')}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-[10px] text-gray-600">
                            {formatDate(app.stage_changed_at || app.created_at)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-gray-400 hover:text-white disabled:opacity-30"
                            disabled={stageIdx === PIPELINE_STAGE_KEYS.length - 1}
                            onClick={() => handleMoveApp(app.id, 'forward')}
                            title={t('recruitment.pipeline.forward')}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ---------- TAB 3 : Candidats ---------- */

  const renderCandidates = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder={t('recruitment.candidates.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setCandidateDialog(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" /> {t('recruitment.candidates.btnNew')}
        </Button>
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{t('recruitment.candidates.noCandidates')}</p>
        </div>
      ) : (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-gray-400">
                    <th className="px-4 py-3 font-medium">{t('recruitment.candidates.colName')}</th>
                    <th className="px-4 py-3 font-medium">{t('recruitment.candidates.colEmail')}</th>
                    <th className="px-4 py-3 font-medium">{t('recruitment.candidates.colPhone')}</th>
                    <th className="px-4 py-3 font-medium">{t('recruitment.candidates.colSource')}</th>
                    <th className="px-4 py-3 font-medium text-center">{t('recruitment.candidates.colApplications')}</th>
                    <th className="px-4 py-3 font-medium">{t('recruitment.candidates.colAdded')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCandidates.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 text-white font-medium">
                        {c.first_name} {c.last_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-400 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {c.email || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{c.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-white/5 border-white/10 text-gray-300 text-xs">{c.source || 'N/A'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-400 font-semibold">{candidateAppCounts[c.id] || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  /* ---------- TAB 4 : Entretiens ---------- */

  const renderInterviews = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder={t('recruitment.interviews.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setInterviewDialog(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" /> {t('recruitment.interviews.btnSchedule')}
        </Button>
      </div>

      {filteredInterviews.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{t('recruitment.interviews.noInterviews')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInterviews.map((iv) => {
            const cand = iv.application?.candidate;
            const pos = iv.application?.position;
            const TypeIcon = INTERVIEW_TYPE_ICONS[iv.interview_type] || INTERVIEW_TYPE_ICONS.video;
            const typeLabel = t(`recruitment.interviewType.${iv.interview_type}`, { defaultValue: iv.interview_type });
            const statusLabel = t(`recruitment.interviewStatus.${iv.status}`, { defaultValue: iv.status });
            const statusCls = INTERVIEW_STATUS_CLS[iv.status] || INTERVIEW_STATUS_CLS.scheduled;
            return (
              <Card key={iv.id} className="bg-white/5 border-white/10 hover:border-orange-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-2 rounded-lg bg-white/5 border border-white/10">
                        <TypeIcon className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-white">
                          {cand?.first_name || ''} {cand?.last_name || t('recruitment.interviews.unknownCandidate')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {pos?.title || t('recruitment.interviews.unknownPosition')}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDateTime(iv.scheduled_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <TypeIcon className="w-3 h-3" /> {typeLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RatingStars rating={iv.rating} />
                      <Badge className={`text-xs border ${statusCls}`}>{statusLabel}</Badge>
                    </div>
                  </div>
                  {iv.interviewer && (
                    <p className="mt-2 text-xs text-gray-500">
                      {t('recruitment.interviews.interviewer')}{' '}
                      {iv.interviewer.full_name ||
                        `${iv.interviewer.first_name || ''} ${iv.interviewer.last_name || ''}`}
                    </p>
                  )}
                  {iv.notes && <p className="mt-1 text-xs text-gray-600 italic truncate">{iv.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ---------- Stats summary ---------- */

  const stats = useMemo(() => {
    const openPositions = positions.filter((p) => p.status === 'open').length;
    const totalCandidates = candidates.length;
    const inPipeline = applications.filter((a) => a.status !== 'hired').length;
    const hired = applications.filter((a) => a.status === 'hired').length;
    return { openPositions, totalCandidates, inPipeline, hired };
  }, [positions, candidates, applications]);

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">{t('recruitment.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <Helmet>
        <title>{t('recruitment.helmetTitle')}</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('recruitment.pageTitle')}</h1>
            <p className="text-sm text-gray-400 mt-1">{t('recruitment.pageSubtitle')}</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">{t('recruitment.kpi.openPositions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{stats.openPositions}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">{t('recruitment.kpi.candidates')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{stats.totalCandidates}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">{t('recruitment.kpi.inPipeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-400">{stats.inPipeline}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">{t('recruitment.kpi.hired')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-400">{stats.hired}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#10192d]/95 p-2">
            {[
              { key: 'positions', icon: Briefcase },
              { key: 'pipeline', icon: Kanban },
              { key: 'candidates', icon: Users },
              { key: 'interviews', icon: Calendar },
            ].map(({ key, icon: Icon }) => (
              <TabsTrigger
                key={key}
                value={key}
                className="min-w-max shrink-0 rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white data-[state=active]:border-orange-400/30 data-[state=active]:bg-orange-500/12 data-[state=active]:text-orange-300 data-[state=active]:shadow-[inset_0_0_0_1px_rgba(251,146,60,0.12)]"
              >
                <Icon className="w-4 h-4 mr-1.5" /> {t(`recruitment.tabs.${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="positions">{renderPositions()}</TabsContent>
          <TabsContent value="pipeline">{renderPipeline()}</TabsContent>
          <TabsContent value="candidates">{renderCandidates()}</TabsContent>
          <TabsContent value="interviews">{renderInterviews()}</TabsContent>
        </Tabs>
      </div>

      {/* ---------- Dialogs ---------- */}

      {/* Create Position Dialog */}
      <Dialog open={positionDialog} onOpenChange={setPositionDialog}>
        <DialogContent className="sm:max-w-lg bg-[#0f1528] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{t('recruitment.dialogs.newPosition.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelTitle')}</Label>
              <Input
                value={positionForm.title}
                onChange={(e) => setPositionForm((f) => ({ ...f, title: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder={t('recruitment.dialogs.newPosition.placeholderTitle')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelDepartment')}</Label>
                <Input
                  value={positionForm.department}
                  onChange={(e) => setPositionForm((f) => ({ ...f, department: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder="Engineering"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelLocation')}</Label>
                <Input
                  value={positionForm.location}
                  onChange={(e) => setPositionForm((f) => ({ ...f, location: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder={t('recruitment.dialogs.newPosition.placeholderLocation')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelSalaryMin')}</Label>
                <Input
                  type="number"
                  value={positionForm.salary_min}
                  onChange={(e) => setPositionForm((f) => ({ ...f, salary_min: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder="35000"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelSalaryMax')}</Label>
                <Input
                  type="number"
                  value={positionForm.salary_max}
                  onChange={(e) => setPositionForm((f) => ({ ...f, salary_max: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  placeholder="55000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelEmploymentType')}</Label>
                <Select
                  value={positionForm.employment_type}
                  onValueChange={(v) => setPositionForm((f) => ({ ...f, employment_type: v }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">{t('recruitment.employmentType.full_time')}</SelectItem>
                    <SelectItem value="part_time">{t('recruitment.employmentType.part_time')}</SelectItem>
                    <SelectItem value="contract">{t('recruitment.employmentType.contract')}</SelectItem>
                    <SelectItem value="internship">{t('recruitment.employmentType.internship')}</SelectItem>
                    <SelectItem value="freelance">{t('recruitment.employmentType.freelance')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelStatus')}</Label>
                <Select
                  value={positionForm.status}
                  onValueChange={(v) => setPositionForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{t('recruitment.positionStatus.open')}</SelectItem>
                    <SelectItem value="draft">{t('recruitment.positionStatus.draft')}</SelectItem>
                    <SelectItem value="on_hold">{t('recruitment.positionStatus.on_hold')}</SelectItem>
                    <SelectItem value="closed">{t('recruitment.positionStatus.closed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newPosition.labelDescription')}</Label>
              <Textarea
                value={positionForm.description}
                onChange={(e) => setPositionForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
                rows={3}
                placeholder={t('recruitment.dialogs.newPosition.placeholderDescription')}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPositionDialog(false)} className="text-gray-400">
              {t('recruitment.dialogs.newPosition.btnCancel')}
            </Button>
            <Button
              onClick={handleCreatePosition}
              disabled={!positionForm.title.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {t('recruitment.dialogs.newPosition.btnCreate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Candidate Dialog */}
      <Dialog open={candidateDialog} onOpenChange={setCandidateDialog}>
        <DialogContent className="sm:max-w-md bg-[#0f1528] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{t('recruitment.dialogs.newCandidate.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newCandidate.labelFirstName')}</Label>
                <Input
                  value={candidateForm.first_name}
                  onChange={(e) => setCandidateForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t('recruitment.dialogs.newCandidate.labelLastName')}</Label>
                <Input
                  value={candidateForm.last_name}
                  onChange={(e) => setCandidateForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newCandidate.labelEmail')}</Label>
              <Input
                type="email"
                value={candidateForm.email}
                onChange={(e) => setCandidateForm((f) => ({ ...f, email: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newCandidate.labelPhone')}</Label>
              <Input
                value={candidateForm.phone}
                onChange={(e) => setCandidateForm((f) => ({ ...f, phone: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newCandidate.labelSource')}</Label>
              <Select
                value={candidateForm.source}
                onValueChange={(v) => setCandidateForm((f) => ({ ...f, source: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">{t('recruitment.candidateSource.website')}</SelectItem>
                  <SelectItem value="linkedin">{t('recruitment.candidateSource.linkedin')}</SelectItem>
                  <SelectItem value="referral">{t('recruitment.candidateSource.referral')}</SelectItem>
                  <SelectItem value="job_board">{t('recruitment.candidateSource.job_board')}</SelectItem>
                  <SelectItem value="agency">{t('recruitment.candidateSource.agency')}</SelectItem>
                  <SelectItem value="other">{t('recruitment.candidateSource.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newCandidate.labelNotes')}</Label>
              <Textarea
                value={candidateForm.notes}
                onChange={(e) => setCandidateForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCandidateDialog(false)} className="text-gray-400">
              {t('recruitment.dialogs.newCandidate.btnCancel')}
            </Button>
            <Button
              onClick={handleCreateCandidate}
              disabled={!candidateForm.first_name.trim() || !candidateForm.last_name.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {t('recruitment.dialogs.newCandidate.btnAdd')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply (Candidater) Dialog */}
      <Dialog open={applyDialog} onOpenChange={setApplyDialog}>
        <DialogContent className="sm:max-w-md bg-[#0f1528] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{t('recruitment.dialogs.newApplication.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newApplication.labelCandidate')}</Label>
              <Select
                value={applyForm.candidate_id}
                onValueChange={(v) => setApplyForm((f) => ({ ...f, candidate_id: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder={t('recruitment.dialogs.newApplication.placeholderCandidate')} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.newApplication.labelPosition')}</Label>
              <Select
                value={applyForm.position_id}
                onValueChange={(v) => setApplyForm((f) => ({ ...f, position_id: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder={t('recruitment.dialogs.newApplication.placeholderPosition')} />
                </SelectTrigger>
                <SelectContent>
                  {positions
                    .filter((p) => p.status === 'open')
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setApplyDialog(false)} className="text-gray-400">
              {t('recruitment.dialogs.newApplication.btnCancel')}
            </Button>
            <Button
              onClick={handleApply}
              disabled={!applyForm.candidate_id || !applyForm.position_id}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {t('recruitment.dialogs.newApplication.btnApply')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Interview Dialog */}
      <Dialog open={interviewDialog} onOpenChange={setInterviewDialog}>
        <DialogContent className="sm:max-w-md bg-[#0f1528] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{t('recruitment.dialogs.scheduleInterview.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.scheduleInterview.labelApplication')}</Label>
              <Select
                value={interviewForm.application_id}
                onValueChange={(v) => setInterviewForm((f) => ({ ...f, application_id: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder={t('recruitment.dialogs.scheduleInterview.placeholderApplication')} />
                </SelectTrigger>
                <SelectContent>
                  {applications.map((app) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.candidate?.first_name || ''} {app.candidate?.last_name || ''} -{' '}
                      {app.position?.title || 'N/A'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.scheduleInterview.labelType')}</Label>
              <Select
                value={interviewForm.interview_type}
                onValueChange={(v) => setInterviewForm((f) => ({ ...f, interview_type: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">{t('recruitment.interviewType.phone')}</SelectItem>
                  <SelectItem value="video">{t('recruitment.interviewType.video')}</SelectItem>
                  <SelectItem value="onsite">{t('recruitment.interviewType.onsite')}</SelectItem>
                  <SelectItem value="technical">{t('recruitment.interviewType.technical')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.scheduleInterview.labelDateTime')}</Label>
              <Input
                type="datetime-local"
                value={interviewForm.scheduled_at}
                onChange={(e) => setInterviewForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">{t('recruitment.dialogs.scheduleInterview.labelNotes')}</Label>
              <Textarea
                value={interviewForm.notes}
                onChange={(e) => setInterviewForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setInterviewDialog(false)} className="text-gray-400">
              {t('recruitment.dialogs.scheduleInterview.btnCancel')}
            </Button>
            <Button
              onClick={handleScheduleInterview}
              disabled={!interviewForm.application_id || !interviewForm.scheduled_at}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {t('recruitment.dialogs.scheduleInterview.btnSchedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecruitmentPage;
