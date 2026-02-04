
import { useState, useEffect } from 'react';
import { supabase, validateSupabaseConfig } from '@/lib/supabase';

export const useAuthSource = () => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define logout first so it can be used by handleInvalidSession
  const logout = async () => {
    setLoading(true);
    try {
      // Only attempt Supabase signout if client exists
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
           console.error("Supabase signOut error:", error);
           // Don't throw here, we want to clear local state regardless
        }
      }
    } catch (err) {
      // Local cleanup will proceed regardless
    } finally {
      // Clear only auth-related storage, preserve UI preferences (language, sidebar, etc.)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.startsWith('supabase.')) {
          localStorage.removeItem(key);
        }
      });
      setUser(null);
      setSession(null);
      setError(null);
      setLoading(false);
    }
    return { success: true };
  };

  // Helper to handle invalid sessions
  const handleInvalidSession = async () => {
    await logout();
  };

  const fetchUserProfile = async (authUser) => {
    if (!authUser || !authUser.id) return null;

    if (!supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error("Profile fetch error:", error);
        if (
          error.message?.includes("User from sub claim in JWT does not exist") ||
          error.code === "user_not_found"
        ) {
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
            role: 'freelance' // Default role
        };
        setUser(basicUser);
        return basicUser;
      }

      const profile = data || {};

      const fullUser = {
        ...authUser,
        ...profile,
        id: authUser.id,
        profile_id: profile.id || null,
        role: profile.role || 'freelance'
      };

      setUser(fullUser);
      return fullUser;
    } catch (err) {
      console.error('fetchUserProfile error:', err);
      // Fallback
      setUser({ ...authUser, role: 'freelance' });
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const config = validateSupabaseConfig();
      if (!config.valid || !supabase) {
        console.error("Auth init failed: Supabase not configured.", config.missing);
        if (mounted) {
          setLoading(false);
          setError("Supabase configuration missing");
        }
        return;
      }

      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (mounted) {
          setSession(session);
          if (session?.user) {
            await fetchUserProfile(session.user);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (mounted) {
          if (err.message && (err.message.includes("fetch failed") || err.message.includes("Network request failed"))) {
             setError("Network Error: Failed to connect to authentication server.");
          } else {
             setError(`Auth Error: ${err.message}`);
          }

          if (err.message?.includes("User from sub claim in JWT does not exist")) {
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
  }, []);

  const signUp = async (email, password, fullName, companyName, role) => {
    if (!supabase) throw new Error("Supabase is not configured.");

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create profile
        const profileData = {
          user_id: data.user.id,
          full_name: fullName,
          company_name: companyName || null,
          role: role || 'freelance',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .insert([profileData]);

        if (profileError) {
          console.error("Profile creation failed:", profileError);
          // We don't throw here to allow the user to at least exist in Auth
        } else {
          await fetchUserProfile(data.user);
        }
      }

      return data;
    } catch (err) {
      console.error("SignUp error:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    if (!supabase) throw new Error("Supabase is not configured.");

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchUserProfile(data.user);
      }

      return data;
    } catch (err) {
      console.error("SignIn error:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    if (!supabase || !user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setUser(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error("Update profile error:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
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
    isAuthenticated: !!user
  };
};
