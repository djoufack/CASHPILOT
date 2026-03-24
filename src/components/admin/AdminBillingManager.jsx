import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Coins, CreditCard, RefreshCw, Save, Search, Trash2, Wallet } from 'lucide-react';
import { CREDIT_TRANSACTION_TYPES, SUBSCRIPTION_STATUS_OPTIONS, useAdminBilling } from '@/hooks/useAdminBilling';

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
  subscription_status: record.subscription_status || 'inactive',
  current_period_end: toDateTimeLocalInput(record.current_period_end),
});

const buildDefaultTransactionDraft = (userId) => ({
  user_id: userId,
  type: 'bonus',
  amount: '',
  description: '',
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
    fetchBillingData,
    upsertUserCredits,
    deleteUserCredits,
    fetchTransactions,
    createTransaction,
    deleteTransaction,
  } = useAdminBilling();

  const [searchTerm, setSearchTerm] = useState('');
  const [drafts, setDrafts] = useState({});
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [transactionDrafts, setTransactionDrafts] = useState({});

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
  }, [records]);

  const plansById = useMemo(() => new Map((plans || []).map((plan) => [plan.id, plan])), [plans]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return records;

    return records.filter((record) => {
      const selectedPlan = plansById.get(record.subscription_plan_id);
      return [
        record.user_id,
        record.name,
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

  const hasChanges = (record) => {
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

  const handleSave = async (record) => {
    const draft = drafts[record.user_id];
    if (!draft) return;
    await upsertUserCredits(record, draft);
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Delete credits record for ${record.name}?`)) {
      return;
    }
    await deleteUserCredits(record);
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

  const expandedRecord = records.find((record) => record.user_id === expandedUserId) || null;
  const expandedTransactions = expandedUserId ? transactionsByUserId[expandedUserId] || [] : [];

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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-orange-400" />
              Subscriptions and credits
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Admin-only CRUD on <code>user_credits</code> for every platform user.
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
            placeholder="Search user, role, plan, status..."
            className="pl-9 bg-gray-950 border-gray-800 text-white"
          />
        </div>

        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <Table>
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
                  const availableCredits =
                    toSafeInt(draft.free_credits, record.free_credits) +
                    toSafeInt(draft.subscription_credits, record.subscription_credits) +
                    toSafeInt(draft.paid_credits, record.paid_credits);

                  return (
                    <TableRow key={record.user_id} className="border-gray-800 align-top">
                      <TableCell>
                        <div className="font-medium text-white">{record.name}</div>
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
                            <SelectValue placeholder="No plan" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800 text-white">
                            <SelectItem value="none">No plan (free)</SelectItem>
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
                          value={draft.subscription_status || 'inactive'}
                          onValueChange={(value) => handleDraftChange(record.user_id, 'subscription_status', value)}
                        >
                          <SelectTrigger className="bg-gray-950 border-gray-800 text-white">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800 text-white">
                            {SUBSCRIPTION_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
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
                        <div className="flex flex-col gap-2 items-end">
                          <Button
                            size="sm"
                            onClick={() => handleSave(record)}
                            disabled={!hasChanges(record) || savingUserId === record.user_id}
                            className="bg-orange-500 hover:bg-orange-600 text-white min-w-[96px]"
                          >
                            {savingUserId === record.user_id ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Saving
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                {record.has_credits_row ? 'Update' : 'Create'}
                              </>
                            )}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleTransactions(record)}
                            className="border-gray-700 text-gray-300 hover:bg-gray-800 min-w-[96px]"
                          >
                            <Coins className="w-4 h-4 mr-2" />
                            Txns
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(record)}
                            disabled={!record.has_credits_row || deletingUserId === record.user_id}
                            className="min-w-[96px]"
                          >
                            {deletingUserId === record.user_id ? (
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
