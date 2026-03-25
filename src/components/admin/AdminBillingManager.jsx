import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Coins, CreditCard, RefreshCw, Save, Search, Trash2, UserCog, UserPlus, Wallet } from 'lucide-react';
import {
  ADMIN_ACCESS_ROLE_OPTIONS,
  CREDIT_TRANSACTION_TYPES,
  PROFILE_ROLE_OPTIONS,
  SUBSCRIPTION_STATUS_OPTIONS,
  USER_DELETE_CONFIRMATION_PHRASE,
  normalizeSubscriptionStatus,
  useAdminBilling,
} from '@/hooks/useAdminBilling';

const toDateTimeLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toSafeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDraftFromRecord = (record) => ({
  free_credits: String(record.free_credits ?? 0),
  subscription_credits: String(record.subscription_credits ?? 0),
  paid_credits: String(record.paid_credits ?? 0),
  total_used: String(record.total_used ?? 0),
  subscription_plan_id: record.subscription_plan_id || 'none',
  subscription_status: normalizeSubscriptionStatus(record.subscription_status),
  current_period_end: toDateTimeLocalInput(record.current_period_end),
});

const toUserDraftFromRecord = (record) => ({
  email: record.email || '',
  full_name: record.full_name || '',
  company_name: record.company_name || '',
  phone: record.phone || '',
  profile_role: record.profile_role || 'user',
  access_role: record.access_role || 'user',
  password: '',
});

const buildDefaultTransactionDraft = (userId) => ({
  user_id: userId,
  type: 'bonus',
  amount: '',
  description: '',
});

const buildDefaultCreateUserDraft = () => ({
  email: '',
  password: '',
  full_name: '',
  company_name: '',
  phone: '',
  profile_role: 'user',
  access_role: 'user',
});

