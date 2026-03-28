import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserPlus, Users, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccountantPortal } from '@/hooks/useAccountantPortal';
import { useAccountantCollaborationTasks } from '@/hooks/useAccountantCollaborationTasks';
import AccountantInviteDialog from '@/components/accountant/AccountantInviteDialog';
import AccountantAccessList from '@/components/accountant/AccountantAccessList';
import AccountantCollaborationWorkspace from '@/components/accountant/AccountantCollaborationWorkspace';

export default function AccountantPortalPage() {
  const { t } = useTranslation();
  const [inviteOpen, setInviteOpen] = useState(false);

  const {
    invitations,
    invitationsLoading,
    accessList,
    accessLoading,
    actionLoading,
    sendInvitation,
    revokeAccess,
    revokeInvitation,
    refetchInvitations,
    refetchAccess,
  } = useAccountantPortal();
  const {
    tasks,
    loading: tasksLoading,
    actionLoading: tasksActionLoading,
    createTask,
    updateTaskStatus,
    deleteTask,
    refetchTasks,
  } = useAccountantCollaborationTasks();

  const pendingCount = invitations.filter((inv) => inv.status === 'pending').length;
  const activeCount = accessList.length;

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('accountant.portalTitle')}</h1>
            <p className="text-sm text-slate-400">{t('accountant.portalDescription')}</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{activeCount}</p>
              <p className="text-xs text-slate-400">{t('accountant.activeAccess')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
              <p className="text-xs text-slate-400">{t('accountant.pendingInvitations')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#141c33]/80 backdrop-blur">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{invitations.length}</p>
              <p className="text-xs text-slate-400">{t('accountant.totalInvitations')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Button onClick={() => setInviteOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('accountant.inviteAccountant')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            refetchInvitations();
            refetchAccess();
            refetchTasks();
          }}
          disabled={invitationsLoading || accessLoading || tasksLoading}
          className="text-slate-400 hover:text-white hover:bg-white/10"
        >
          {invitationsLoading || accessLoading || tasksLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t('accountant.refresh')}
        </Button>
      </div>

      {/* Access list */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          {t('accountant.accessAndInvitations')}
          <Badge variant="outline" className="border-white/10 text-slate-400 text-xs">
            {accessList.length + invitations.length}
          </Badge>
        </h2>
      </div>

      <AccountantAccessList
        invitations={invitations}
        accessList={accessList}
        onRevokeAccess={revokeAccess}
        onRevokeInvitation={revokeInvitation}
        loading={actionLoading}
      />

      <div className="mt-8">
        <AccountantCollaborationWorkspace
          tasks={tasks}
          loading={tasksLoading || tasksActionLoading}
          onRefresh={refetchTasks}
          onCreateTask={createTask}
          onUpdateTaskStatus={updateTaskStatus}
          onDeleteTask={deleteTask}
        />
      </div>

      {/* Invite dialog */}
      <AccountantInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSend={sendInvitation}
        loading={actionLoading}
      />
    </div>
  );
}
