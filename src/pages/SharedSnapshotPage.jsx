import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, Clock3, Link2, Loader2, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/calculations';

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('fr-FR');
  } catch {
    return value;
  }
};

const SnapshotSummaryCards = ({ cards = [] }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {cards.map((card) => (
      <Card key={card.label} className="border-white/10 bg-slate-950/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-300">{card.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-semibold ${card.accentClass || 'text-white'}`}>{card.value}</p>
          {card.hint ? <p className="mt-2 text-xs text-slate-400">{card.hint}</p> : null}
        </CardContent>
      </Card>
    ))}
  </div>
);

const SharedDashboardSnapshot = ({ snapshot }) => {
  const data = snapshot?.snapshot_data || {};
  const currency = data.currency || 'EUR';

  return (
    <div className="space-y-6">
      <SnapshotSummaryCards cards={data.summaryCards || []} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-400" />
              Revenus
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueData || []}>
                <defs>
                  <linearGradient id="sharedRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1f2937', color: '#fff' }}
                  formatter={(value) => formatCurrency(value, currency)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#sharedRevenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-cyan-400" />
              Top clients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.clientRevenueData || []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucune donnée client dans ce snapshot.</p>
            ) : (data.clientRevenueData || []).map((client) => (
              <div key={client.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{client.name}</p>
                  <p className="text-sm font-semibold text-cyan-300">{formatCurrency(client.amount, currency)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white">Dernières factures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.recentInvoices || []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucune facture récente dans ce snapshot.</p>
            ) : (data.recentInvoices || []).map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{invoice.label}</p>
                    <p className="text-xs text-slate-400">{invoice.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-300">{invoice.amountLabel}</p>
                    <Badge className="mt-2 bg-white/10 text-slate-200 border-white/10">{invoice.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-violet-400" />
              Derniers pointages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.recentTimesheets || []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucun temps récent dans ce snapshot.</p>
            ) : (data.recentTimesheets || []).map((timesheet) => (
              <div key={timesheet.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{timesheet.label}</p>
                    <p className="text-xs text-slate-400">{timesheet.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-violet-300">{timesheet.durationLabel}</p>
                    <p className="text-xs text-slate-500">{timesheet.dateLabel}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SharedAnalyticsSnapshot = ({ snapshot }) => {
  const data = snapshot?.snapshot_data || {};
  const currency = data.currency || 'EUR';
  const agingData = data.receivablesAging || [];

  return (
    <div className="space-y-6">
      <SnapshotSummaryCards cards={data.summaryCards || []} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white">Revenus vs charges</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueExpensesData || []}>
                <defs>
                  <linearGradient id="sharedAnalyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sharedAnalyticsExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1f2937', color: '#fff' }}
                  formatter={(value) => formatCurrency(value, currency)}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#sharedAnalyticsRevenue)" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#sharedAnalyticsExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Vieillissement encours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1f2937', color: '#fff' }}
                    formatter={(value) => formatCurrency(value, currency)}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {agingData.map((entry) => (
                      <Cell key={entry.name} fill={entry.tone || '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {(data.clientConcentration || []).map((client) => (
              <div key={client.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-white">{client.name}</span>
                  <span className="text-slate-300">{client.share}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-blue-400" style={{ width: `${Math.min(100, client.share)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white">Watchlist encours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.receivablesWatchlist || []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucun retard client dans ce snapshot.</p>
            ) : (data.receivablesWatchlist || []).map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.clientName}</p>
                    <p className="text-xs text-slate-400">{item.invoiceNumber} • échéance {item.dueDate}</p>
                  </div>
                  <Badge className="bg-red-500/10 text-red-300 border-red-500/20">{item.daysOverdue} j</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-orange-300">{formatCurrency(item.amount, currency)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-white">Projets les plus contributifs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.topProjects || []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucune donnée projet exploitable dans ce snapshot.</p>
            ) : (data.topProjects || []).map((project) => (
              <div key={project.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{project.name}</p>
                    <p className="text-xs text-slate-400">{project.hours.toFixed(1)} h travaillées</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-300">{formatCurrency(project.revenue, currency)}</p>
                    <p className="text-xs text-slate-500">
                      {project.revenuePerHour > 0 ? `${formatCurrency(project.revenuePerHour, currency)}/h` : 'Sans CA lié'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SharedSnapshotPage = () => {
  const { token } = useParams();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSnapshot = async () => {
      setLoading(true);
      setError('');

      try {
        const { data, error: snapshotError } = await supabase
          .from('dashboard_snapshots')
          .select('id, title, snapshot_type, snapshot_data, created_at, expires_at')
          .eq('share_token', token)
          .maybeSingle();

        if (snapshotError) throw snapshotError;
        if (!data) {
          setError('Ce lien de partage est introuvable ou a expiré.');
          setSnapshot(null);
          return;
        }

        setSnapshot(data);
      } catch (fetchError) {
        console.error('Error loading shared snapshot:', fetchError);
        setError(fetchError.message || 'Impossible de charger ce snapshot.');
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshot();
  }, [token]);

  const pageTitle = useMemo(() => {
    if (!snapshot) return 'Snapshot partagé - CashPilot';
    return `${snapshot.title} - CashPilot`;
  }, [snapshot]);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>

      <div className="min-h-screen bg-slate-950 text-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_35%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <Badge className="bg-white/10 text-orange-200 border-white/10">
                  <Link2 className="w-3.5 h-3.5 mr-1" />
                  Snapshot partagé
                </Badge>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                    {snapshot?.title || 'Chargement du snapshot'}
                  </h1>
                  <p className="mt-2 text-sm text-slate-300">
                    {snapshot?.snapshot_data?.companyName || 'CashPilot'} • généré le {formatDate(snapshot?.created_at)}
                  </p>
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {snapshot?.expires_at ? `Expire le ${formatDate(snapshot.expires_at)}` : 'Lien sans expiration'}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
          ) : error ? (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-8 text-center text-red-200">
                {error}
              </CardContent>
            </Card>
          ) : snapshot?.snapshot_type === 'analytics' ? (
            <SharedAnalyticsSnapshot snapshot={snapshot} />
          ) : (
            <SharedDashboardSnapshot snapshot={snapshot} />
          )}
        </div>
      </div>
    </>
  );
};

export default SharedSnapshotPage;
