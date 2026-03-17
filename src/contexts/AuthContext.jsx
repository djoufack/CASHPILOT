import { createContext, useContext, useMemo } from 'react';
import { AuthStateProvider, AuthStateContext } from '@/contexts/AuthStateContext';
import { UserMetadataProvider, UserMetadataContext } from '@/contexts/UserMetadataContext';

/**
 * AuthContext — backwards-compatible barrel context.
 *
 * Internally composes AuthStateProvider (core auth) and UserMetadataProvider
 * (connection status, role helpers).  The exported `useAuth()` hook merges
 * both contexts so every existing consumer keeps working without changes.
 *
 * For future optimisation, components can import the granular hooks instead:
 *   - useAuthState()    — from AuthStateContext   (session, user, loading, signIn, signOut, MFA)
 *   - useUserMetadata() — from UserMetadataContext (connectionStatus, checkConnection, hasRole)
 */
const AuthContext = createContext(null);

/**
 * Inner provider that reads from both split contexts and merges their values
 * into a single AuthContext for backwards compatibility.
 */
const AuthContextBridge = ({ children }) => {
  const authState = useContext(AuthStateContext);
  const metadata = useContext(UserMetadataContext);

  const merged = useMemo(
    () => ({
      // Core auth state
      ...authState,
      // User metadata
      ...metadata,
    }),
    [authState, metadata]
  );

  return <AuthContext.Provider value={merged}>{children}</AuthContext.Provider>;
};

/**
 * AuthProvider — drop-in replacement.
 *
 * Wrap your app exactly as before:
 *   <AuthProvider><App /></AuthProvider>
 */
export const AuthProvider = ({ children }) => (
  <AuthStateProvider>
    <UserMetadataProvider>
      <AuthContextBridge>{children}</AuthContextBridge>
    </UserMetadataProvider>
  </AuthStateProvider>
);

/**
 * useAuth — backwards-compatible hook.
 *
 * Returns the merged object containing every field that the old single-context
 * AuthProvider used to supply:
 *   user, session, loading, error, isAuthenticated,
 *   signIn, signUp, logout, updateProfile,
 *   getMFAStatus, enrollMFA, verifyMFA, unenrollMFA,
 *   connectionStatus, checkConnection, hasRole
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Re-export granular hooks for consumers that want to opt-in to finer updates
export { useAuthState } from '@/contexts/AuthStateContext';
export { useUserMetadata } from '@/contexts/UserMetadataContext';
