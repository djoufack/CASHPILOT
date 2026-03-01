
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ShieldCheck } from 'lucide-react';

const UserManagement = () => {
  const { t } = useTranslation();
  const { users, fetchUsers, loading } = useUsers();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gradient">{t('admin.users')}</h2>
          <p className="text-sm text-gray-400 mt-1">
            Profile directory only. Elevated access is managed in the Roles and permissions tab.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchUsers}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-sm text-gray-300 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
        <div>
          User emails are intentionally not exposed from the client scope.
          Access elevation is server-authoritative through <code>public.user_roles</code>.
        </div>
      </div>

      <div className="border border-gray-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-900">
            <TableRow className="border-gray-800">
              <TableHead className="text-gray-400">Name</TableHead>
              <TableHead className="text-gray-400">Email</TableHead>
              <TableHead className="text-gray-400">{t('admin.role')}</TableHead>
              <TableHead className="text-gray-400">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-gray-900/50">
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="border-gray-800">
                  <TableCell className="font-medium text-gradient">{user.name || 'N/A'}</TableCell>
                  <TableCell className="text-gray-300">{user.email || 'Unavailable from client scope'}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserManagement;
