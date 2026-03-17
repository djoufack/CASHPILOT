import { createContext, useContext } from 'react';
import { useAuthSource } from '@/hooks/useAuth';

/**
 * AuthStateContext — handles ONLY core authentication state.
 *
 * Provided values:
 *   user, session, loading, error, isAuthenticated,
 *   signIn, signUp, logout, updateProfile,
 *   getMFAStatus, enrollMFA, verifyMFA, unenrollMFA
 *
 * Components that only need to know "is the user logged in?" or need to
 * trigger sign-in / sign-out should subscribe to this context.  Changes to
 * user-metadata (profile updates, connection status) do NOT cause re-renders
 * for subscribers of this context alone.
 */
const AuthStateContext = createContext(null);

const SAFE_AUTH_FALLBACK = {
  user: null,
  session: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  signIn: async () => {
    throw new Error('Auth not initialized');
  },
  signUp: async () => {
    throw new Error('Auth not initialized');
  },
  logout: async () => {},
  updateProfile: async () => {},
  getMFAStatus: async () => ({ enabled: false, factors: [] }),
  enrollMFA: async () => {
    throw new Error('Auth not initialized');
  },
  verifyMFA: async () => {
    throw new Error('Auth not initialized');
  },
  unenrollMFA: async () => {
    throw new Error('Auth not initialized');
  },
};

export const AuthStateProvider = ({ children }) => {
  const auth = useAuthSource();
  const value = auth || SAFE_AUTH_FALLBACK;

  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
};

/**
 * useAuthState — subscribe to core auth state only.
 *
 * Prefer this over useAuth() in components that do NOT need connectionStatus,
 * checkConnection, or hasRole.  This avoids unnecessary re-renders when
 * metadata changes.
 */
export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within an AuthStateProvider');
  }
  return context;
};

export { AuthStateContext };
