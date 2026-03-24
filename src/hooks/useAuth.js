/* eslint-disable no-console */
import { useState, useEffect, useCallback } from 'react';
import { supabase, validateSupabaseConfig } from '@/lib/supabase';
import { DEFAULT_ROLE, normalizeRole, sanitizeSelfSignupRole } from '@/lib/roles';
import { validatePasswordStrength } from '@/utils/validation';
import { sanitizeText } from '@/utils/sanitize';
import { assertRateLimitAllowed, recordRateLimitFailure, recordRateLimitSuccess } from '@/utils/authRateLimit';

const AUTH_SCOPE_SIGN_IN = 'sign-in';
const AUTH_SCOPE_SIGN_UP = 'sign-up';
const AUTH_SCOPE_MFA_VERIFY = 'mfa-verify';

const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
const extractEmailDomain = (email) => {
  const [, domain = ''] = String(email || '').split('@');
  return domain.trim().toLowerCase();
};
const sanitizeOptionalText = (value) => {
  if (typeof value !== 'string') return null;
  const sanitized = sanitizeText(value).trim();
  return sanitized || null;
};
const sanitizeOptionalScalar = (value) => (typeof value === 'string' ? sanitizeText(value).trim() : value);

const buildServerRateLimitError = (payload, fallbackMessage) => {
  const retryAfterSeconds = Number(payload?.retryAfterSeconds || 0);
  const baseMessage = payload?.error || fallbackMessage || 'Security policy blocked this authentication attempt.';
  if (retryAfterSeconds > 0) {
    return new Error(`${baseMessage} Try again in ${retryAfterSeconds} seconds.`);
  }
  return new Error(baseMessage);
};

const extractFunctionErrorPayload = async (error) => {
  if (!error || !error.context) return null;
  try {
    return await error.context.json();
  } catch {
    return null;
  }
};

