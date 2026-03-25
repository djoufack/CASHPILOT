import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { normalizeRole } from '@/lib/roles';

export const SUBSCRIPTION_STATUS_OPTIONS = ['inactive', 'active', 'trialing', 'past_due', 'canceled', 'unpaid'];
export const CREDIT_TRANSACTION_TYPES = ['purchase', 'usage', 'bonus', 'refund'];
export const ADMIN_ACCESS_ROLE_OPTIONS = ['user', 'manager', 'accountant', 'admin'];
export const PROFILE_ROLE_OPTIONS = ['user', 'client', 'freelance', 'manager', 'accountant', 'admin'];
export const USER_DELETE_CONFIRMATION_PHRASE = 'DELETE_USER_AND_ALL_DATA';

const DEFAULT_CREDIT_RECORD = {
  free_credits: 0,
  subscription_credits: 0,
  paid_credits: 0,
  total_used: 0,
  subscription_plan_id: null,
  subscription_status: 'inactive',
  current_period_end: null,
};

const toSafeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIsoDateTimeOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const toDateSortValue = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNonEmptyString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAccessRole = (value) => {
  const normalized = normalizeRole(value);
  return ADMIN_ACCESS_ROLE_OPTIONS.includes(normalized) ? normalized : 'user';
};

const normalizeProfileRole = (value) => {
  const normalized = normalizeRole(value);
  return PROFILE_ROLE_OPTIONS.includes(normalized) ? normalized : 'user';
};

