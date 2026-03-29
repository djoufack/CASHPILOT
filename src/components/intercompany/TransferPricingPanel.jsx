import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/utils/dateLocale';

const PRICING_METHODS = ['cost_plus', 'comparable', 'resale_minus', 'custom'];

const emptyRule = {
  service_type: '',
  pricing_method: 'cost_plus',
  margin_percent: 0,
  min_amount: 0,
  max_amount: 0,
  is_active: true,
};

const TransferPricingPanel = ({ rules, onUpdate, onDelete, onAdd }) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ ...emptyRule });

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setEditForm({ ...rule });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    await onUpdate(editForm);
    setEditingId(null);
    setEditForm({});
  };

  const startAdd = () => {
    setAdding(true);
    setNewForm({ ...emptyRule });
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewForm({ ...emptyRule });
  };

  const saveAdd = async () => {
    await onAdd(newForm);
    setAdding(false);
    setNewForm({ ...emptyRule });
  };

  const renderMethodLabel = (method) => t(`intercompany.pricingMethod.${method}`, method);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          {t('intercompany.pricing.title', 'Regles de prix de transfert')}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={startAdd}
          disabled={adding}
          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 gap-1"
        >
          <Plus className="w-4 h-4" />
          {t('common.create', 'Creer')}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-400 font-medium py-2 px-3">
                {t('intercompany.pricing.serviceType', 'Type de service')}
              </th>
              <th className="text-left text-gray-400 font-medium py-2 px-3">
                {t('intercompany.pricing.method', 'Methode')}
              </th>
              <th className="text-right text-gray-400 font-medium py-2 px-3">
                {t('intercompany.pricing.margin', 'Marge %')}
              </th>
              <th className="text-right text-gray-400 font-medium py-2 px-3">
                {t('intercompany.pricing.minAmount', 'Min')}
              </th>
              <th className="text-right text-gray-400 font-medium py-2 px-3">
                {t('intercompany.pricing.maxAmount', 'Max')}
              </th>
              <th className="text-center text-gray-400 font-medium py-2 px-3">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {/* Add row */}
            {adding && (
              <tr className="border-b border-white/5 bg-blue-500/5">
                <td className="py-2 px-3">
                  <input
                    type="text"
                    value={newForm.service_type}
                    onChange={(e) => setNewForm((f) => ({ ...f, service_type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm"
                    placeholder={t('intercompany.pricing.serviceTypePlaceholder', 'Ex: Conseil IT')}
                  />
                </td>
                <td className="py-2 px-3">
                  <select
                    value={newForm.pricing_method}
                    onChange={(e) => setNewForm((f) => ({ ...f, pricing_method: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm"
                  >
                    {PRICING_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {renderMethodLabel(m)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    step="0.01"
                    value={newForm.margin_percent}
                    onChange={(e) => setNewForm((f) => ({ ...f, margin_percent: e.target.value }))}
                    className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    step="0.01"
                    value={newForm.min_amount}
                    onChange={(e) => setNewForm((f) => ({ ...f, min_amount: e.target.value }))}
                    className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    step="0.01"
                    value={newForm.max_amount}
                    onChange={(e) => setNewForm((f) => ({ ...f, max_amount: e.target.value }))}
                    className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={saveAdd}
                      disabled={!newForm.service_type.trim()}
                      className="p-1 rounded hover:bg-green-500/10 text-green-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelAdd} className="p-1 rounded hover:bg-red-500/10 text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Existing rows */}
            {(!rules || rules.length === 0) && !adding && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-400 text-sm">
                  {t('intercompany.pricing.empty', 'Aucune regle de prix de transfert.')}
                </td>
              </tr>
            )}

            {(rules || []).map((rule) => {
              const isEditing = editingId === rule.id;

              if (isEditing) {
                return (
                  <tr key={rule.id} className="border-b border-white/5 bg-blue-500/5">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={editForm.service_type}
                        onChange={(e) => setEditForm((f) => ({ ...f, service_type: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={editForm.pricing_method}
                        onChange={(e) => setEditForm((f) => ({ ...f, pricing_method: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm"
                      >
                        {PRICING_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {renderMethodLabel(m)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.margin_percent}
                        onChange={(e) => setEditForm((f) => ({ ...f, margin_percent: e.target.value }))}
                        className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.min_amount}
                        onChange={(e) => setEditForm((f) => ({ ...f, min_amount: e.target.value }))}
                        className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.max_amount}
                        onChange={(e) => setEditForm((f) => ({ ...f, max_amount: e.target.value }))}
                        className="w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={saveEdit} className="p-1 rounded hover:bg-green-500/10 text-green-400">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 rounded hover:bg-red-500/10 text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={rule.id} className={`border-b border-white/5 ${!rule.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-2 px-3 text-white">{rule.service_type}</td>
                  <td className="py-2 px-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                      {renderMethodLabel(rule.pricing_method)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-white font-mono">
                    {Number(rule.margin_percent).toFixed(2)}%
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300 font-mono">
                    {formatNumber(Number(rule.min_amount), { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300 font-mono">
                    {formatNumber(Number(rule.max_amount), { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(rule)}
                        className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(rule.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransferPricingPanel;
