import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, ArrowRight, FileText, Upload, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

const PLAN_META = {
  FR: {
    flag: '\u{1F1EB}\u{1F1F7}',
    color: '#3B82F6',
    classes: [
      { code: '1', name: 'Comptes de capitaux' },
      { code: '2', name: 'Comptes d\'immobilisations' },
      { code: '3', name: 'Comptes de stocks' },
      { code: '4', name: 'Comptes de tiers' },
      { code: '5', name: 'Comptes financiers' },
      { code: '6', name: 'Comptes de charges' },
      { code: '7', name: 'Comptes de produits' },
    ],
  },
  BE: {
    flag: '\u{1F1E7}\u{1F1EA}',
    color: '#F59E0B',
    classes: [
      { code: '1', name: 'Fonds propres et provisions' },
      { code: '2', name: 'Frais d\'etablissement et immobilisations' },
      { code: '3', name: 'Stocks et commandes en cours' },
      { code: '4', name: 'Creances et dettes' },
      { code: '5', name: 'Placements et valeurs disponibles' },
      { code: '6', name: 'Charges' },
      { code: '7', name: 'Produits' },
    ],
  },
  OHADA: {
    flag: '\u{1F30D}',
    color: '#22C55E',
    classes: [
      { code: '1', name: 'Comptes de ressources durables' },
      { code: '2', name: 'Comptes d\'actif immobilise' },
      { code: '3', name: 'Comptes de stocks' },
      { code: '4', name: 'Comptes de tiers' },
      { code: '5', name: 'Comptes de tresorerie' },
      { code: '6', name: 'Comptes de charges des activites' },
      { code: '7', name: 'Comptes de produits des activites' },
    ],
  },
};

