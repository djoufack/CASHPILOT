import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, ArrowRight, FileText, Upload, CheckCircle2 } from 'lucide-react';

const FLAG_EMOJIS = { FR: '\u{1F1EB}\u{1F1F7}', BE: '\u{1F1E7}\u{1F1EA}', OHADA: '\u{1F30D}' };

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
    const codeIdx = header.findIndex(h => ['code', 'numero', 'numéro', 'account_code'].includes(h));
    const nameIdx = header.findIndex(h => ['nom', 'libelle', 'libellé', 'name', 'account_name'].includes(h));
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
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <FileText className="w-8 h-8 text-blue-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">
          {t('onboarding.plan.title', 'Choisissez votre plan comptable')}
        </h2>
        <p className="text-gray-400 text-sm">
          {t('onboarding.plan.subtitle', 'Sélectionnez le plan adapté à votre pays ou importez le vôtre.')}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : (
        <div className="grid gap-3">
          {plans.map(plan => (
            <button
              key={plan.id}
              onClick={() => handleSelect(plan)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedPlanId === plan.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{FLAG_EMOJIS[plan.country_code] || '\u{1F4C4}'}</span>
                  <div>
                    <h3 className="text-white font-medium text-sm">{plan.name}</h3>
                    <p className="text-gray-500 text-xs mt-0.5">{plan.description || `${plan.accounts_count} comptes`}</p>
                  </div>
                </div>
                {selectedPlanId === plan.id && <CheckCircle2 className="w-5 h-5 text-orange-400" />}
              </div>
            </button>
          ))}

          {/* Upload custom plan */}
          {!showUpload ? (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full text-left p-4 rounded-xl border border-dashed border-gray-600 bg-gray-800/30 hover:border-gray-500 transition-all"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-gray-400" />
                <div>
                  <h3 className="text-gray-300 font-medium text-sm">
                    {t('onboarding.plan.import', 'Importer mon plan comptable')}
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5">CSV ou Excel (.xlsx, .csv)</p>
                </div>
              </div>
            </button>
          ) : (
            <div className="p-4 rounded-xl border border-gray-600 bg-gray-800/50 space-y-4">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500/20 file:text-orange-400 file:font-medium file:cursor-pointer"
              />
              <p className="text-xs text-gray-500">
                Colonnes attendues : <code className="text-gray-400">code</code>, <code className="text-gray-400">nom</code>, <code className="text-gray-400">type</code> (optionnel)
              </p>
              {uploadPreview && (
                <div className="space-y-2">
                  <p className="text-sm text-green-400">{uploadPreview.length} comptes détectés</p>
                  <div className="max-h-32 overflow-y-auto text-xs bg-gray-900/50 rounded p-2 space-y-1">
                    {uploadPreview.slice(0, 8).map((a, i) => (
                      <div key={i} className="flex justify-between text-gray-400">
                        <span>{a.account_code} - {a.account_name}</span>
                        <span className="text-gray-600">{a.account_type}</span>
                      </div>
                    ))}
                    {uploadPreview.length > 8 && (
                      <p className="text-gray-600">... et {uploadPreview.length - 8} autres</p>
                    )}
                  </div>
                  <Button onClick={handleUploadConfirm} disabled={uploading} size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full">
                    {uploading ? 'Import en cours...' : `Importer ${uploadPreview.length} comptes`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('onboarding.back', 'Retour')}
        </Button>
        <Button onClick={handleNext} disabled={!selectedPlanId} className="bg-orange-500 hover:bg-orange-600 text-white">
          {t('onboarding.next', 'Suivant')} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default Step3AccountingPlan;
