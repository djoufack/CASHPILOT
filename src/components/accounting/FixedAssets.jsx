import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Eye, Loader2, Building2, TrendingDown, Package } from 'lucide-react';
import { useFixedAssets } from '@/hooks/useFixedAssets';

const EMPTY_FORM = {
  asset_name: '',
  asset_type: 'tangible',
  category: '',
  acquisition_date: '',
  acquisition_cost: '',
  residual_value: '0',
  useful_life_years: '',
  depreciation_method: 'linear',
  account_code_asset: '2154',
  account_code_depreciation: '2815',
  account_code_expense: '6811',
};

const statusColor = (status) => {
  switch (status) {
    case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'disposed': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'fully_depreciated': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const statusLabel = (status, t) => {
  switch (status) {
    case 'active': return t('accounting.fixedAssets.statusActive');
    case 'disposed': return t('accounting.fixedAssets.statusDisposed');
    case 'fully_depreciated': return t('accounting.fixedAssets.statusFullyDepreciated');
    default: return status;
  }
};

const methodLabel = (method, t) => {
  switch (method) {
    case 'linear': return t('accounting.fixedAssets.linear');
    case 'declining': return t('accounting.fixedAssets.declining');
    default: return method;
  }
};

const typeLabel = (type, t) => {
  switch (type) {
    case 'tangible': return t('accounting.fixedAssets.tangible');
    case 'intangible': return t('accounting.fixedAssets.intangible');
    case 'financial': return t('accounting.fixedAssets.financial');
    default: return type;
  }
};

const fmtAmount = (amount) =>
  typeof amount === 'number'
    ? amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    : '—';

const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  } catch {
    return dateStr;
  }
};

// ─── Schedule Dialog ────────────────────────────────────────────────────────