const Step3AccountingPlan = ({ onNext, onBack, wizardData, updateWizardData }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(wizardData.selectedPlanId);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewPlan, setPreviewPlan] = useState(null);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('accounting_plans')
        .select('*')
        .or(`is_global.eq.true,uploaded_by.eq.${user?.id}`)
        .eq('status', 'active')
        .order('created_at');
      if (!error && data) setPlans(data);
      setLoading(false);
    };
    fetchPlans();
  }, [user]);

  const handleSelect = (plan) => {
    setSelectedPlanId(plan.id);
    updateWizardData('selectedPlanId', plan.id);
    updateWizardData('selectedPlanCountry', plan.country_code);
    // Toggle preview
    setPreviewPlan(previewPlan === plan.country_code ? null : plan.country_code);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    parseFile(file);
  };

  const parseFile = async (file) => {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const separator = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ',';
    const rows = lines.map(l => l.split(separator).map(c => c.trim().replace(/^"|"$/g, '')));

    if (rows.length < 2) return;
    const header = rows[0].map(h => h.toLowerCase());
    const codeIdx = header.findIndex(h => ['code', 'numero', 'num\u00e9ro', 'account_code'].includes(h));
    const nameIdx = header.findIndex(h => ['nom', 'libelle', 'libell\u00e9', 'name', 'account_name'].includes(h));
    const typeIdx = header.findIndex(h => ['type', 'classe', 'account_type'].includes(h));

    if (codeIdx === -1 || nameIdx === -1) return;

    const accounts = rows.slice(1).map(row => ({
      account_code: row[codeIdx] || '',
      account_name: row[nameIdx] || '',
      account_type: typeIdx >= 0 ? mapAccountType(row[typeIdx]) : inferType(row[codeIdx]),
    })).filter(a => a.account_code && a.account_name);

    setUploadPreview(accounts);
  };

  const mapAccountType = (raw) => {
    const v = (raw || '').toLowerCase();
    if (['asset', 'actif'].includes(v)) return 'asset';
    if (['liability', 'passif'].includes(v)) return 'liability';
    if (['equity', 'capitaux'].includes(v)) return 'equity';
    if (['revenue', 'produit', 'produits'].includes(v)) return 'revenue';
    if (['expense', 'charge', 'charges'].includes(v)) return 'expense';
    return 'asset';
  };

  const inferType = (code) => {
    if (!code) return 'asset';
    const c = code.charAt(0);
    if (['1'].includes(c)) return 'equity';
    if (['2', '3', '5'].includes(c)) return 'asset';
    if (['4'].includes(c)) return 'liability';
    if (['6'].includes(c)) return 'expense';
    if (['7'].includes(c)) return 'revenue';
    return 'asset';
  };

  const handleUploadConfirm = async () => {
    if (!uploadPreview || !supabase || !user) return;
    setUploading(true);
    try {
      const { data: plan, error: planErr } = await supabase
        .from('accounting_plans')
        .insert({
          name: uploadFile.name.replace(/\.\w+$/, ''),
          source: 'user_upload',
          uploaded_by: user.id,
          is_global: false,
          accounts_count: uploadPreview.length,
          status: 'active',
        })
        .select()
        .single();

      if (planErr) throw planErr;

      const accounts = uploadPreview.map(a => ({
        plan_id: plan.id,
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
      }));

      const batchSize = 200;
      for (let i = 0; i < accounts.length; i += batchSize) {
        await supabase.from('accounting_plan_accounts').insert(accounts.slice(i, i + batchSize));
      }

      setPlans(prev => [...prev, plan]);
      setSelectedPlanId(plan.id);
      updateWizardData('selectedPlanId', plan.id);
      updateWizardData('selectedPlanCountry', null);
      setShowUpload(false);
      setUploadPreview(null);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    if (selectedPlanId) onNext();
  };

  return (
    <div className="space-y-6" role="region" aria-label={t('onboarding.plan.title', 'Choisissez votre plan comptable')}>
      <div className="text-center space-y-1">
        <div
          className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center"
          style={{ background: 'rgba(59, 130, 246, 0.15)' }}
        >
          <FileText className="w-6 h-6" style={{ color: '#3B82F6' }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: '#e8eaf0' }}>
          {t('onboarding.plan.title', 'Choisissez votre plan comptable')}
        </h2>
        <p className="text-sm" style={{ color: '#8b92a8' }}>
          {t('onboarding.plan.subtitle', 'Selectionnez le plan adapte a votre pays ou importez le votre.')}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#DAA520' }} />
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map(plan => {
            const meta = PLAN_META[plan.country_code];
            const isSelected = selectedPlanId === plan.id;
            const showPreview = isSelected && previewPlan === plan.country_code && meta;

            return (
              <div key={plan.id}>
                <button
                  onClick={() => handleSelect(plan)}
                  className="w-full text-left p-4 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#DAA520]/50"
                  style={{
                    background: isSelected ? 'rgba(218, 165, 32, 0.08)' : 'rgba(15, 21, 40, 0.5)',
                    border: isSelected ? '1px solid rgba(218, 165, 32, 0.4)' : '1px solid #1e293b',
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${plan.name} - ${plan.description || plan.accounts_count + ' comptes'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{meta?.flag || '\u{1F4C4}'}</span>
                      <div>
                        <h3 className="font-medium text-sm" style={{ color: '#e8eaf0' }}>{plan.name}</h3>
                        <p className="text-xs mt-0.5" style={{ color: '#8b92a8' }}>
                          {plan.description || `${plan.accounts_count} comptes`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelected && <CheckCircle2 className="w-5 h-5" style={{ color: '#DAA520' }} />}
                      {meta && isSelected && (
                        showPreview
                          ? <ChevronUp className="w-4 h-4" style={{ color: '#8b92a8' }} />
                          : <ChevronDown className="w-4 h-4" style={{ color: '#8b92a8' }} />
                      )}
                    </div>
                  </div>
                </button>

                {/* Preview of main classes */}
                {showPreview && (
                  <div
                    className="mx-2 mt-1 p-3 rounded-lg space-y-1.5"
                    style={{ background: 'rgba(15, 21, 40, 0.4)', border: '1px solid rgba(30, 41, 59, 0.5)' }}
                  >
                    <p className="text-xs font-medium mb-2" style={{ color: '#8b92a8' }}>
                      {t('onboarding.plan.mainClasses', 'Classes principales :')}
                    </p>
                    {meta.classes.map(cls => (
                      <div key={cls.code} className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center shrink-0"
                          style={{ background: `${meta.color}20`, color: meta.color }}
                        >
                          {cls.code}
                        </span>
                        <span className="text-xs" style={{ color: '#e8eaf0' }}>{cls.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Upload custom plan */}
          {!showUpload ? (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full text-left p-4 rounded-xl border border-dashed transition-all hover:border-[#8b92a8] focus:outline-none focus:ring-2 focus:ring-[#DAA520]/50"
              style={{ borderColor: '#1e293b', background: 'rgba(15, 21, 40, 0.3)' }}
            >
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5" style={{ color: '#8b92a8' }} />
                <div>
                  <h3 className="font-medium text-sm" style={{ color: '#8b92a8' }}>
                    {t('onboarding.plan.import', 'Importer mon plan comptable')}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: '#8b92a8' }}>CSV ou Excel (.xlsx, .csv)</p>
                </div>
              </div>
            </button>
          ) : (
            <div
              className="p-4 rounded-xl space-y-4"
              style={{ background: 'rgba(15, 21, 40, 0.5)', border: '1px solid #1e293b' }}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-medium file:cursor-pointer"
                style={{ color: '#8b92a8' }}
                aria-label={t('onboarding.plan.uploadFile', 'Choisir un fichier a importer')}
              />
              <p className="text-xs" style={{ color: '#8b92a8' }}>
                Colonnes attendues : <code style={{ color: '#e8eaf0' }}>code</code>, <code style={{ color: '#e8eaf0' }}>nom</code>, <code style={{ color: '#e8eaf0' }}>type</code> (optionnel)
              </p>
              {uploadPreview && (
                <div className="space-y-2">
                  <p className="text-sm" style={{ color: '#22C55E' }}>{uploadPreview.length} comptes detectes</p>
                  <div
                    className="max-h-32 overflow-y-auto text-xs rounded p-2 space-y-1"
                    style={{ background: 'rgba(10, 14, 26, 0.5)' }}
                  >
                    {uploadPreview.slice(0, 8).map((a, i) => (
                      <div key={i} className="flex justify-between" style={{ color: '#8b92a8' }}>
                        <span>{a.account_code} - {a.account_name}</span>
                        <span style={{ color: '#4b5563' }}>{a.account_type}</span>
                      </div>
                    ))}
                    {uploadPreview.length > 8 && (
                      <p style={{ color: '#4b5563' }}>... et {uploadPreview.length - 8} autres</p>
                    )}
                  </div>
                  <Button
                    onClick={handleUploadConfirm}
                    disabled={uploading}
                    size="sm"
                    className="w-full text-white"
                    style={{ background: 'linear-gradient(135deg, #DAA520, #22C55E)' }}
                  >
                    {uploading ? 'Import en cours...' : `Importer ${uploadPreview.length} comptes`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="hover:text-[#e8eaf0] focus:ring-2 focus:ring-[#DAA520]/40"
          style={{ color: '#8b92a8' }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('onboarding.back', 'Retour')}
        </Button>
        <Button
          onClick={handleNext}
          disabled={!selectedPlanId}
          className="text-white font-medium focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e1a] focus:ring-[#DAA520]"
          style={{
            background: selectedPlanId ? 'linear-gradient(135deg, #DAA520, #22C55E)' : '#1e293b',
            opacity: selectedPlanId ? 1 : 0.5,
          }}
        >
          {t('onboarding.next', 'Suivant')} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default Step3AccountingPlan;
