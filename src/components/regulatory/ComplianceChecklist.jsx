import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Calendar, User, Loader2 } from 'lucide-react';

/**
 * ComplianceChecklist - Checklist of action items with progress bar.
 *
 * @param {{ items: Array, onToggle: Function, loading: boolean }} props
 */
const ComplianceChecklist = ({ items, onToggle, loading }) => {
  const { t } = useTranslation();

  if (!items || items.length === 0) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-8 backdrop-blur-sm text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-60" />
        <h3 className="text-lg font-semibold text-white mb-1">
          {t('regulatory.checklist.empty', 'Aucune action requise')}
        </h3>
        <p className="text-sm text-gray-500">
          {t('regulatory.checklist.emptyDesc', 'Les actions de conformite apparaitront ici apres un scan.')}
        </p>
      </div>
    );
  }

  const completedCount = items.filter((item) => item.is_completed).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return formatDate(dateStr, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Group items by update
  const groupedByUpdate = items.reduce((acc, item) => {
    const updateTitle =
      item.regulatory_updates?.title || t('regulatory.checklist.unknownUpdate', 'Mise a jour inconnue');
    const updateId = item.update_id;
    const key = updateId || updateTitle;

    if (!acc[key]) {
      acc[key] = {
        title: updateTitle,
        severity: item.regulatory_updates?.severity || 'info',
        countryCode: item.regulatory_updates?.country_code || '',
        items: [],
      };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  const severityBorderColors = {
    info: 'border-l-blue-500/50',
    warning: 'border-l-amber-500/50',
    critical: 'border-l-red-500/50',
  };

  return (
    <div className="space-y-4">
      {/* Progress overview */}
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">{t('regulatory.checklist.progress', 'Progression')}</span>
          <span className="text-sm text-gray-400">
            {completedCount}/{totalCount} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-gray-800/50 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Grouped checklists */}
      {Object.entries(groupedByUpdate).map(([key, group]) => {
        const borderColor = severityBorderColors[group.severity] || severityBorderColors.info;
        const groupCompleted = group.items.filter((i) => i.is_completed).length;

        return (
          <div
            key={key}
            className={`bg-[#0f1528]/80 border border-gray-800/50 border-l-4 ${borderColor} rounded-2xl p-4 backdrop-blur-sm`}
          >
            {/* Group header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white truncate">{group.title}</h4>
                {group.countryCode && <span className="text-[10px] text-gray-500 mt-0.5">{group.countryCode}</span>}
              </div>
              <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                {groupCompleted}/{group.items.length}
              </span>
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
              {group.items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 group">
                  <button
                    onClick={() => onToggle?.(item.id, !item.is_completed)}
                    disabled={loading}
                    className="flex-shrink-0 mt-0.5 text-gray-500 hover:text-emerald-400 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : item.is_completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs leading-relaxed ${
                        item.is_completed ? 'text-gray-600 line-through' : 'text-gray-300'
                      }`}
                    >
                      {item.action_text}
                    </p>

                    <div className="flex items-center gap-3 mt-1">
                      {item.assigned_to && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                          <User className="w-2.5 h-2.5" />
                          {item.assigned_to}
                        </span>
                      )}
                      {item.due_date && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatDate(item.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ComplianceChecklist;
