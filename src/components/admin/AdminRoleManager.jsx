import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminRoles, ADMIN_ACCESS_ROLES } from '@/hooks/useAdminRoles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { KeyRound, RefreshCw, ShieldCheck, Users } from 'lucide-react';

const ROLE_LABELS = {
  user: 'Standard user',
  manager: 'Manager',
  accountant: 'Accountant',
  admin: 'Admin',
};

const PROFILE_ROLE_LABELS = {
  user: 'User',
  client: 'Client',
  freelance: 'Freelance',
  manager: 'Manager',
  accountant: 'Accountant',
  admin: 'Admin',
};

const formatPermissions = (permissions) => {
  if (!permissions?.length) {
    return ['No elevated permissions'];
  }

  return permissions;
};

const AdminRoleManager = () => {
  const { t } = useTranslation();
  const { assignments, permissionsByRole, loading, savingUserId, fetchRoleData, updateAccessRole } = useAdminRoles();
  const [searchTerm, setSearchTerm] = useState('');
  const [draftRoles, setDraftRoles] = useState({});

  useEffect(() => {
    fetchRoleData();
  }, [fetchRoleData]);

  useEffect(() => {
    setDraftRoles(
      assignments.reduce((accumulator, assignment) => {
        accumulator[assignment.user_id] = assignment.access_role;
        return accumulator;
      }, {})
    );
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return assignments;
    }

    return assignments.filter((assignment) =>
      [
        assignment.name,
        assignment.profile_role,
        assignment.access_role,
        assignment.user_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );
  }, [assignments, searchTerm]);

  const accessCounts = useMemo(() => (
    assignments.reduce((accumulator, assignment) => {
      accumulator[assignment.access_role] = (accumulator[assignment.access_role] || 0) + 1;
      return accumulator;
    }, { user: 0, manager: 0, accountant: 0, admin: 0 })
  ), [assignments]);

  const handleSaveRole = async (assignment) => {
    const nextRole = draftRoles[assignment.user_id] || assignment.access_role;
    const success = await updateAccessRole(assignment, nextRole);

    if (!success) {
      setDraftRoles((current) => ({
        ...current,
        [assignment.user_id]: assignment.access_role,
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Admins</div>
          <div className="text-2xl font-bold text-white mt-1">{accessCounts.admin || 0}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Managers</div>
          <div className="text-2xl font-bold text-white mt-1">{accessCounts.manager || 0}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Accountants</div>
          <div className="text-2xl font-bold text-white mt-1">{accessCounts.accountant || 0}</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400">Standard access</div>
          <div className="text-2xl font-bold text-white mt-1">{accessCounts.user || 0}</div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
              Roles and permissions
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Elevated access is managed in <code>public.user_roles</code>. Profile role stays informational.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchRoleData}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ADMIN_ACCESS_ROLES.map((role) => (
            <div key={role} className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-white font-medium">{ROLE_LABELS[role]}</div>
                <Badge variant="outline" className="border-gray-700 text-gray-300">
                  {(permissionsByRole[role] || []).length}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {formatPermissions(permissionsByRole[role]).map((permission) => (
                  <Badge
                    key={`${role}-${permission}`}
                    variant="outline"
                    className="border-gray-700 text-gray-400"
                  >
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-400" />
              Access assignments
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Assign elevated roles without touching the informational profile type.
            </p>
          </div>
          <div className="w-full lg:w-80">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('admin.roleSearchPlaceholder')}
              className="bg-gray-950 border-gray-800 text-white"
            />
          </div>
        </div>

        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-950">
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-400">User</TableHead>
                <TableHead className="text-gray-400">Profile type</TableHead>
                <TableHead className="text-gray-400">Access level</TableHead>
                <TableHead className="text-gray-400 hidden xl:table-cell">Permissions</TableHead>
                <TableHead className="text-gray-400 hidden lg:table-cell">Updated</TableHead>
                <TableHead className="text-right text-gray-400">Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-gray-900/30">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                    Loading role assignments...
                  </TableCell>
                </TableRow>
              ) : filteredAssignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                    No matching assignments found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssignments.map((assignment) => {
                  const draftRole = draftRoles[assignment.user_id] || assignment.access_role;
                  const hasChanges = draftRole !== assignment.access_role;

                  return (
                    <TableRow key={assignment.user_id} className="border-gray-800">
                      <TableCell>
                        <div className="font-medium text-white">{assignment.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{assignment.user_id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-700 text-gray-300">
                          {PROFILE_ROLE_LABELS[assignment.profile_role] || assignment.profile_role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={draftRole}
                          onValueChange={(value) => setDraftRoles((current) => ({
                            ...current,
                            [assignment.user_id]: value,
                          }))}
                        >
                          <SelectTrigger className="w-full bg-gray-950 border-gray-800 text-white">
                            <SelectValue placeholder={t('admin.accessLevelPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-800 text-white">
                            {ADMIN_ACCESS_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex flex-wrap gap-2">
                          {formatPermissions(permissionsByRole[draftRole]).map((permission) => (
                            <Badge key={`${assignment.user_id}-${permission}`} variant="outline" className="border-gray-700 text-gray-400">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-gray-400">
                        {assignment.updated_at
                          ? new Date(assignment.updated_at).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSaveRole(assignment)}
                          disabled={!hasChanges || savingUserId === assignment.user_id}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          {savingUserId === assignment.user_id ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Saving
                            </>
                          ) : (
                            <>
                              <KeyRound className="w-4 h-4 mr-2" />
                              Save
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default AdminRoleManager;
