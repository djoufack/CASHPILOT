import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, AlertTriangle, ShieldAlert, Download } from 'lucide-react';

const DangerZoneSettings = () => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const CONFIRM_PHRASE = 'DELETE';

  const handleExportData = async () => {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const userId = session.user.id;

      // Collect data from all user tables
      const tables = [
        'profiles',
        'clients',
        'projects',
        'invoices',
        'quotes',
        'expenses',
        'payments',
        'suppliers',
        'products',
        'credit_notes',
        'delivery_notes',
        'purchase_orders',
        'notifications',
      ];

      const exportData = {
        exported_at: new Date().toISOString(),
        user_email: session.user.email,
        data: {},
      };

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('user_id', userId);

          if (!error && data) {
            exportData.data[table] = data;
          }
        } catch {
          // Table might not exist or have different structure, skip
        }
      }

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cashpilot-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('gdpr.exportSuccess'),
        description: t('gdpr.exportSuccessDesc'),
      });
    } catch (err) {
      console.error('Data export error:', err);
      toast({
        title: t('common.error'),
        description: t('gdpr.exportError'),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmation: 'DELETE_MY_ACCOUNT' }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete account');
      }

      toast({
        title: t('gdpr.accountDeleted'),
        description: t('gdpr.accountDeletedDesc'),
      });

      // Sign out and redirect
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Delete account error:', err);
      toast({
        title: t('common.error'),
        description: t('gdpr.deleteError'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setConfirmText('');
      setDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* GDPR Data Export */}
      <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-blue-400" />
            <div>
              <CardTitle>{t('gdpr.exportTitle')}</CardTitle>
              <CardDescription className="text-gray-400">
                {t('gdpr.exportDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            {t('gdpr.exportInfo')}
          </p>
          <Button
            onClick={handleExportData}
            disabled={exporting}
            variant="outline"
            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('gdpr.exporting')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {t('gdpr.exportButton')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone - Account Deletion */}
      <Card className="bg-gray-900 border-red-500/50 text-white shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <div>
              <CardTitle className="text-red-400">{t('gdpr.dangerZone')}</CardTitle>
              <CardDescription className="text-gray-400">
                {t('gdpr.dangerZoneDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-300">
                  {t('gdpr.deleteWarningTitle')}
                </p>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>{t('gdpr.deleteWarning1')}</li>
                  <li>{t('gdpr.deleteWarning2')}</li>
                  <li>{t('gdpr.deleteWarning3')}</li>
                  <li>{t('gdpr.deleteWarning4')}</li>
                </ul>
              </div>
            </div>
          </div>

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('gdpr.deleteAccountButton')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-red-500/50 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  {t('gdpr.deleteConfirmTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-400 space-y-3">
                  <span className="block">
                    {t('gdpr.deleteConfirmDescription')}
                  </span>
                  <span className="block text-sm">
                    {t('gdpr.deleteConfirmType', { phrase: CONFIRM_PHRASE })}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="confirm-delete" className="text-gray-300 text-sm">
                  {t('gdpr.typeConfirmation')}
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  className="bg-gray-800 border-gray-700 text-white focus:ring-red-500 focus:border-red-500"
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                  onClick={() => setConfirmText('')}
                >
                  {t('common.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== CONFIRM_PHRASE || deleting}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('gdpr.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t('gdpr.confirmDeleteButton')}
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default DangerZoneSettings;
