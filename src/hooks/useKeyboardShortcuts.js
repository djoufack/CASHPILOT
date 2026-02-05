import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const SHORTCUTS = [
  { key: 'g+d', label: 'Dashboard', action: 'navigate', path: '/app' },
  { key: 'g+i', label: 'Factures', action: 'navigate', path: '/app/invoices' },
  { key: 'g+c', label: 'Clients', action: 'navigate', path: '/app/clients' },
  { key: 'g+q', label: 'Devis', action: 'navigate', path: '/app/quotes' },
  { key: 'g+e', label: 'D\u00e9penses', action: 'navigate', path: '/app/expenses' },
  { key: 'g+p', label: 'Produits', action: 'navigate', path: '/app/products' },
  { key: 'g+r', label: 'Projets', action: 'navigate', path: '/app/projects' },
  { key: 'n', label: 'Nouveau (contextuel)', action: 'custom', id: 'new' },
  { key: '/', label: 'Recherche', action: 'custom', id: 'search' },
  { key: '?', label: 'Raccourcis clavier', action: 'custom', id: 'shortcuts' },
  { key: 'Escape', label: 'Fermer', action: 'custom', id: 'close' },
];

export const useKeyboardShortcuts = (customHandlers = {}) => {
  const navigate = useNavigate();
  let pendingKey = null;
  let pendingTimeout = null;

  const handleKeyDown = useCallback((e) => {
    // Don't trigger in input fields
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.target.contentEditable === 'true') return;

    const key = e.key.toLowerCase();

    // Handle two-key combos (g+x)
    if (pendingKey === 'g') {
      clearTimeout(pendingTimeout);
      pendingKey = null;

      const shortcut = SHORTCUTS.find(s => s.key === `g+${key}`);
      if (shortcut && shortcut.action === 'navigate') {
        e.preventDefault();
        navigate(shortcut.path);
        return;
      }
    }

    if (key === 'g') {
      pendingKey = 'g';
      pendingTimeout = setTimeout(() => { pendingKey = null; }, 500);
      return;
    }

    // Handle single-key shortcuts
    const shortcut = SHORTCUTS.find(s => s.key === key || s.key === e.key);
    if (shortcut && shortcut.action === 'custom' && customHandlers[shortcut.id]) {
      e.preventDefault();
      customHandlers[shortcut.id]();
    }
  }, [navigate, customHandlers]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts: SHORTCUTS };
};

export const KEYBOARD_SHORTCUTS = SHORTCUTS;
