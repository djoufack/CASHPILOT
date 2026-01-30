
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthSource } from '@/hooks/useAuth';
import { checkSupabaseConnection, validateSupabaseConfig } from '@/lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const auth = useAuthSource();
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    checking: true,
    error: null
  });

  const performConnectionCheck = async () => {
    setConnectionStatus(prev => ({ ...prev, checking: true, error: null }));
    
    // First check static config
    const config = validateSupabaseConfig();
    if (!config.valid) {
      setConnectionStatus({
        connected: false,
        checking: false,
        error: `Configuration missing: ${config.missing}`
      });
      return;
    }

    // Then check actual connection
    const result = await checkSupabaseConnection();
    setConnectionStatus({
      connected: result.connected,
      checking: false,
      error: result.error
    });
  };

  useEffect(() => {
    performConnectionCheck();
  }, []);

  // Safe auth object fallback
  const safeAuth = auth || {
    user: null,
    loading: true,
    isAuthenticated: false,
    signIn: async () => { throw new Error("Auth not initialized"); },
    signUp: async () => { throw new Error("Auth not initialized"); },
    logout: async () => { },
  };

  const contextValue = {
    ...safeAuth,
    connectionStatus,
    checkConnection: performConnectionCheck,
    hasRole: (allowedRoles) => {
        if (!safeAuth.user) return false;
        // Default to 'user' if role is missing, ensuring consistency with useUserRole hook
        const userRole = safeAuth.user.role || 'user';
        if (Array.isArray(allowedRoles)) return allowedRoles.includes(userRole);
        return allowedRoles === userRole;
    }
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
