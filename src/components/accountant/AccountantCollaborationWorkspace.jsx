import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { buildAccountantCollaborationTaskInsights } from '@/services/accountantCollaborationTaskInsights';

const PRIORITY_STYLE = {
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  high: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function AccountantCollaborationWorkspace({
  tasks = [],
  loading = false,
  onRefresh,
  onCreateTask,
  onUpdateTaskStatus,
  onDeleteTask,
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const insights = useMemo(() => buildAccountantCollaborationTaskInsights(tasks), [tasks]);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await onCreateTask({
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate || null,
      });
      setForm({ title: '', description: '', priority: 'medium', dueDate: '' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusTone =
    insights.status === 'ready'
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100'
      : insights.status === 'attention'
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-100'
        : 'bg-red-500/10 border-red-500/20 text-red-100';

  return (
    <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur" data-testid="accountant-collab-workspace">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-white text-lg">Revue & taches expert-comptable</CardTitle>
            <p className="text-sm text-slate-400 mt-1">
              Centralisez les points de revue et suivez les taches partagees avec votre expert-comptable.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={loading}
            className="border-white/10 text-slate-300 hover:bg-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={insights.totalCount} />
          <KpiCard label="A faire" value={insights.todoCount} />
          <KpiCard label="En revue" value={insights.inReviewCount} />
          <KpiCard label="Bloquees" value={insights.blockedCount} />
        </div>

        <div className={`rounded-lg border p-3 text-sm ${statusTone}`}>
          <div className="flex items-center gap-2 font-medium">
            {insights.status === 'critical' ? <ShieldAlert className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            Statut collaboration: {insights.status}
          </div>
          {insights.recommendations.length > 0 && (
            <ul className="mt-2 text-xs space-y-1">
              {insights.recommendations.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Input
                value={form.title}
                onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="Titre de la tache..."
                className="bg-[#0a0e1a] border-white/10 text-white"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={form.priority}
                onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))}
                className="w-full rounded-md border border-white/10 bg-[#0a0e1a] px-3 py-2 text-sm text-white"
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((previous) => ({ ...previous, dueDate: event.target.value }))}
                className="bg-[#0a0e1a] border-white/10 text-white"
              />
            </div>
          </div>
          <Textarea
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            rows={2}
            placeholder="Description / point de revue..."
            className="bg-[#0a0e1a] border-white/10 text-white"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !form.title.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Ajouter la tache
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
              Aucune tache collaborative pour le moment.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-white/10 bg-[#0f1528]/70 px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">{task.title}</p>
                    <Badge className={PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium}>{task.priority}</Badge>
                    {task.completed_at && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        done
                      </Badge>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{task.description}</p>
                  )}
                  {task.due_date && <p className="text-xs text-slate-500 mt-1">Echeance: {task.due_date}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={task.status}
                    onChange={(event) => onUpdateTaskStatus(task.id, event.target.value)}
                    className="rounded-md border border-white/10 bg-[#0a0e1a] px-2 py-1 text-xs text-white"
                  >
                    <option value="todo">todo</option>
                    <option value="in_review">in_review</option>
                    <option value="blocked">blocked</option>
                    <option value="done">done</option>
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDeleteTask(task.id)}
                    className="text-red-300 hover:text-red-200 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-white mt-1">{value}</p>
    </div>
  );
}
