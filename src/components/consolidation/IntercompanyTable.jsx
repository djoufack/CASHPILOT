import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { formatCurrency } from '@/utils/calculations';
import { ArrowRight, Ban, CheckCircle2, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  pending: {
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  confirmed: {
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: CheckCircle2,
  },
  eliminated: {
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: Ban,
  },
};

const TYPE_LABELS = {
  invoice: 'consolidation.typeInvoice',
  payment: 'consolidation.typePayment',
  loan: 'consolidation.typeLoan',
  transfer: 'consolidation.typeTransfer',
};

const INTERCOMPANY_INFO = {
  title: 'Transactions inter-societes',
  definition: 'Tableau des flux entre sociétés du portefeuille consolidé.',
  dataSource: 'Liste `intercompanyTransactions` issue du hook `useConsolidation`.',
  formula: 'Total éliminations = somme des montants avec statut `confirmed` ou `eliminated`.',
  calculationMethod:
    'Affiche chaque flux source/cible avec type, statut et montant, puis calcule les totaux en pied de tableau.',
  notes: 'Les statuts permettent de distinguer les transactions en attente, confirmées et éliminées.',
};

export default function IntercompanyTable({ transactions = [], currency = 'EUR' }) {
  const { t } = useTranslation();

  const totalEliminations = transactions
    .filter((tx) => tx.status === 'eliminated' || tx.status === 'confirmed')
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  const totalAll = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);

  if (transactions.length === 0) {
    return (
      <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base inline-flex items-center gap-1.5">
            <PanelInfoPopover {...INTERCOMPANY_INFO} />
            <span>{t('consolidation.intercompanyTransactions')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-slate-400 text-center text-sm">{t('consolidation.noIntercompanyTransactions')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base inline-flex items-center gap-1.5">
            <PanelInfoPopover {...INTERCOMPANY_INFO} />
            <span>{t('consolidation.intercompanyTransactions')}</span>
          </CardTitle>
          <div className="text-xs text-slate-400">
            {t('consolidation.eliminationsTotal')}:{' '}
            <span className="text-emerald-400 font-semibold">{formatCurrency(totalEliminations, currency)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-slate-400 text-xs">{t('consolidation.source')}</TableHead>
              <TableHead className="text-slate-400 text-xs text-center" />
              <TableHead className="text-slate-400 text-xs">{t('consolidation.target')}</TableHead>
              <TableHead className="text-slate-400 text-xs text-right">{t('consolidation.amount')}</TableHead>
              <TableHead className="text-slate-400 text-xs">{t('consolidation.type')}</TableHead>
              <TableHead className="text-slate-400 text-xs">{t('common.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const statusCfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;

              return (
                <TableRow key={tx.id} className="border-white/5 hover:bg-white/5 transition-colors">
                  <TableCell className="text-white text-sm font-medium">
                    {tx.source_company?.company_name || tx.source_company?.name || tx.source_company_id?.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-center">
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 mx-auto" />
                  </TableCell>
                  <TableCell className="text-white text-sm font-medium">
                    {tx.target_company?.company_name || tx.target_company?.name || tx.target_company_id?.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-right text-white text-sm tabular-nums">
                    {formatCurrency(parseFloat(tx.amount) || 0, tx.currency || currency)}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-300">
                      {t(TYPE_LABELS[tx.transaction_type] || tx.transaction_type)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] font-medium px-2 py-0.5 gap-1 ${statusCfg.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {t(`consolidation.status_${tx.status}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="border-white/10 bg-white/5">
              <TableCell colSpan={3} className="text-xs text-slate-400 font-medium">
                {t('consolidation.total')} ({transactions.length} {t('consolidation.transactions')})
              </TableCell>
              <TableCell className="text-right text-white text-sm font-semibold tabular-nums">
                {formatCurrency(totalAll, currency)}
              </TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