export const useAuthSource = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const enforceServerRateLimit = useCallback(async (scope, identifier) => {
    if (!supabase) return;

    const { data, error: invokeError } = await supabase.functions.invoke('auth-rate-limit', {
      body: {
        scope,
        identifier,
        outcome: 'attempt',
      },
    });

    if (invokeError) {
      // If the edge function is unreachable (network error, not deployed, etc.),
      // fail open so users can still log in. Only block when we get a valid
      // rate-limit response saying the user is blocked.
      const payload = await extractFunctionErrorPayload(invokeError);
      if (payload?.allowed === false) {
        throw buildServerRateLimitError(payload, invokeError.message);
      }
      // auth-rate-limit edge function unavailable — fail open, allow login
      return;
    }

    if (data?.allowed === false) {
      throw buildServerRateLimitError(data, 'Too many attempts.');
    }
  }, []);

  const reportServerRateLimitOutcome = useCallback(async (scope, identifier, outcome) => {
    if (!supabase) return;

    try {
      await supabase.functions.invoke('auth-rate-limit', {
        body: {
          scope,
          identifier,
          outcome,
        },
      });
    } catch (reportError) {
      console.warn('Unable to persist server-side auth rate-limit outcome:', reportError);
    }
  }, []);

  const enforcePostLoginSecurityPolicy = useCallback(async (authUser, normalizedEmail) => {
    if (!supabase || !authUser?.id) return;

    const { data: companies, error: companiesError } = await supabase
      .from('company')
      .select('id')
      .eq('user_id', authUser.id)
      .limit(10);

    if (companiesError || !Array.isArray(companies) || companies.length === 0) {
      return;
    }

    const companyIds = companies.map((company) => company.id);
    const { data: settingsRows, error: settingsError } = await supabase
      .from('company_security_settings')
      .select('company_id, sso_enforced, sso_provider, allowed_email_domains')
      .in('company_id', companyIds)
      .eq('sso_enforced', true);

    if (settingsError || !Array.isArray(settingsRows) || settingsRows.length === 0) {
      return;
    }

    const emailDomain = extractEmailDomain(normalizedEmail);
    const blockedBySso = settingsRows.find((row) => row.sso_provider && row.sso_provider !== 'none');
    if (blockedBySso) {
      await supabase.auth.signOut();
      const policyError = new Error('This workspace enforces SSO. Use your SSO identity provider to sign in.');
      policyError.code = 'AUTH_POLICY_ENFORCED';
      throw policyError;
    }

    const blockedByDomain = settingsRows.find(
      (row) =>
        Array.isArray(row.allowed_email_domains) &&
        row.allowed_email_domains.length > 0 &&
        !row.allowed_email_domains.map((domain) => String(domain || '').toLowerCase()).includes(emailDomain)
    );

    if (blockedByDomain) {
      await supabase.auth.signOut();
      const policyError = new Error('This workspace restricts sign-in to approved email domains.');
      policyError.code = 'AUTH_POLICY_ENFORCED';
      throw policyError;
    }
  }, []);

  // Define logout first so it can be used by handleInvalidSession
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      // Only attempt Supabase signout if client exists
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Supabase signOut error:', error);
          // Don't throw here, we want to clear local state regardless
        }
      }
    } catch (err) {
      // Intentionally swallowed: logout must always clear local state even if Supabase signOut fails
      console.error('Supabase signOut threw during logout (cleanup will proceed):', err);
    } finally {
      // Clear only auth-related storage, preserve UI preferences (language, sidebar, etc.)
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.startsWith('supabase.')) {
          localStorage.removeItem(key);
        }
      });

      if (typeof window !== 'undefined') {
        try {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration('/');
            registration?.active?.postMessage({ type: 'CLEAR_RUNTIME_CACHES' });
          }

          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
          }
        } catch (cacheError) {
          console.warn('Cache cleanup on logout failed:', cacheError);
        }
      }

      setUser(null);
      setSession(null);
      setError(null);
      setLoading(false);
    }
    return { success: true };
  }, []);

  // Helper to handle invalid sessions
  const handleInvalidSession = useCallback(async () => {
    await logout();
  }, [logout]);

  const fetchUserProfile = useCallback(
    async (authUser) => {
      if (!authUser || !authUser.id) return null;

      if (!supabase) {
        return null;
      }

      try {
        const [{ data, error }, { data: roleData, error: roleError }] = await Promise.all([
          supabase.from('profiles').select('*').eq('user_id', authUser.id).maybeSingle(),
          // user_roles is the authoritative source for elevated privileges.
          supabase.from('user_roles').select('role').eq('user_id', authUser.id).maybeSingle(),
        ]);

        if (error) {
          console.error('Profile fetch error:', error);
          if (error.message?.includes('User from sub claim in JWT does not exist') || error.code === 'user_not_found') {
            await handleInvalidSession();
            return null;
          }

          // RLS or other errors shouldn't log the user out, just degrade gracefully
          if (error.code === '42P17' || error.code === '42501') {
            console.warn('Profile fetch skipped (RLS):', error.message);
          }

          // Return basic user info if profile fetch fails
          const basicUser = {
            ...authUser,
            role: normalizeRole(roleData?.role || DEFAULT_ROLE),
          };
          setUser(basicUser);
          return basicUser;
        }

        if (roleError) {
          console.warn('Role fetch skipped:', roleError.message);
        }

        const profile = data || {};
        const resolvedRole = normalizeRole(roleData?.role || profile.role);

        const fullUser = {
          ...authUser,
          ...profile,
          id: authUser.id,
          profile_id: profile.id || null,
          role: resolvedRole,
        };

        setUser(fullUser);
        return fullUser;
      } catch (err) {
        console.error('fetchUserProfile error:', err);
        // Fallback
        setUser({ ...authUser, role: DEFAULT_ROLE });
        return null;
      }
    },
    [handleInvalidSession]
  );

  const claimPendingSubscription = useCallback(async () => {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.rpc('claim_pending_subscription');

    if (error) {
      throw error;
    }

    return data;
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const config = validateSupabaseConfig();
      if (!config.valid || !supabase) {
        console.error('Auth init failed: Supabase not configured.', config.missing);
        if (mounted) {
          setLoading(false);
          setError('Supabase configuration missing');
        }
        return;
      }

      try {
        // Get initial session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (mounted) {
          setSession(session);
          if (session?.user) {
            await fetchUserProfile(session.user);
            try {
              await claimPendingSubscription();
            } catch (claimError) {
              console.error('Failed to claim pending subscription:', claimError);
            }
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          if (err.message && (err.message.includes('fetch failed') || err.message.includes('Network request failed'))) {
            setError('Network Error: Failed to connect to authentication server.');
          } else {
            setError(`Auth Error: ${err.message}`);
          }

          if (err.message?.includes('User from sub claim in JWT does not exist')) {
            await handleInvalidSession();
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    let subscription = null;

    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(session);
          if (session?.user) {
            await fetchUserProfile(session.user);
            if (event === 'SIGNED_IN') {
              try {
                await claimPendingSubscription();
              } catch (claimError) {
                console.error('Failed to claim pending subscription:', claimError);
              }
            }
          }
          setLoading(false);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, [claimPendingSubscription, fetchUserProfile, handleInvalidSession]);

  const signUp = async (email, password, fullName, companyName, role) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    if (!validatePasswordStrength(password)) {
      throw new Error(
        'Password must be at least 12 characters and include an uppercase letter, a number, and a special character.'
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const sanitizedFullName = sanitizeOptionalText(fullName);
    const sanitizedCompanyName = sanitizeOptionalText(companyName);
    const safeRole = sanitizeSelfSignupRole(role);

    if (!sanitizedFullName) {
      throw new Error('Full name is required.');
    }

    await enforceServerRateLimit(AUTH_SCOPE_SIGN_UP, normalizedEmail);
    assertRateLimitAllowed(AUTH_SCOPE_SIGN_UP, normalizedEmail);

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: sanitizedFullName,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;

      recordRateLimitSuccess(AUTH_SCOPE_SIGN_UP, normalizedEmail);
      await reportServerRateLimitOutcome(AUTH_SCOPE_SIGN_UP, normalizedEmail, 'success');

      if (data.user && data.session) {
        // Create profile
        const profileData = {
          user_id: data.user.id,
          full_name: sanitizedFullName,
          company_name: sanitizedCompanyName,
          role: safeRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase.from('profiles').insert([profileData]);

        if (profileError) {
          console.error('Profile creation failed:', profileError);
          // We don't throw here to allow the user to at least exist in Auth
        } else {
          await fetchUserProfile(data.user);
        }

        if (data.session) {
          try {
            await claimPendingSubscription();
          } catch (claimError) {
            console.error('Failed to claim pending subscription:', claimError);
          }
        }
      }

      return data;
    } catch (err) {
      recordRateLimitFailure(AUTH_SCOPE_SIGN_UP, normalizedEmail);
      await reportServerRateLimitOutcome(AUTH_SCOPE_SIGN_UP, normalizedEmail, 'failure');
      console.error('SignUp error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const normalizedEmail = normalizeEmail(email);
    await enforceServerRateLimit(AUTH_SCOPE_SIGN_IN, normalizedEmail);
    assertRateLimitAllowed(AUTH_SCOPE_SIGN_IN, normalizedEmail);

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;
      await enforcePostLoginSecurityPolicy(data.user, normalizedEmail);

      recordRateLimitSuccess(AUTH_SCOPE_SIGN_IN, normalizedEmail);
      await reportServerRateLimitOutcome(AUTH_SCOPE_SIGN_IN, normalizedEmail, 'success');

      if (data.user) {
        await fetchUserProfile(data.user);
        try {
          await claimPendingSubscription();
        } catch (claimError) {
          console.error('Failed to claim pending subscription:', claimError);
        }
      }

      return data;
    } catch (err) {
      recordRateLimitFailure(AUTH_SCOPE_SIGN_IN, normalizedEmail);
      await reportServerRateLimitOutcome(AUTH_SCOPE_SIGN_IN, normalizedEmail, 'failure');
      console.error('SignIn error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates, { silent = false } = {}) => {
    if (!supabase || !user) return;
    if (!silent) {
      setLoading(true);
    }

    try {
      const allowedFields = [
        'full_name',
        'company_name',
        'avatar_url',
        'phone',
        'address',
        'city',
        'postal_code',
        'country',
        'currency',
        'timezone',
        'signature_url',
        'onboarding_completed',
        'onboarding_step',
        'language_code',
        'theme_preference',
      ];
      const safeUpdates = Object.fromEntries(
        allowedFields
          .filter((field) => Object.prototype.hasOwnProperty.call(updates, field))
          .map((field) => [field, sanitizeOptionalScalar(updates[field])])
      );

      if (Object.keys(safeUpdates).length === 0) {
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          ...safeUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setUser((prev) => ({ ...prev, ...safeUpdates }));
    } catch (err) {
      console.error('Update profile error:', err);
      setError(err.message);
      throw err;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // --- MFA TOTP Functions ---
  const getMFAStatus = async () => {
    if (!supabase) return { enabled: false, factors: [] };
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totpFactors = (data?.totp || []).filter((f) => f.status === 'verified');
      return { enabled: totpFactors.length > 0, factors: totpFactors };
    } catch (err) {
      console.error('getMFAStatus error:', err);
      return { enabled: false, factors: [] };
    }
  };

  const enrollMFA = async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'CashPilot Authenticator',
    });
    if (error) throw error;
    return data; // { id, type, totp: { qr_code, secret, uri } }
  };

  const verifyMFA = async (factorId, code) => {
    if (!supabase) throw new Error('Supabase not configured');
    const scopeId = user?.id || factorId || 'global';
    await enforceServerRateLimit(AUTH_SCOPE_MFA_VERIFY, scopeId);
    assertRateLimitAllowed(AUTH_SCOPE_MFA_VERIFY, scopeId);

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (error) throw error;
      recordRateLimitSuccess(AUTH_SCOPE_MFA_VERIFY, scopeId);
      await reportServerRateLimitOutcome(AUTH_SCOPE_MFA_VERIFY, scopeId, 'success');
      return data;
    } catch (err) {
      recordRateLimitFailure(AUTH_SCOPE_MFA_VERIFY, scopeId);
      await reportServerRateLimitOutcome(AUTH_SCOPE_MFA_VERIFY, scopeId, 'failure');
      throw err;
    }
  };

  const unenrollMFA = async (factorId) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  };

  return {
    user,
    session,
    loading,
    error,
    signUp,
    signIn,
    logout,
    updateProfile,
    isAuthenticated: !!user,
    getMFAStatus,
    enrollMFA,
    verifyMFA,
    unenrollMFA,
  };
};
