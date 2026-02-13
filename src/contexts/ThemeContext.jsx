import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'cashpilot-theme';

/**
 * Resolves the effective theme based on the user's preference.
 * If 'system', it checks the OS preference.
 */
function resolveTheme(preference) {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export const ThemeProvider = ({ children }) => {
  // theme preference: 'light' | 'dark' | 'system'
  const [themePreference, setThemePreference] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || 'dark';
  });

  // resolved theme: 'light' | 'dark' (actual applied theme)
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(themePreference));

  // Apply theme class to document
  const applyTheme = useCallback((effectiveTheme) => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    setResolvedTheme(effectiveTheme);
  }, []);

  // Watch for preference changes
  useEffect(() => {
    const effective = resolveTheme(themePreference);
    applyTheme(effective);
    localStorage.setItem(STORAGE_KEY, themePreference);
  }, [themePreference, applyTheme]);

  // Watch for system theme changes when preference is 'system'
  useEffect(() => {
    if (themePreference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themePreference, applyTheme]);

  const setTheme = useCallback((newTheme) => {
    setThemePreference(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemePreference(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'dark';
      // If system, toggle to the opposite of current resolved
      return resolvedTheme === 'dark' ? 'light' : 'dark';
    });
  }, [resolvedTheme]);

  const isDark = resolvedTheme === 'dark';

  return (
    <ThemeContext.Provider value={{
      theme: themePreference,
      resolvedTheme,
      setTheme,
      toggleTheme,
      isDark
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