const AdminBillingManager = () => {
  const {
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
  } = useAdminBilling();

  const [searchTerm, setSearchTerm] = useState('');
  const [drafts, setDrafts] = useState({});
  const [userDrafts, setUserDrafts] = useState({});
  const [createUserDraft, setCreateUserDraft] = useState(buildDefaultCreateUserDraft);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [transactionDrafts, setTransactionDrafts] = useState({});
  const [actionSelections, setActionSelections] = useState({});

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  useEffect(() => {
    setDrafts(
      records.reduce((accumulator, record) => {
        accumulator[record.user_id] = toDraftFromRecord(record);
        return accumulator;
      }, {})
    );

    setUserDrafts(
      records.reduce((accumulator, record) => {
        accumulator[record.user_id] = toUserDraftFromRecord(record);
        return accumulator;
      }, {})
    );
  }, [records]);

  useEffect(() => {
    if (!selectedUserId) return;
    const exists = records.some((record) => record.user_id === selectedUserId);
    if (!exists) {
      setSelectedUserId(null);
    }
  }, [records, selectedUserId]);

  const plansById = useMemo(() => new Map((plans || []).map((plan) => [plan.id, plan])), [plans]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return records;

    return records.filter((record) => {
      const selectedPlan = plansById.get(record.subscription_plan_id);
      return [
        record.user_id,
        record.name,
        record.email,
        record.full_name,
        record.company_name,
        record.profile_role,
        record.access_role,
        record.subscription_status,
        selectedPlan?.name,
        selectedPlan?.slug,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [plansById, records, searchTerm]);

  const stats = useMemo(() => {
    const totalUsers = records.length;
    const activeSubscriptions = records.filter((record) =>
      ['active', 'trialing', 'past_due'].includes(record.subscription_status)
    ).length;
    const totalAvailableCredits = records.reduce(
      (sum, record) =>
        sum + (record.free_credits || 0) + (record.subscription_credits || 0) + (record.paid_credits || 0),
      0
    );

    return {
      totalUsers,
      activeSubscriptions,
      totalAvailableCredits,
    };
  }, [records]);

  const handleDraftChange = (userId, field, value) => {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: value,
      },
    }));
  };

  const handleUserDraftChange = (userId, field, value) => {
    setUserDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || {}),
        [field]: value,
      },
    }));
  };

  const hasCreditsChanges = (record) => {
    const draft = drafts[record.user_id];
    if (!draft) return false;

    const baseline = toDraftFromRecord(record);
    return (
      draft.free_credits !== baseline.free_credits ||
      draft.subscription_credits !== baseline.subscription_credits ||
      draft.paid_credits !== baseline.paid_credits ||
      draft.total_used !== baseline.total_used ||
      draft.subscription_plan_id !== baseline.subscription_plan_id ||
      draft.subscription_status !== baseline.subscription_status ||
      draft.current_period_end !== baseline.current_period_end
    );
  };

  const hasUserChanges = (record) => {
    const draft = userDrafts[record.user_id];
    if (!draft) return false;

    const baseline = toUserDraftFromRecord(record);
    return (
      draft.email !== baseline.email ||
      draft.full_name !== baseline.full_name ||
      draft.company_name !== baseline.company_name ||
      draft.phone !== baseline.phone ||
      draft.profile_role !== baseline.profile_role ||
      draft.access_role !== baseline.access_role ||
      Boolean(draft.password)
    );
  };

  const handleSaveCredits = async (record) => {
    const draft = drafts[record.user_id];
    if (!draft) return;
    await upsertUserCredits(record, draft);
  };

  const handleDeleteCredits = async (record) => {
    if (!window.confirm(`Delete credits record for ${record.name}?`)) {
      return;
    }
    await deleteUserCredits(record);
  };

  const handleSaveUser = async (record) => {
    const draft = userDrafts[record.user_id];
    if (!draft) return;

    const success = await updateUserAccount(record, draft);
    if (!success) return;

    setUserDrafts((current) => ({
      ...current,
      [record.user_id]: {
        ...current[record.user_id],
        password: '',
      },
    }));
  };

  const handleDeleteUser = async (record) => {
    const typed = window.prompt(
      `Type ${USER_DELETE_CONFIRMATION_PHRASE} to delete ${record.email || record.user_id} and all linked data.`
    );
    if (typed !== USER_DELETE_CONFIRMATION_PHRASE) {
      return;
    }

    const success = await deleteUserAccount(record);
    if (success && selectedUserId === record.user_id) {
      setSelectedUserId(null);
    }
    if (success && expandedUserId === record.user_id) {
      setExpandedUserId(null);
    }
  };

  const handleCreateUserDraftChange = (field, value) => {
    setCreateUserDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateUser = async () => {
    const success = await createUserAccount(createUserDraft);
    if (!success) return;
    setCreateUserDraft(buildDefaultCreateUserDraft());
  };

  const handleToggleTransactions = async (record) => {
    if (expandedUserId === record.user_id) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(record.user_id);
    setTransactionDrafts((current) => ({
      ...current,
      [record.user_id]: current[record.user_id] || buildDefaultTransactionDraft(record.user_id),
    }));

    await fetchTransactions(record.user_id);
  };

  const handleTransactionDraftChange = (userId, field, value) => {
    setTransactionDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || buildDefaultTransactionDraft(userId)),
        [field]: value,
      },
    }));
  };

  const handleCreateTransaction = async (userId) => {
    const draft = transactionDrafts[userId] || buildDefaultTransactionDraft(userId);
    const success = await createTransaction({
      userId,
      type: draft.type,
      amount: draft.amount,
      description: draft.description,
    });

    if (!success) return;

    setTransactionDrafts((current) => ({
      ...current,
      [userId]: {
        ...buildDefaultTransactionDraft(userId),
        type: draft.type,
      },
    }));
  };

  const handleSelectRowAction = async (record, actionValue) => {
    if (!record?.user_id) return;

    if (!actionValue || actionValue === 'none') {
      setActionSelections((current) => ({
        ...current,
        [record.user_id]: 'none',
      }));
      return;
    }

    if (actionValue === 'update_credits') {
      await handleSaveCredits(record);
    } else if (actionValue === 'account') {
      setSelectedUserId((current) => (current === record.user_id ? null : record.user_id));
    } else if (actionValue === 'transactions') {
      await handleToggleTransactions(record);
    } else if (actionValue === 'delete_credits') {
      await handleDeleteCredits(record);
    }

    setActionSelections((current) => ({
      ...current,
      [record.user_id]: 'none',
    }));
  };

  const expandedRecord = records.find((record) => record.user_id === expandedUserId) || null;
  const expandedTransactions = expandedUserId ? transactionsByUserId[expandedUserId] || [] : [];
  const selectedRecord = records.find((record) => record.user_id === selectedUserId) || null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Users in scope</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.totalUsers}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Active subscriptions</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{stats.activeSubscriptions}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Available credits (all users)</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.totalAvailableCredits}</div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Create platform user</h3>
        </div>
        <p className="text-sm text-gray-400">
          Admin CRUD is server-authoritative. New users are created in auth, profile, and access role in one flow.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Input
            value={createUserDraft.email}
            onChange={(event) => handleCreateUserDraftChange('email', event.target.value)}
            placeholder="Email"
            className="bg-gray-950 border-gray-800 text-white"
          />
          <Input
            value={createUserDraft.password}
            onChange={(event) => handleCreateUserDraftChange('password', event.target.value)}
            placeholder="Temporary password"
            type="password"
            className="bg-gray-950 border-gray-800 text-white"
          />
          <Input
            value={createUserDraft.full_name}
            onChange={(event) => handleCreateUserDraftChange('full_name', event.target.value)}
            placeholder="Full name"
            className="bg-gray-950 border-gray-800 text-white"
          />
          <Input
            value={createUserDraft.company_name}
            onChange={(event) => handleCreateUserDraftChange('company_name', event.target.value)}
            placeholder="Company name"
            className="bg-gray-950 border-gray-800 text-white"
          />
          <Input
            value={createUserDraft.phone}
            onChange={(event) => handleCreateUserDraftChange('phone', event.target.value)}
            placeholder="Phone"
            className="bg-gray-950 border-gray-800 text-white"
          />
          <Select
            value={createUserDraft.profile_role}
            onValueChange={(value) => handleCreateUserDraftChange('profile_role', value)}
          >
            <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
              <SelectValue placeholder="Profile role" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              {PROFILE_ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  profile: {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={createUserDraft.access_role}
            onValueChange={(value) => handleCreateUserDraftChange('access_role', value)}
          >
            <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
              <SelectValue placeholder="Access role" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              {ADMIN_ACCESS_ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  access: {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleCreateUser}
            disabled={creatingUser}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {creatingUser ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Create user
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-orange-400" />
              Subscriptions and credits
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Admin-only CRUD on user accounts, subscriptions, and <code>user_credits</code> for every platform user.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchBillingData}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search user, email, role, plan, status..."
            className="pl-9 bg-gray-950 border-gray-800 text-white"
          />
        </div>

        <div className="border border-gray-800 rounded-lg overflow-x-auto">
          <Table className="min-w-[1480px]">
            <TableHeader className="bg-gray-950">
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-400">User</TableHead>
                <TableHead className="text-gray-400">Access</TableHead>
                <TableHead className="text-gray-400">Plan</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Free</TableHead>
                <TableHead className="text-gray-400">Sub</TableHead>
                <TableHead className="text-gray-400">Paid</TableHead>
                <TableHead className="text-gray-400">Used</TableHead>
                <TableHead className="text-gray-400 min-w-[200px]">Current period end</TableHead>
                <TableHead className="text-gray-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-gray-900/30">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-gray-500">
                    Loading subscriptions and credits...
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-gray-500">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => {
                  const draft = drafts[record.user_id] || toDraftFromRecord(record);
                  const selectedPlan = plansById.get(
                    draft.subscription_plan_id === 'none' ? null : draft.subscription_plan_id
                  );
                  const selectedAction = actionSelections[record.user_id] || 'none';
                  const isSavingCredits = savingUserId === record.user_id;
                  const isDeletingCredits = deletingUserId === record.user_id;
                  const creditsActionLabel = record.has_credits_row ? 'Update credits' : 'Create credits';
                  const availableCredits =
                    toSafeInt(draft.free_credits, record.free_credits) +
                    toSafeInt(draft.subscription_credits, record.subscription_credits) +
                    toSafeInt(draft.paid_credits, record.paid_credits);

                  return (
                    <TableRow key={record.user_id} className="border-gray-800 align-top">
                      <TableCell>
                        <div className="font-medium text-white">{record.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{record.email || 'Email indisponible'}</div>
                        <div className="text-xs text-gray-500 mt-1">{record.user_id}</div>
                        <div className="text-xs text-gray-500 mt-1">Available: {availableCredits}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="border-gray-700 text-gray-300 w-fit">
                            {record.access_role || 'user'}
                          </Badge>
                          <Badge variant="outline" className="border-gray-800 text-gray-500 w-fit">
                            profile: {record.profile_role || 'user'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <Select
                          value={draft.subscription_plan_id || 'none'}
                          onValueChange={(value) => handleDraftChange(record.user_id, 'subscription_plan_id', value)}
                        >
                          <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
                            <SelectValue placeholder="Aucun abonnement" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800 text-white">
                            <SelectItem value="none">Aucun abonnement</SelectItem>
                            {plans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} ({plan.slug})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedPlan ? (
                          <div className="text-xs text-gray-500 mt-2">
                            {selectedPlan.credits_per_month} credits/month, {selectedPlan.price_cents / 100}{' '}
                            {selectedPlan.currency}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <Select
                          value={draft.subscription_status || 'none'}
                          onValueChange={(value) => handleDraftChange(record.user_id, 'subscription_status', value)}
                        >
                          <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800 text-white">
                            {SUBSCRIPTION_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status === 'none' ? 'none' : status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="w-[110px]">
                        <Input
                          type="number"
                          min={0}
                          value={draft.free_credits}
                          onChange={(event) => handleDraftChange(record.user_id, 'free_credits', event.target.value)}
                          className="h-9 bg-gray-950 border-gray-800 text-white"
                        />
                      </TableCell>
                      <TableCell className="w-[110px]">
                        <Input
                          type="number"
                          min={0}
                          value={draft.subscription_credits}
                          onChange={(event) =>
                            handleDraftChange(record.user_id, 'subscription_credits', event.target.value)
                          }
                          className="h-9 bg-gray-950 border-gray-800 text-white"
                        />
                      </TableCell>
                      <TableCell className="w-[110px]">
                        <Input
                          type="number"
                          min={0}
                          value={draft.paid_credits}
                          onChange={(event) => handleDraftChange(record.user_id, 'paid_credits', event.target.value)}
                          className="h-9 bg-gray-950 border-gray-800 text-white"
                        />
                      </TableCell>
                      <TableCell className="w-[110px]">
                        <Input
                          type="number"
                          min={0}
                          value={draft.total_used}
                          onChange={(event) => handleDraftChange(record.user_id, 'total_used', event.target.value)}
                          className="h-9 bg-gray-950 border-gray-800 text-white"
                        />
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <Input
                          type="datetime-local"
                          value={draft.current_period_end}
                          onChange={(event) =>
                            handleDraftChange(record.user_id, 'current_period_end', event.target.value)
                          }
                          className="h-9 bg-gray-950 border-gray-800 text-white"
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end">
                          <Select
                            value={selectedAction}
                            onValueChange={(value) => handleSelectRowAction(record, value)}
                          >
                            <SelectTrigger className="bg-gray-950 border-gray-800 text-white min-w-[190px]">
                              <SelectValue placeholder="Choose action" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800 text-white">
                              <SelectItem value="none">Choose action</SelectItem>
                              <SelectItem
                                value="update_credits"
                                disabled={!hasCreditsChanges(record) || isSavingCredits}
                              >
                                {isSavingCredits ? 'Saving credits...' : creditsActionLabel}
                              </SelectItem>
                              <SelectItem value="account">Account</SelectItem>
                              <SelectItem value="transactions">
                                {expandedUserId === record.user_id ? 'Hide transactions' : 'Transactions'}
                              </SelectItem>
                              <SelectItem
                                value="delete_credits"
                                disabled={!record.has_credits_row || isDeletingCredits}
                              >
                                {isDeletingCredits ? 'Deleting credits...' : 'Delete credits'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedRecord ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <UserCog className="w-5 h-5 text-orange-400" />
                User account - {selectedRecord.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{selectedRecord.user_id}</p>
              <p className="text-xs text-gray-500 mt-1">
                Account updates propagate through auth, profile and role mapping. Deletion is cascade.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchBillingData}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh users
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Input
              value={(userDrafts[selectedRecord.user_id] || toUserDraftFromRecord(selectedRecord)).email}
              onChange={(event) => handleUserDraftChange(selectedRecord.user_id, 'email', event.target.value)}
              placeholder="Email"
              className="bg-gray-950 border-gray-800 text-white"
            />
            <Input
              value={(userDrafts[selectedRecord.user_id] || toUserDraftFromRecord(selectedRecord)).full_name}
              onChange={(event) => handleUserDraftChange(selectedRecord.user_id, 'full_name', event.target.value)}
              placeholder="Full name"
              className="bg-gray-950 border-gray-800 text-white"
            />
            <Input
              value={(userDrafts[selectedRecord.user_id] || toUserDraftFromRecord(selectedRecord)).company_name}
              onChange={(event) => handleUserDraftChange(selectedRecord.user_id, 'company_name', event.target.value)}
              placeholder="Company name"
              className="bg-gray-950 border-gray-800 text-white"
            />
            <Input
              value={(userDrafts[selectedRecord.user_id] || toUserDraftFromRecord(selectedRecord)).phone}
              onChange={(event) => handleUserDraftChange(selectedRecord.user_id, 'phone', event.target.value)}
              placeholder="Phone"
              className="bg-gray-950 border-gray-800 text-white"
            />
            <Select
              value={(userDrafts[selectedRecord.user_id] || toUserDraftFromRecord(selectedRecord)).profile_role}
              onValueChange={(value) => handleUserDraftChange(selectedRecord.user_id, 'profile_role', value)}
            >
              <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
                <SelectValue placeholder="Profile role" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                {PROFILE_ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    profile: {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={(userDrafts[selectedRecord.user_id] || toUserDraftFromRecord(selectedRecord)).access_role}
              onValueChange={(value) => handleUserDraftChange(selectedRecord.user_id, 'access_role', value)}
            >
              <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
                <SelectValue placeholder="Access role" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                {ADMIN_ACCESS_ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    access: {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={(userDrafts[selectedRecord.user_id] || toUserDraftFromRecord(selectedRecord)).password}
              onChange={(event) => handleUserDraftChange(selectedRecord.user_id, 'password', event.target.value)}
              placeholder="New password (optional)"
              type="password"
              className="bg-gray-950 border-gray-800 text-white"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => handleSaveUser(selectedRecord)}
              disabled={!hasUserChanges(selectedRecord) || updatingAccountUserId === selectedRecord.user_id}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {updatingAccountUserId === selectedRecord.user_id ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving user
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Update user account
                </>
              )}
            </Button>

            <Button
              variant="destructive"
              onClick={() => handleDeleteUser(selectedRecord)}
              disabled={deletingAccountUserId === selectedRecord.user_id}
            >
              {deletingAccountUserId === selectedRecord.user_id ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting user
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete user account
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {expandedRecord ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-400" />
                Credit transactions - {expandedRecord.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">{expandedRecord.user_id}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => fetchTransactions(expandedRecord.user_id)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh transactions
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <Select
              value={
                (transactionDrafts[expandedRecord.user_id] || buildDefaultTransactionDraft(expandedRecord.user_id)).type
              }
              onValueChange={(value) => handleTransactionDraftChange(expandedRecord.user_id, 'type', value)}
            >
              <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800 text-white">
                {CREDIT_TRANSACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={
                (transactionDrafts[expandedRecord.user_id] || buildDefaultTransactionDraft(expandedRecord.user_id))
                  .amount
              }
              onChange={(event) => handleTransactionDraftChange(expandedRecord.user_id, 'amount', event.target.value)}
              placeholder="Amount (+/-)"
              className="bg-gray-950 border-gray-800 text-white"
            />
            <Input
              value={
                (transactionDrafts[expandedRecord.user_id] || buildDefaultTransactionDraft(expandedRecord.user_id))
                  .description
              }
              onChange={(event) =>
                handleTransactionDraftChange(expandedRecord.user_id, 'description', event.target.value)
              }
              placeholder="Description"
              className="bg-gray-950 border-gray-800 text-white"
            />
            <Button
              onClick={() => handleCreateTransaction(expandedRecord.user_id)}
              disabled={savingTransactionUserId === expandedRecord.user_id}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {savingTransactionUserId === expandedRecord.user_id ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Adding
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 mr-2" />
                  Add transaction
                </>
              )}
            </Button>
          </div>

          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-950">
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Amount</TableHead>
                  <TableHead className="text-gray-400">Description</TableHead>
                  <TableHead className="text-gray-400 text-right">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-gray-900/30">
                {loadingTransactionsUserId === expandedRecord.user_id ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-gray-500">
                      Loading transactions...
                    </TableCell>
                  </TableRow>
                ) : expandedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-gray-500">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  expandedTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="border-gray-800">
                      <TableCell className="text-gray-300">
                        {transaction.created_at ? new Date(transaction.created_at).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-700 text-gray-300">
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {transaction.amount}
                      </TableCell>
                      <TableCell className="text-gray-300">{transaction.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            deleteTransaction({
                              transactionId: transaction.id,
                              userId: expandedRecord.user_id,
                            })
                          }
                          disabled={deletingTransactionId === transaction.id}
                        >
                          {deletingTransactionId === transaction.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Deleting
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminBillingManager;
