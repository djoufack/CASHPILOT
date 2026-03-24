import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Shield, Activity, Database } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { activeCompanyId, applyCompanyScope } = useCompanyScope();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    auditEvents: 0,
    healthRate: 100,
    entryCount: 0,
    teamDeltaLabel: '0',
  });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardData = async () => {
      if (!supabase || !activeCompanyId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);

      try {
        let usersCountQuery = supabase.from('team_members').select('id', { count: 'exact', head: true });
        usersCountQuery = applyCompanyScope(usersCountQuery);

        let entriesCountQuery = supabase.from('accounting_entries').select('id', { count: 'exact', head: true });
        entriesCountQuery = applyCompanyScope(entriesCountQuery);

        let auditRowsQuery = supabase
          .from('accounting_audit_log')
          .select('id, balance_ok, created_at')
          .gte('created_at', thirtyDaysAgo.toISOString());
        auditRowsQuery = applyCompanyScope(auditRowsQuery);

        let teamRowsQuery = supabase
          .from('team_members')
          .select('created_at, joined_at')
          .gte('created_at', sevenDaysAgo.toISOString());
        teamRowsQuery = applyCompanyScope(teamRowsQuery);

        const [usersCountRes, entriesCountRes, auditRowsRes, teamRowsRes] = await Promise.all([
          usersCountQuery,
          entriesCountQuery,
          auditRowsQuery,
          teamRowsQuery,
        ]);

        if (usersCountRes.error) throw usersCountRes.error;
        if (entriesCountRes.error) throw entriesCountRes.error;
        if (auditRowsRes.error) throw auditRowsRes.error;
        if (teamRowsRes.error) throw teamRowsRes.error;

        const auditRows = auditRowsRes.data || [];
        const teamRows = teamRowsRes.data || [];
        const balancedRows = auditRows.filter((row) => row.balance_ok !== false).length;
        const healthRate = auditRows.length > 0 ? (balancedRows / auditRows.length) * 100 : 100;

        const dayBuckets = [];
        for (let i = 6; i >= 0; i -= 1) {
          const d = new Date(now);
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          dayBuckets.push({
            key,
            name: d.toLocaleDateString(undefined, { weekday: 'short' }),
            users: 0,
            actions: 0,
          });
        }
        const bucketByKey = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));

        for (const row of teamRows) {
          const key = String(row.joined_at || row.created_at || '').slice(0, 10);
          const bucket = bucketByKey.get(key);
          if (bucket) bucket.users += 1;
        }
        for (const row of auditRows) {
          const key = String(row.created_at || '').slice(0, 10);
          const bucket = bucketByKey.get(key);
          if (bucket) bucket.actions += 1;
        }

        if (!cancelled) {
          setStats({
            totalUsers: usersCountRes.count || 0,
            auditEvents: auditRows.length,
            healthRate,
            entryCount: entriesCountRes.count || 0,
            teamDeltaLabel: `${teamRows.length >= 0 ? '+' : ''}${teamRows.length}`,
          });
          setChartData(dayBuckets);
        }
      } catch (_error) {
        if (!cancelled) {
          setStats({
            totalUsers: 0,
            auditEvents: 0,
            healthRate: 100,
            entryCount: 0,
            teamDeltaLabel: '0',
          });
          setChartData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, applyCompanyScope]);

  const healthLabel = useMemo(() => `${stats.healthRate.toFixed(1)}%`, [stats.healthRate]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">{t('admin.totalUsers')}</CardTitle>
            <Users className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">{loading ? '...' : stats.totalUsers}</div>
            <p className="text-xs text-gray-500">{loading ? '...' : `${stats.teamDeltaLabel} last 7 days`}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Audit Events</CardTitle>
            <Shield className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">{loading ? '...' : stats.auditEvents}</div>
            <p className="text-xs text-gray-500">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">{t('admin.systemHealth')}</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">{loading ? '...' : healthLabel}</div>
            <p className="text-xs text-gray-500">Balanced audit events</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Database</CardTitle>
            <Database className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">{loading ? '...' : stats.entryCount}</div>
            <p className="text-xs text-gray-500">Accounting entries</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-gradient">Activity Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="users" fill="#F59E0B" name="New Users" />
                <Bar dataKey="actions" fill="#84CC16" name="Actions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
