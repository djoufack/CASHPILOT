import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const ThemeContext = createContext();

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
  const { user, updateProfile } = useAuth();
  const normalizeThemePreference = useCallback((value) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }
    return 'dark';
  }, []);

  // theme preference: 'light' | 'dark' | 'system'
  const [themePreference, setThemePreference] = useState(() => normalizeThemePreference(user?.theme_preference));

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
  }, [themePreference, applyTheme]);

  useEffect(() => {
    setThemePreference(normalizeThemePreference(user?.theme_preference));
  }, [normalizeThemePreference, user?.id, user?.theme_preference]);

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
    const nextTheme = normalizeThemePreference(newTheme);
    setThemePreference(nextTheme);

    if (user?.id) {
      updateProfile({ theme_preference: nextTheme }, { silent: true }).catch((error) => {
        console.error('Failed to persist theme preference:', error);
      });
    }
  }, [normalizeThemePreference, updateProfile, user?.id]);

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