const ScheduleDialog = ({ asset, fetchSchedule, postDepreciationEntry }) => {
  const { t } = useTranslation('translation');
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [postingId, setPostingId] = useState(null);

  const loadSchedule = async () => {
    setLoadingSchedule(true);
    try {
      const data = await fetchSchedule(asset.id);
      setSchedule(data);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleOpen = (val) => {
    setOpen(val);
    if (val) loadSchedule();
  };

  const handlePost = async (line) => {
    setPostingId(line.id);
    try {
      await postDepreciationEntry(asset, line);
      await loadSchedule();
    } finally {
      setPostingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white">
          <Eye className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-[#0f1528] border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-orange-400 flex items-center gap-2">
            <TrendingDown className="w-5 h-5" />
            {t('accounting.fixedAssets.schedule')} — {asset.asset_name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 text-sm">
            <p className="text-gray-500 text-xs mb-0.5">{t('accounting.fixedAssets.acquisitionCost')}</p>
            <p className="font-mono text-white font-semibold">{fmtAmount(asset.acquisition_cost)}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 text-sm">
            <p className="text-gray-500 text-xs mb-0.5">{t('accounting.fixedAssets.usefulLife')}</p>
            <p className="font-mono text-white font-semibold">{asset.useful_life_years} ans</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 text-sm">
            <p className="text-gray-500 text-xs mb-0.5">{t('accounting.fixedAssets.method')}</p>
            <p className="font-mono text-white font-semibold">{methodLabel(asset.depreciation_method, t)}</p>
          </div>
        </div>

        {loadingSchedule ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f1528] z-10">
                <tr className="border-b border-gray-700 text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-3">Période</th>
                  <th className="text-right py-2 px-3">Dotation</th>
                  <th className="text-right py-2 px-3">Amort. cumulé</th>
                  <th className="text-right py-2 px-3">VNC</th>
                  <th className="text-center py-2 px-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((line) => (
                  <tr
                    key={line.id}
                    className={`border-b border-gray-800/40 transition-colors ${
                      line.is_posted ? 'opacity-60' : 'hover:bg-gray-800/20'
                    }`}
                  >
                    <td className="py-1.5 px-3 font-mono text-gray-300">
                      {String(line.period_month).padStart(2, '0')}/{line.period_year}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-orange-300">
                      {fmtAmount(line.depreciation_amount)}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-gray-400">
                      {fmtAmount(line.accumulated_depreciation)}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-blue-300">
                      {fmtAmount(line.net_book_value)}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {line.is_posted ? (
                        <span className="text-emerald-400 text-[10px] font-medium">
                          {t('accounting.fixedAssets.posted')}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                          disabled={postingId === line.id}
                          onClick={() => handlePost(line)}
                        >
                          {postingId === line.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            t('accounting.fixedAssets.postEntry')
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {schedule.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Aucune ligne d'amortissement
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── New Asset Dialog ────────────────────────────────────────────────────────

const NewAssetDialog = ({ onCreate }) => {
  const { t } = useTranslation('translation');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreate({
        ...form,
        acquisition_cost: parseFloat(form.acquisition_cost),
        residual_value: parseFloat(form.residual_value || '0'),
        useful_life_years: parseInt(form.useful_life_years),
      });
      setForm(EMPTY_FORM);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-1.5" />
          {t('accounting.fixedAssets.newAsset')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-[#0f1528] border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-orange-400 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('accounting.fixedAssets.newAsset')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* asset_name */}
          <div className="space-y-1">
            <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.assetName')} *</Label>
            <Input
              required
              value={form.asset_name}
              onChange={(e) => handleChange('asset_name', e.target.value)}
              className="bg-gray-900/50 border-gray-700 text-white placeholder-gray-600"
              placeholder="Ex: Ordinateur portable"
            />
          </div>

          {/* asset_type + category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.assetType')} *</Label>
              <Select value={form.asset_type} onValueChange={(v) => handleChange('asset_type', v)}>
                <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1528] border-gray-700 text-white">
                  <SelectItem value="tangible">{t('accounting.fixedAssets.tangible')}</SelectItem>
                  <SelectItem value="intangible">{t('accounting.fixedAssets.intangible')}</SelectItem>
                  <SelectItem value="financial">{t('accounting.fixedAssets.financial')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.category')}</Label>
              <Input
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white placeholder-gray-600"
                placeholder="Ex: Informatique"
              />
            </div>
          </div>

          {/* acquisition_date + acquisition_cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.acquisitionDate')} *</Label>
              <Input
                required
                type="date"
                value={form.acquisition_date}
                onChange={(e) => handleChange('acquisition_date', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.acquisitionCost')} *</Label>
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.acquisition_cost}
                onChange={(e) => handleChange('acquisition_cost', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white placeholder-gray-600"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* residual_value + useful_life_years */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.residualValue')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.residual_value}
                onChange={(e) => handleChange('residual_value', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white placeholder-gray-600"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.usefulLife')} *</Label>
              <Input
                required
                type="number"
                min="1"
                step="1"
                value={form.useful_life_years}
                onChange={(e) => handleChange('useful_life_years', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white placeholder-gray-600"
                placeholder="5"
              />
            </div>
          </div>

          {/* depreciation_method */}
          <div className="space-y-1">
            <Label className="text-gray-300 text-sm">{t('accounting.fixedAssets.method')} *</Label>
            <Select value={form.depreciation_method} onValueChange={(v) => handleChange('depreciation_method', v)}>
              <SelectTrigger className="bg-gray-900/50 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1528] border-gray-700 text-white">
                <SelectItem value="linear">{t('accounting.fixedAssets.linear')}</SelectItem>
                <SelectItem value="declining">{t('accounting.fixedAssets.declining')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account codes */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">{t('accounting.fixedAssets.accountCodeAsset')}</Label>
              <Input
                value={form.account_code_asset}
                onChange={(e) => handleChange('account_code_asset', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">{t('accounting.fixedAssets.accountCodeDepreciation')}</Label>
              <Input
                value={form.account_code_depreciation}
                onChange={(e) => handleChange('account_code_depreciation', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">{t('accounting.fixedAssets.accountCodeExpense')}</Label>
              <Input
                value={form.account_code_expense}
                onChange={(e) => handleChange('account_code_expense', e.target.value)}
                className="bg-gray-900/50 border-gray-700 text-white font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 text-gray-300"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Créer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const FixedAssets = () => {
  const { t } = useTranslation('translation');
  const { assets, loading, fetchAssets, fetchSchedule, createAsset, postDepreciationEntry } = useFixedAssets();

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // KPI computations
  const totalGross = assets.reduce((s, a) => s + (parseFloat(a.acquisition_cost) || 0), 0);
  const totalNet = assets.reduce((s, a) => {
    const cost = parseFloat(a.acquisition_cost) || 0;
    const residual = parseFloat(a.residual_value) || 0;
    // VNC approximation: cost - accumulated based on status
    // We use acquisition_cost as gross; for a proper VNC we'd need the schedule
    // Here we just show acquisition_cost as gross
    return s + cost;
  }, 0);

  // For accumulated and net we derive from assets' implicit accumulated
  // Since we don't store accumulated on the asset directly, we approximate:
  const totalDepreciation = assets.reduce((s, a) => {
    const cost = parseFloat(a.acquisition_cost) || 0;
    const residual = parseFloat(a.residual_value) || 0;
    if (a.status === 'fully_depreciated') return s + (cost - residual);
    return s;
  }, 0);

  const totalNetValue = totalGross - totalDepreciation;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-orange-400 mr-3" />
        <span className="text-gray-400">Chargement des immobilisations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('accounting.fixedAssets.title')}
          </h2>
        </div>
        <NewAssetDialog onCreate={createAsset} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {t('accounting.fixedAssets.totalGross')}
            </p>
            <p className="text-2xl font-bold font-mono text-blue-400">
              {fmtAmount(totalGross)}
            </p>
            <p className="text-xs text-gray-600 mt-1">{assets.length} immobilisation{assets.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {t('accounting.fixedAssets.totalDepreciation')}
            </p>
            <p className="text-2xl font-bold font-mono text-orange-400">
              {fmtAmount(totalDepreciation)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Amortissements comptabilisés</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {t('accounting.fixedAssets.totalNet')}
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-400">
              {fmtAmount(totalNetValue)}
            </p>
            <p className="text-xs text-gray-600 mt-1">Valeur nette comptable</p>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-400" />
            Registre des immobilisations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {assets.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>Aucune immobilisation enregistrée.</p>
              <p className="text-xs mt-1">Cliquez sur «&nbsp;{t('accounting.fixedAssets.newAsset')}&nbsp;» pour commencer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 text-gray-500 uppercase text-[10px] tracking-wider">
                    <TableHead className="text-gray-500">{t('accounting.fixedAssets.assetName')}</TableHead>
                    <TableHead className="text-gray-500">{t('accounting.fixedAssets.assetType')}</TableHead>
                    <TableHead className="text-gray-500">{t('accounting.fixedAssets.acquisitionDate')}</TableHead>
                    <TableHead className="text-right text-gray-500">{t('accounting.fixedAssets.acquisitionCost')}</TableHead>
                    <TableHead className="text-right text-gray-500">{t('accounting.fixedAssets.netBookValue')}</TableHead>
                    <TableHead className="text-gray-500">{t('accounting.fixedAssets.method')}</TableHead>
                    <TableHead className="text-gray-500">{t('common.status')}</TableHead>
                    <TableHead className="text-gray-500">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => {
                    const cost = parseFloat(asset.acquisition_cost) || 0;
                    const residual = parseFloat(asset.residual_value) || 0;
                    // VNC approximate: for fully_depreciated use residual, else cost (schedule holds truth)
                    const vnc = asset.status === 'fully_depreciated' ? residual : cost;

                    return (
                      <TableRow
                        key={asset.id}
                        className="border-gray-800/40 hover:bg-gray-800/20 transition-colors"
                      >
                        <TableCell className="text-white font-medium text-sm">
                          {asset.asset_name}
                          {asset.category && (
                            <span className="block text-xs text-gray-500">{asset.category}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {typeLabel(asset.asset_type, t)}
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm font-mono">
                          {fmtDate(asset.acquisition_date)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-gray-200">
                          {fmtAmount(cost)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-blue-300">
                          {fmtAmount(vnc)}
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {methodLabel(asset.depreciation_method, t)}
                          <span className="block text-xs text-gray-500">{asset.useful_life_years} ans</span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor(asset.status)}`}
                          >
                            {statusLabel(asset.status, t)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ScheduleDialog
                            asset={asset}
                            fetchSchedule={fetchSchedule}
                            postDepreciationEntry={postDepreciationEntry}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FixedAssets;
