import React from 'react';
import { Link } from 'react-router-dom';
import { useAuditComptable } from '@/hooks/useAuditComptable';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ScoreGauge = ({ score, grade, size = 120 }) => {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{score}</span>
        <span className="text-xs font-medium" style={{ color }}>{grade}</span>
      </div>
    </div>
  );
};

const CategoryIndicator = ({ label, score }) => {
  const color = score >= 85 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400';
  const bgColor = score >= 85 ? 'bg-green-400/10' : score >= 70 ? 'bg-yellow-400/10' : 'bg-red-400/10';
  const Icon = score >= 85 ? CheckCircle : score >= 70 ? AlertTriangle : XCircle;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgColor}`}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-xs text-gray-300">{label}</span>
      <span className={`text-xs font-semibold ml-auto ${color}`}>{score}%</span>
    </div>
  );
};

const AccountingHealthWidget = () => {
  const { auditResult, loading, error } = useAuditComptable(true);

  if (loading && !auditResult) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-6 border border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Sante Comptable</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (error || !auditResult) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-6 border border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Sante Comptable</h3>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          {error || 'Lancez votre premier audit pour voir votre score.'}
        </p>
        <Link to="/app/audit-comptable">
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white w-full">
            Lancer l'audit <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </motion.div>
    );
  }

  const { score, grade, categories, summary } = auditResult;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Sante Comptable</h3>
        </div>
        <span className="text-xs text-gray-500">{summary.passed}/{summary.total_checks} ok</span>
      </div>
      <div className="flex items-center gap-6">
        <ScoreGauge score={score} grade={grade} />
        <div className="flex-1 space-y-2">
          {categories.balance && <CategoryIndicator label="Equilibre" score={categories.balance.score} />}
          {categories.fiscal && <CategoryIndicator label="Fiscal" score={categories.fiscal.score} />}
          {categories.anomalies && <CategoryIndicator label="Anomalies" score={categories.anomalies.score} />}
        </div>
      </div>
      <Link to="/app/audit-comptable" className="block mt-4">
        <Button size="sm" variant="outline" className="w-full border-gray-600 hover:bg-gray-700 text-gray-300">
          Audit complet <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </motion.div>
  );
};

export default AccountingHealthWidget;
