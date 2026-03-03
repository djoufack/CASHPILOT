
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { Plus, Trash2, RefreshCw, BarChart2 } from 'lucide-react';

// Axis type options
const AXIS_TYPES = [
  { value: 'cost_center', label: 'Centre de coût' },
  { value: 'department', label: 'Département' },
  { value: 'product_line', label: 'Ligne de produit' },
  { value: 'project', label: 'Projet' },
  { value: 'custom', label: 'Personnalisé' },
];

export default function AnalyticalAccounting() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope } = useCompanyScope();

  const [axes, setAxes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeAxisType, setActiveAxisType] = useState('cost_center');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // New axis form
  const [form, setForm] = useState({
    axis_type: 'cost_center',
    axis_code: '',
    axis_name: '',
    color: '#6366f1',
  });

  const fetchAxes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounting_analytical_axes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('axis_type')
        .order('axis_code');
      if (error) throw error;
      setAxes(data || []);
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setReportLoading(true);
    try {
      const columnMap = {
        cost_center: 'cost_center',
        department: 'department',
        product_line: 'product_line',
      };
      const col = columnMap[activeAxisType] || 'cost_center';

      let query = supabase
        .from('accounting_entries')
        .select(`account_code, debit, credit, ${col}`)
        .eq('user_id', user.id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .not(col, 'is', null);
      query = applyCompanyScope(query, { includeUnassigned: false });
      const { data, error } = await query;
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      toast({ title: 'Erreur rapport', description: err.message, variant: 'destructive' });
    } finally {
      setReportLoading(false);
    }
  }, [applyCompanyScope, user, activeAxisType, startDate, endDate, toast]);

  useEffect(() => {
    fetchAxes();
  }, [fetchAxes]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreateAxis = async () => {
    if (!form.axis_code.trim() || !form.axis_name.trim()) return;
    try {
      const { error } = await supabase
        .from('accounting_analytical_axes')
        .insert({ ...form, user_id: user.id });
      if (error) throw error;
      toast({ title: 'Axe créé', description: form.axis_name });
      setDialogOpen(false);
      setForm({ axis_type: 'cost_center', axis_code: '', axis_name: '', color: '#6366f1' });
      fetchAxes();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteAxis = async (id) => {
    try {
      await supabase.from('accounting_analytical_axes').update({ is_active: false }).eq('id', id);
      toast({ title: 'Axe supprimé' });
      fetchAxes();
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  // Aggregate entries by axis value for chart
  const chartData = (() => {
    const colMap = { cost_center: 'cost_center', department: 'department', product_line: 'product_line' };
    const col = colMap[activeAxisType] || 'cost_center';
    const groups = {};
    entries.forEach(entry => {
      const key = entry[col] || 'Non affecté';
      if (!groups[key]) groups[key] = { name: key, debit: 0, credit: 0 };
      groups[key].debit += parseFloat(entry.debit || 0);
      groups[key].credit += parseFloat(entry.credit || 0);
    });
    return Object.values(groups).map(g => ({
      ...g,
      debit: Math.round(g.debit * 100) / 100,
      credit: Math.round(g.credit * 100) / 100,
      solde: Math.round((g.debit - g.credit) * 100) / 100,
    }));
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">{t('accounting.analytique.title', 'Comptabilité analytique')}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {t('accounting.analytique.newAxis', 'Nouvel axe')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0f1528] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>{t('accounting.analytique.newAxis', 'Nouvel axe analytique')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t('accounting.analytique.axisType', "Type d'axe")}</Label>
                <Select value={form.axis_type} onValueChange={v => setForm(f => ({ ...f, axis_type: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1528] border-white/10">
                    {AXIS_TYPES.map(at => (
                      <SelectItem key={at.value} value={at.value} className="text-white hover:bg-white/10">
                        {at.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('accounting.analytique.axisCode', 'Code')}</Label>
                <Input
                  value={form.axis_code}
                  onChange={e => setForm(f => ({ ...f, axis_code: e.target.value }))}
                  placeholder="COMM, TECH, ..."
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('accounting.analytique.axisName', 'Libellé')}</Label>
                <Input
                  value={form.axis_name}
                  onChange={e => setForm(f => ({ ...f, axis_name: e.target.value }))}
                  placeholder="Commercial, Technique, ..."
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button className="flex-1" onClick={handleCreateAxis} disabled={!form.axis_code || !form.axis_name}>
                  Créer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Axis type tabs */}
      <div className="flex gap-2 flex-wrap">
        {AXIS_TYPES.slice(0, 3).map(at => (
          <button
            key={at.value}
            onClick={() => setActiveAxisType(at.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeAxisType === at.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {at.label}
          </button>
        ))}
      </div>

      {/* Axes table */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">
            {AXIS_TYPES.find(a => a.value === activeAxisType)?.label || 'Axes'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-400 text-sm py-4 text-center">Chargement...</p>
          ) : axes.filter(a => a.axis_type === activeAxisType).length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Aucun axe défini. Créez-en un avec le bouton ci-dessus.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-gray-400">Code</TableHead>
                  <TableHead className="text-gray-400">Libellé</TableHead>
                  <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {axes.filter(a => a.axis_type === activeAxisType).map(axis => (
                  <TableRow key={axis.id} className="border-white/5">
                    <TableCell>
                      <Badge
                        className="font-mono text-xs"
                        style={{ backgroundColor: axis.color + '33', color: axis.color, borderColor: axis.color + '55' }}
                      >
                        {axis.axis_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white">{axis.axis_name}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAxis(axis.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Analytical report */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4" />
              {t('accounting.analytique.report', 'Rapport analytique')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-white/5 border-white/20 text-white h-7 text-xs w-36"
              />
              <span className="text-gray-500 text-xs">→</span>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-white/5 border-white/20 text-white h-7 text-xs w-36"
              />
              <Button size="sm" variant="ghost" onClick={fetchEntries} className="h-7 w-7 p-0 text-gray-400">
                <RefreshCw className={`w-3.5 h-3.5 ${reportLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              {reportLoading ? 'Chargement...' : 'Aucune écriture avec axe analytique sur cette période.'}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1528',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(v) => [`${v.toLocaleString('fr-FR')} €`]}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Bar dataKey="debit" name="Débit" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="credit" name="Crédit" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartData.length > 0 && (
            <Table className="mt-4">
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-gray-400">Axe</TableHead>
                  <TableHead className="text-gray-400 text-right">Débit</TableHead>
                  <TableHead className="text-gray-400 text-right">Crédit</TableHead>
                  <TableHead className="text-gray-400 text-right">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((row, i) => (
                  <TableRow key={i} className="border-white/5">
                    <TableCell className="text-white font-medium">{row.name}</TableCell>
                    <TableCell className="text-right text-red-400">{row.debit.toLocaleString('fr-FR')} €</TableCell>
                    <TableCell className="text-right text-green-400">{row.credit.toLocaleString('fr-FR')} €</TableCell>
                    <TableCell className={`text-right font-semibold ${row.solde >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {row.solde.toLocaleString('fr-FR')} €
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
