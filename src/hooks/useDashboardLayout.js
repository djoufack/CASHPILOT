import { useState, useCallback } from 'react';
import { safeGetItem, safeSetItem } from '@/utils/storage';

const DEFAULT_WIDGETS = [
  { id: 'revenue', title: "Chiffre d'affaires", visible: true, order: 0 },
  { id: 'expenses', title: 'D\u00e9penses', visible: true, order: 1 },
  { id: 'invoices', title: 'Factures r\u00e9centes', visible: true, order: 2 },
  { id: 'cashflow', title: 'Tr\u00e9sorerie', visible: true, order: 3 },
  { id: 'alerts', title: 'Alertes', visible: true, order: 4 },
  { id: 'clients', title: 'Top Clients', visible: true, order: 5 },
];

export const useDashboardLayout = () => {
  const [widgets, setWidgets] = useState(() => {
    const saved = safeGetItem('cashpilot-dashboard-layout');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* ignore corrupted value */
      }
    }
    return DEFAULT_WIDGETS;
  });

  const saveLayout = useCallback((newWidgets) => {
    setWidgets(newWidgets);
    safeSetItem('cashpilot-dashboard-layout', JSON.stringify(newWidgets));
  }, []);

  const toggleWidget = useCallback(
    (widgetId) => {
      saveLayout(widgets.map((w) => (w.id === widgetId ? { ...w, visible: !w.visible } : w)));
    },
    [widgets, saveLayout]
  );

  const removeWidget = useCallback(
    (widgetId) => {
      saveLayout(widgets.map((w) => (w.id === widgetId ? { ...w, visible: false } : w)));
    },
    [widgets, saveLayout]
  );

  const resetLayout = useCallback(() => {
    saveLayout(DEFAULT_WIDGETS);
  }, [saveLayout]);

  const visibleWidgets = widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);

  return { widgets, visibleWidgets, toggleWidget, removeWidget, resetLayout };
};