export const useAdminBilling = () => {
  const [records, setRecords] = useState([]);
  const [plans, setPlans] = useState([]);
  const [transactionsByUserId, setTransactionsByUserId] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [loadingTransactionsUserId, setLoadingTransactionsUserId] = useState(null);
  const [savingTransactionUserId, setSavingTransactionUserId] = useState(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [updatingAccountUserId, setUpdatingAccountUserId] = useState(null);
  const [deletingAccountUserId, setDeletingAccountUserId] = useState(null);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const invokeAdminUsers = useCallback(async (payload) => {
    if (!supabase) {
      throw new Error('Supabase client unavailable');
    }

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: payload,
    });

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data || {};
  }, []);

  const fetchBillingData = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    try {
      const _results = await Promise.allSettled([
        invokeAdminUsers({ action: 'list' }),
        supabase
          .from('profiles')
          .select('user_id, full_name, company_name, role, phone, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase
          .from('user_credits')
          .select(
            'user_id, free_credits, subscription_credits, paid_credits, total_used, subscription_plan_id, subscription_status, current_period_end, updated_at'
          ),
        supabase
          .from('subscription_plans')
          .select('id, name, slug, price_cents, currency, credits_per_month, is_active, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      _results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Admin billing fetch ${index} failed:`, result.reason);
        }
      });
      if (_results[0].status === 'rejected') {
        toast({
          title: 'Warning',
          description: 'Admin user directory is unavailable. Emails and account CRUD data may be incomplete.',
          variant: 'destructive',
        });
      }

      const adminUsersRes = _results[0].status === 'fulfilled' ? _results[0].value : { users: [] };
      const profileRes = _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };
      const roleRes = _results[2].status === 'fulfilled' ? _results[2].value : { data: null, error: null };
      const creditsRes = _results[3].status === 'fulfilled' ? _results[3].value : { data: null, error: null };
      const plansRes = _results[4].status === 'fulfilled' ? _results[4].value : { data: null, error: null };

      if (creditsRes.error) throw creditsRes.error;
      if (plansRes.error) throw plansRes.error;
      if (profileRes.error) {
        console.warn('Profile fallback lookup skipped:', profileRes.error.message);
      }
      if (roleRes.error) {
        console.warn('Role fallback lookup skipped:', roleRes.error.message);
      }

      const adminUsersByUserId = new Map(
        (adminUsersRes.users || []).filter((entry) => entry?.user_id).map((entry) => [entry.user_id, entry])
      );
      const profilesByUserId = new Map((profileRes.data || []).map((profile) => [profile.user_id, profile]));
      const rolesByUserId = new Map(
        (roleRes.data || []).map((roleRow) => [roleRow.user_id, normalizeRole(roleRow.role)])
      );
      const creditsByUserId = new Map((creditsRes.data || []).map((creditRow) => [creditRow.user_id, creditRow]));
      const allUserIds = new Set([
        ...adminUsersByUserId.keys(),
        ...profilesByUserId.keys(),
        ...rolesByUserId.keys(),
        ...creditsByUserId.keys(),
      ]);

      const nextRecords = [...allUserIds].map((userId) => {
        const adminUser = adminUsersByUserId.get(userId);
        const profile = profilesByUserId.get(userId);
        const credits = creditsByUserId.get(userId) || DEFAULT_CREDIT_RECORD;

        const fullName = toNonEmptyString(adminUser?.full_name) || toNonEmptyString(profile?.full_name);
        const companyName = toNonEmptyString(adminUser?.company_name) || toNonEmptyString(profile?.company_name);
        const email = toNonEmptyString(adminUser?.email);

        return {
          user_id: userId,
          email,
          full_name: fullName,
          company_name: companyName,
          phone: toNonEmptyString(adminUser?.phone) || toNonEmptyString(profile?.phone),
          name: fullName || companyName || 'Unknown user',
          profile_role: normalizeProfileRole(adminUser?.profile_role || profile?.role),
          access_role: normalizeAccessRole(
            adminUser?.access_role || rolesByUserId.get(userId) || profile?.role || 'user'
          ),
          created_at: adminUser?.created_at || profile?.created_at || null,
          account_updated_at: adminUser?.updated_at || null,
          has_credits_row: Boolean(creditsByUserId.get(userId)),
          free_credits: toSafeInt(credits.free_credits, 0),
          subscription_credits: toSafeInt(credits.subscription_credits, 0),
          paid_credits: toSafeInt(credits.paid_credits, 0),
          total_used: toSafeInt(credits.total_used, 0),
          subscription_plan_id: credits.subscription_plan_id || null,
          subscription_status: credits.subscription_status || 'inactive',
          current_period_end: credits.current_period_end || null,
          updated_at: credits.updated_at || null,
        };
      });

      nextRecords.sort((left, right) => {
        const updatedDelta = toDateSortValue(right.updated_at) - toDateSortValue(left.updated_at);
        if (updatedDelta !== 0) return updatedDelta;
        const createdDelta = toDateSortValue(right.created_at) - toDateSortValue(left.created_at);
        if (createdDelta !== 0) return createdDelta;
        return String(left.name || '').localeCompare(String(right.name || ''));
      });

      setRecords(nextRecords);
      setPlans(plansRes.data || []);
    } catch (err) {
      console.error('Failed to fetch admin billing data:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to load subscription and credits data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [invokeAdminUsers, toast]);

  const createUserAccount = useCallback(
    async (draft) => {
      if (!supabase || !draft) {
        return false;
      }

      const email = toNonEmptyString(draft.email)?.toLowerCase();
      const password = typeof draft.password === 'string' ? draft.password : '';

      if (!email) {
        toast({
          title: 'Error',
          description: 'User email is required',
          variant: 'destructive',
        });
        return false;
      }

      if (!password || password.length < 8) {
        toast({
          title: 'Error',
          description: 'Password is required (minimum 8 characters)',
          variant: 'destructive',
        });
        return false;
      }

      const payload = {
        email,
        password,
        full_name: toNonEmptyString(draft.full_name),
        company_name: toNonEmptyString(draft.company_name),
        phone: toNonEmptyString(draft.phone),
        profile_role: normalizeProfileRole(draft.profile_role),
        access_role: normalizeAccessRole(draft.access_role),
      };

      setCreatingUser(true);
      try {
        const response = await invokeAdminUsers({
          action: 'create',
          user: payload,
        });

        await logAction('admin_user_create', 'auth.users', null, response?.user || payload);
        toast({
          title: 'Success',
          description: `User created: ${email}`,
        });

        await fetchBillingData();
        return true;
      } catch (err) {
        console.error('Failed to create user account:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to create user',
          variant: 'destructive',
        });
        return false;
      } finally {
        setCreatingUser(false);
      }
    },
    [fetchBillingData, invokeAdminUsers, logAction, toast]
  );

  const updateUserAccount = useCallback(
    async (record, draft) => {
      if (!supabase || !record?.user_id || !draft) {
        return false;
      }

      const email = toNonEmptyString(draft.email)?.toLowerCase();
      if (!email) {
        toast({
          title: 'Error',
          description: 'User email is required',
          variant: 'destructive',
        });
        return false;
      }

      const patch = {
        user_id: record.user_id,
        email,
        full_name: toNonEmptyString(draft.full_name),
        company_name: toNonEmptyString(draft.company_name),
        phone: toNonEmptyString(draft.phone),
        profile_role: normalizeProfileRole(draft.profile_role),
        access_role: normalizeAccessRole(draft.access_role),
      };

      const password = toNonEmptyString(draft.password);
      if (password) {
        if (password.length < 8) {
          toast({
            title: 'Error',
            description: 'Password must be at least 8 characters',
            variant: 'destructive',
          });
          return false;
        }
        patch.password = password;
      }

      setUpdatingAccountUserId(record.user_id);
      try {
        const response = await invokeAdminUsers({
          action: 'update',
          user: patch,
        });

        await logAction(
          'admin_user_update',
          'auth.users',
          {
            user_id: record.user_id,
            email: record.email,
            full_name: record.full_name,
            company_name: record.company_name,
            phone: record.phone,
            profile_role: record.profile_role,
            access_role: record.access_role,
          },
          response?.user || patch
        );

        toast({
          title: 'Success',
          description: `User account updated for ${record.name}`,
        });

        await fetchBillingData();
        return true;
      } catch (err) {
        console.error('Failed to update user account:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to update user account',
          variant: 'destructive',
        });
        return false;
      } finally {
        setUpdatingAccountUserId(null);
      }
    },
    [fetchBillingData, invokeAdminUsers, logAction, toast]
  );

  const deleteUserAccount = useCallback(
    async (record) => {
      if (!supabase || !record?.user_id) {
        return false;
      }

      setDeletingAccountUserId(record.user_id);
      try {
        const response = await invokeAdminUsers({
          action: 'delete',
          user_id: record.user_id,
          confirmation: USER_DELETE_CONFIRMATION_PHRASE,
        });

        await logAction(
          'admin_user_delete',
          'auth.users',
          {
            user_id: record.user_id,
            email: record.email,
            name: record.name,
          },
          response || null
        );

        toast({
          title: 'Success',
          description: `User deleted in cascade: ${record.email || record.user_id}`,
        });

        await fetchBillingData();
        setTransactionsByUserId((current) => {
          if (!current[record.user_id]) return current;
          const next = { ...current };
          delete next[record.user_id];
          return next;
        });
        return true;
      } catch (err) {
        console.error('Failed to delete user account:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to delete user account',
          variant: 'destructive',
        });
        return false;
      } finally {
        setDeletingAccountUserId(null);
      }
    },
    [fetchBillingData, invokeAdminUsers, logAction, toast]
  );

  const upsertUserCredits = useCallback(
    async (record, draft) => {
      if (!supabase || !record?.user_id || !draft) {
        return false;
      }

      const previousState = {
        free_credits: record.free_credits,
        subscription_credits: record.subscription_credits,
        paid_credits: record.paid_credits,
        total_used: record.total_used,
        subscription_plan_id: record.subscription_plan_id,
        subscription_status: record.subscription_status,
        current_period_end: record.current_period_end,
      };

      const nextState = {
        user_id: record.user_id,
        free_credits: Math.max(0, toSafeInt(draft.free_credits, previousState.free_credits)),
        subscription_credits: Math.max(0, toSafeInt(draft.subscription_credits, previousState.subscription_credits)),
        paid_credits: Math.max(0, toSafeInt(draft.paid_credits, previousState.paid_credits)),
        total_used: Math.max(0, toSafeInt(draft.total_used, previousState.total_used)),
        subscription_plan_id:
          draft.subscription_plan_id && draft.subscription_plan_id !== 'none' ? draft.subscription_plan_id : null,
        subscription_status: SUBSCRIPTION_STATUS_OPTIONS.includes(draft.subscription_status)
          ? draft.subscription_status
          : 'inactive',
        current_period_end: toIsoDateTimeOrNull(draft.current_period_end),
        updated_at: new Date().toISOString(),
      };

      setSavingUserId(record.user_id);
      try {
        const { error } = await supabase.from('user_credits').upsert(nextState, { onConflict: 'user_id' });

        if (error) throw error;

        await logAction(
          'admin_user_credits_upsert',
          'user_credits',
          { user_id: record.user_id, ...previousState },
          nextState
        );

        toast({
          title: 'Success',
          description: `Subscription and credits updated for ${record.name}`,
        });

        await fetchBillingData();
        return true;
      } catch (err) {
        console.error('Failed to upsert user credits:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to update subscription and credits',
          variant: 'destructive',
        });
        return false;
      } finally {
        setSavingUserId(null);
      }
    },
    [fetchBillingData, logAction, toast]
  );

  const deleteUserCredits = useCallback(
    async (record) => {
      if (!supabase || !record?.user_id) {
        return false;
      }

      setDeletingUserId(record.user_id);
      try {
        const { error } = await supabase.from('user_credits').delete().eq('user_id', record.user_id);

        if (error) throw error;

        await logAction(
          'admin_user_credits_delete',
          'user_credits',
          {
            user_id: record.user_id,
            free_credits: record.free_credits,
            subscription_credits: record.subscription_credits,
            paid_credits: record.paid_credits,
            total_used: record.total_used,
            subscription_plan_id: record.subscription_plan_id,
            subscription_status: record.subscription_status,
            current_period_end: record.current_period_end,
          },
          null
        );

        toast({
          title: 'Success',
          description: `Credits record deleted for ${record.name}`,
        });

        await fetchBillingData();
        setTransactionsByUserId((current) => {
          if (!current[record.user_id]) return current;
          const next = { ...current };
          delete next[record.user_id];
          return next;
        });
        return true;
      } catch (err) {
        console.error('Failed to delete user credits:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to delete credits record',
          variant: 'destructive',
        });
        return false;
      } finally {
        setDeletingUserId(null);
      }
    },
    [fetchBillingData, logAction, toast]
  );

  const fetchTransactions = useCallback(
    async (userId) => {
      if (!supabase || !userId) return false;

      setLoadingTransactionsUserId(userId);
      try {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('id, user_id, type, amount, description, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) throw error;

        setTransactionsByUserId((current) => ({
          ...current,
          [userId]: data || [],
        }));
        return true;
      } catch (err) {
        console.error('Failed to fetch user credit transactions:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to load credit transactions',
          variant: 'destructive',
        });
        return false;
      } finally {
        setLoadingTransactionsUserId(null);
      }
    },
    [toast]
  );

  const createTransaction = useCallback(
    async ({ userId, type, amount, description }) => {
      if (!supabase || !userId) {
        return false;
      }

      const normalizedType = CREDIT_TRANSACTION_TYPES.includes(type) ? type : 'bonus';
      const normalizedAmount = toSafeInt(amount, 0);
      if (normalizedAmount === 0) {
        toast({
          title: 'Error',
          description: 'Transaction amount must be non-zero',
          variant: 'destructive',
        });
        return false;
      }

      setSavingTransactionUserId(userId);
      try {
        const payload = {
          user_id: userId,
          type: normalizedType,
          amount: normalizedAmount,
          description: description || 'Admin manual adjustment',
        };

        const { error } = await supabase.from('credit_transactions').insert(payload);

        if (error) throw error;

        await logAction('admin_credit_transaction_create', 'credit_transactions', null, payload);

        toast({
          title: 'Success',
          description: 'Manual credit transaction created',
        });

        await fetchTransactions(userId);
        return true;
      } catch (err) {
        console.error('Failed to create manual credit transaction:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to create transaction',
          variant: 'destructive',
        });
        return false;
      } finally {
        setSavingTransactionUserId(null);
      }
    },
    [fetchTransactions, logAction, toast]
  );

  const deleteTransaction = useCallback(
    async ({ transactionId, userId }) => {
      if (!supabase || !transactionId || !userId) {
        return false;
      }

      setDeletingTransactionId(transactionId);
      try {
        const { error } = await supabase
          .from('credit_transactions')
          .delete()
          .eq('id', transactionId)
          .eq('user_id', userId);

        if (error) throw error;

        await logAction(
          'admin_credit_transaction_delete',
          'credit_transactions',
          { id: transactionId, user_id: userId },
          null
        );

        toast({
          title: 'Success',
          description: 'Credit transaction deleted',
        });

        await fetchTransactions(userId);
        return true;
      } catch (err) {
        console.error('Failed to delete credit transaction:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to delete transaction',
          variant: 'destructive',
        });
        return false;
      } finally {
        setDeletingTransactionId(null);
      }
    },
    [fetchTransactions, logAction, toast]
  );

  return {
    records,
    plans,
    transactionsByUserId,
    loading,
    savingUserId,
    deletingUserId,
    loadingTransactionsUserId,
    savingTransactionUserId,
    deletingTransactionId,
    creatingUser,
    updatingAccountUserId,
    deletingAccountUserId,
    fetchBillingData,
    createUserAccount,
    updateUserAccount,
    deleteUserAccount,
    upsertUserCredits,
    deleteUserCredits,
    fetchTransactions,
    createTransaction,
    deleteTransaction,
  };
};
