import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Save, Loader2, Mail, MessageSquare, Phone, FileText, Zap, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STRATEGY_OPTIONS = ['gentle', 'standard', 'aggressive', 'custom'];
const CHANNEL_OPTIONS = ['email', 'sms', 'whatsapp', 'letter'];
const TONE_OPTIONS = ['friendly', 'professional', 'firm', 'urgent'];

const CHANNEL_ICONS = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
  letter: FileText,
};

const STRATEGY_COLORS = {
  gentle: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  standard: 'from-purple-500/20 to-blue-500/20 border-purple-500/30',
  aggressive: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
  custom: 'from-emerald-500/20 to-blue-500/20 border-emerald-500/30',
};

/**
 * DunningCampaignForm - Form to create or edit a dunning campaign with templates.
 *
 * @param {{
 *   onSubmit: (campaign: object, templates: Array) => Promise<void>,
 *   onCancel: () => void,
 *   initialData?: object,
 *   loading?: boolean,
 * }} props
 */
const DunningCampaignForm = ({ onSubmit, onCancel, initialData = null, loading = false }) => {
  const { t } = useTranslation();

  const [form, setForm] = useState({
    name: initialData?.name || '',
    strategy: initialData?.strategy || 'standard',
    channels: initialData?.channels || ['email'],
    max_steps: initialData?.max_steps || 3,
    auto_escalate: initialData?.auto_escalate ?? true,
    is_active: initialData?.is_active ?? true,
  });

  const [templates, setTemplates] = useState(
    initialData?.templates || [
      { step_number: 1, channel: 'email', subject: '', body: '', tone: 'friendly', language: 'fr' },
    ]
  );

  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleChannelToggle = useCallback((channel) => {
    setForm((prev) => {
      const newChannels = prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels: newChannels.length > 0 ? newChannels : prev.channels };
    });
  }, []);

  const handleTemplateChange = useCallback((index, field, value) => {
    setTemplates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const addTemplate = useCallback(() => {
    setTemplates((prev) => [
      ...prev,
      {
        step_number: prev.length + 1,
        channel: 'email',
        subject: '',
        body: '',
        tone: 'professional',
        language: 'fr',
      },
    ]);
  }, []);

  const removeTemplate = useCallback((index) => {
    setTemplates((prev) => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((_, i) => i !== index)
        .map((tpl, i) => ({
          ...tpl,
          step_number: i + 1,
        }));
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit(form, templates);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {initialData
              ? t('dunning.campaignForm.editTitle', 'Modifier la campagne')
              : t('dunning.campaignForm.createTitle', 'Nouvelle campagne')}
          </h3>
        </div>
        <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Campaign Name */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1.5">
          {t('dunning.campaignForm.name', 'Nom de la campagne')} *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder={t('dunning.campaignForm.namePlaceholder', 'Ex: Relance clients premium')}
          className="w-full bg-[#0a0e1a]/60 border border-gray-800/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          required
        />
      </div>

      {/* Strategy Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          {t('dunning.campaignForm.strategy', 'Strategie')}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STRATEGY_OPTIONS.map((strategy) => (
            <button
              key={strategy}
              type="button"
              onClick={() => handleFieldChange('strategy', strategy)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                form.strategy === strategy
                  ? `bg-gradient-to-br ${STRATEGY_COLORS[strategy]} text-white`
                  : 'bg-[#0a0e1a]/60 border-gray-800/30 text-gray-500 hover:text-gray-300 hover:border-gray-700/50'
              }`}
            >
              {t(`dunning.strategies.${strategy}`, strategy)}
            </button>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          {t('dunning.campaignForm.channels', 'Canaux de communication')}
        </label>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((channel) => {
            const Icon = CHANNEL_ICONS[channel];
            const isSelected = form.channels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                onClick={() => handleChannelToggle(channel)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                    : 'bg-[#0a0e1a]/60 border-gray-800/30 text-gray-500 hover:text-gray-300 hover:border-gray-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`dunning.channels.${channel}`, channel)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Max Steps + Auto Escalate */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">
            {t('dunning.campaignForm.maxSteps', 'Nombre max de relances')}
          </label>
          <input
            type="number"
            value={form.max_steps}
            onChange={(e) => handleFieldChange('max_steps', parseInt(e.target.value, 10) || 1)}
            min={1}
            max={10}
            className="w-full bg-[#0a0e1a]/60 border border-gray-800/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.auto_escalate}
                onChange={(e) => handleFieldChange('auto_escalate', e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-10 h-5 rounded-full transition-colors ${
                  form.auto_escalate ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform mt-0.5 ${
                    form.auto_escalate ? 'translate-x-5.5 ml-1' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </div>
            <div>
              <span className="text-sm text-white block">
                {t('dunning.campaignForm.autoEscalate', 'Escalade auto')}
              </span>
              <span className="text-xs text-gray-500">
                {t('dunning.campaignForm.autoEscalateDesc', 'Passer au step suivant automatiquement')}
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Templates Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-400">
            {t('dunning.campaignForm.templates', 'Templates par etape')}
          </label>
          <button
            type="button"
            onClick={addTemplate}
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('dunning.campaignForm.addTemplate', 'Ajouter')}
          </button>
        </div>

        <div className="space-y-4">
          {templates.map((tpl, index) => (
            <div key={index} className="bg-[#0a0e1a]/60 rounded-xl p-4 border border-gray-800/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-white">
                    {t('dunning.campaignForm.stepLabel', 'Etape')} {tpl.step_number}
                  </span>
                </div>
                {templates.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTemplate(index)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Channel */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t('dunning.campaignForm.templateChannel', 'Canal')}
                  </label>
                  <select
                    value={tpl.channel}
                    onChange={(e) => handleTemplateChange(index, 'channel', e.target.value)}
                    className="w-full bg-[#141c33] border border-gray-800/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    {CHANNEL_OPTIONS.map((ch) => (
                      <option key={ch} value={ch}>
                        {t(`dunning.channels.${ch}`, ch)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t('dunning.campaignForm.templateTone', 'Ton')}
                  </label>
                  <select
                    value={tpl.tone}
                    onChange={(e) => handleTemplateChange(index, 'tone', e.target.value)}
                    className="w-full bg-[#141c33] border border-gray-800/50 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>
                        {t(`dunning.tones.${tone}`, tone)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject (only for email/letter) */}
              {(tpl.channel === 'email' || tpl.channel === 'letter') && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t('dunning.campaignForm.templateSubject', 'Objet')}
                  </label>
                  <input
                    type="text"
                    value={tpl.subject}
                    onChange={(e) => handleTemplateChange(index, 'subject', e.target.value)}
                    placeholder={t('dunning.campaignForm.subjectPlaceholder', 'Objet du message...')}
                    className="w-full bg-[#141c33] border border-gray-800/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              )}

              {/* Body */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {t('dunning.campaignForm.templateBody', 'Message')}
                </label>
                <textarea
                  value={tpl.body}
                  onChange={(e) => handleTemplateChange(index, 'body', e.target.value)}
                  placeholder={t(
                    'dunning.campaignForm.bodyPlaceholder',
                    'Utilisez {{client_name}}, {{invoice_number}}, {{balance_due}}, {{due_date}}, {{company_name}}'
                  )}
                  rows={3}
                  className="w-full bg-[#141c33] border border-gray-800/50 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800/30">
        <Button type="button" onClick={onCancel} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
          {t('common.cancel', 'Annuler')}
        </Button>
        <Button
          type="submit"
          disabled={submitting || loading || !form.name.trim()}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          {initialData
            ? t('dunning.campaignForm.update', 'Mettre a jour')
            : t('dunning.campaignForm.create', 'Creer la campagne')}
        </Button>
      </div>
    </form>
  );
};

export default DunningCampaignForm;
