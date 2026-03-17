import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { checkSupabaseConnection, validateSupabaseConfig } from '@/lib/supabase';
import { AuthStateContext } from '@/contexts/AuthStateContext';

/**
 * UserMetadataContext — handles user-metadata that changes less frequently
 * than core auth state: Supabase connection status and role helpers.
 *
 * Provided values:
 *   connectionStatus, checkConnection, hasRole
 *
 * This context reads the `user` from AuthStateContext.  Components that only
 * need connection status or role checks can subscribe here without being
 * affected by auth-state transitions (session refresh, loading toggling).
 */
const UserMetadataContext = createContext(null);

export const UserMetadataProvider = ({ children }) => {
  const authState = useContext(AuthStateContext);

  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    checking: true,
    error: null,
  });

  const performConnectionCheck = useCallback(async () => {
    setConnectionStatus((prev) => ({ ...prev, checking: true, error: null }));

    // First check static config
    const config = validateSupabaseConfig();
    if (!config.valid) {
      setConnectionStatus({
        connected: false,
        checking: false,
        error: `Configuration missing: ${config.missing}`,
      });
      return;
    }

    // Then check actual connection
    const result = await checkSupabaseConnection();
    setConnectionStatus({
      connected: result.connected,
      checking: false,
      error: result.error,
    });
  }, []);

  useEffect(() => {
    performConnectionCheck();
  }, [performConnectionCheck]);

  const hasRole = useCallback(
    (allowedRoles) => {
      const user = authState?.user;
      if (!user) return false;
      // Default to 'user' if role is missing, ensuring consistency with useUserRole hook
      const userRole = user.role || 'user';
      if (Array.isArray(allowedRoles)) return allowedRoles.includes(userRole);
      return allowedRoles === userRole;
    },
    [authState?.user]
  );

  const value = {
    connectionStatus,
    checkConnection: performConnectionCheck,
    hasRole,
  };

  return <UserMetadataContext.Provider value={value}>{children}</UserMetadataContext.Provider>;
};

/**
 * useUserMetadata — subscribe to user-metadata only.
 *
 * Returns { connectionStatus, checkConnection, hasRole }.
 */
export const useUserMetadata = () => {
  const context = useContext(UserMetadataContext);
  if (!context) {
    throw new Error('useUserMetadata must be used within a UserMetadataProvider');
  }
  return context;
};

export { UserMetadataContext };
