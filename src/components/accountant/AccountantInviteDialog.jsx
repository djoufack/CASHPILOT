import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, User, Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const PERMISSION_KEYS = [
  'view_invoices',
  'view_expenses',
  'view_accounting',
  'view_reports',
  'export_fec',
  'export_data',
];

const defaultPermissions = () => PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});

export default function AccountantInviteDialog({ open, onOpenChange, onSend, loading }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState(defaultPermissions);

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await onSend(email.trim(), name.trim(), permissions);
      setEmail('');
      setName('');
      setPermissions(defaultPermissions());
      onOpenChange(false);
    } catch {
      // Error handled by hook toast
    }
  };

  const reset = () => {
    setEmail('');
    setName('');
    setPermissions(defaultPermissions());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) reset();
        onOpenChange(val);
      }}
    >
      <DialogContent className="border-white/10 bg-[#0f1528]/95 backdrop-blur-xl text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">{t('accountant.inviteTitle')}</DialogTitle>
          <DialogDescription className="text-slate-400">{t('accountant.inviteDescription')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="accountant-email" className="text-slate-300">
              {t('accountant.email')} *
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="accountant-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="comptable@exemple.fr"
                className="pl-10 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="accountant-name" className="text-slate-300">
              {t('accountant.name')}
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="accountant-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('accountant.namePlaceholder')}
                className="pl-10 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <Label className="text-slate-300">{t('accountant.permissions')}</Label>
            <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
              {PERMISSION_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <Checkbox
                    id={`perm-${key}`}
                    checked={permissions[key]}
                    onCheckedChange={() => togglePermission(key)}
                    className="border-white/20 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                  />
                  <Label htmlFor={`perm-${key}`} className="cursor-pointer text-sm text-slate-300">
                    {t(`accountant.perm_${key}`)}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t('accountant.sendInvitation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
