import { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Building2,
  Bell,
  CreditCard,
  Users,
  Fingerprint,
  Wifi,
  Palette,
  Coins,
  HardDrive,
  ShieldAlert,
  Plug,
  Shield,
  Globe,
} from 'lucide-react';
import ProfileSettings from '@/components/settings/ProfileSettings';
import CompanySettings from '@/components/settings/CompanySettings';
import BillingSettings from '@/components/settings/BillingSettings';
import TeamSettings from '@/components/settings/TeamSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import InvoiceCustomization from '@/components/settings/InvoiceCustomization';
import CreditsPurchase from '@/components/CreditsPurchase';
import BackupSettings from '@/components/settings/BackupSettings';
import BiometricSettings from '@/components/BiometricSettings';
import SyncManager from '@/components/SyncManager';
import DangerZoneSettings from '@/components/settings/DangerZoneSettings';
import ConnectionSettings from '@/components/settings/ConnectionSettings';
import GDPRSettings from '@/components/settings/GDPRSettings';
import PeppolSettings from '@/components/settings/PeppolSettings';
import { useEntitlements } from '@/hooks/useEntitlements';
import { ENTITLEMENT_KEYS, filterEntitledItems } from '@/utils/subscriptionEntitlements';

const TAB_MAP = {
  profil: 'profile',
  societe: 'company',
  facturation: 'billing',
  equipe: 'team',
  notifications: 'notifications',
  securite: 'security',
  sync: 'sync',
  factures: 'invoices',
  credits: 'credits',
  backup: 'backup',
  sauvegarde: 'backup',
  connexions: 'connections',
  api: 'connections',
  mcp: 'connections',
  'donnees-personnelles': 'personal-data',
  'personal-data': 'personal-data',
  peppol: 'peppol',
  gdpr: 'danger',
  danger: 'danger',
};

const SettingsPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const requestedTab = TAB_MAP[tabParam] || tabParam || 'profile';
  const { hasEntitlement } = useEntitlements();

  const tabs = useMemo(
    () => [
      {
        value: 'profile',
        label: t('common.profile', 'Profil'),
        icon: User,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <ProfileSettings />,
      },
      {
        value: 'company',
        label: t('settings.tabs.company', 'Société'),
        icon: Building2,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <CompanySettings />,
      },
      {
        value: 'billing',
        label: t('settings.tabs.billing', 'Facturation'),
        icon: CreditCard,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <BillingSettings />,
      },
      {
        value: 'team',
        label: t('settings.tabs.team', 'Équipe'),
        icon: Users,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <TeamSettings />,
        featureKey: ENTITLEMENT_KEYS.ORGANIZATION_TEAM,
      },
      {
        value: 'notifications',
        label: t('notifications.title', 'Notifications'),
        icon: Bell,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <NotificationSettings />,
      },
      {
        value: 'security',
        label: t('nav.security', 'Sécurité'),
        icon: Fingerprint,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <BiometricSettings />,
      },
      {
        value: 'invoices',
        label: t('common.invoices', 'Factures'),
        icon: Palette,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <InvoiceCustomization />,
      },
      {
        value: 'credits',
        label: t('settings.tabs.credits', 'Credits'),
        icon: Coins,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <CreditsPurchase />,
      },
      {
        value: 'backup',
        label: t('settings.tabs.backup', 'Backup'),
        icon: HardDrive,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <BackupSettings />,
      },
      {
        value: 'sync',
        label: t('settings.tabs.sync', 'Sync'),
        icon: Wifi,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <SyncManager />,
      },
      {
        value: 'connections',
        label: t('settings.tabs.connections', 'Connexions API & MCP'),
        icon: Plug,
        activeClassName: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400',
        content: <ConnectionSettings />,
      },
      {
        value: 'peppol',
        label: t('settings.tabs.peppol', 'Peppol'),
        icon: Globe,
        activeClassName: 'data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400',
        content: <PeppolSettings />,
      },
      {
        value: 'personal-data',
        label: t('settings.tabs.personalData', 'Mes données'),
        icon: Shield,
        activeClassName: 'data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400',
        content: <GDPRSettings />,
      },
      {
        value: 'danger',
        label: t('settings.tabs.gdpr', 'GDPR'),
        icon: ShieldAlert,
        activeClassName: 'data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400',
        content: <DangerZoneSettings />,
      },
    ],
    [t]
  );

  const visibleTabs = useMemo(() => filterEntitledItems(tabs, hasEntitlement), [hasEntitlement, tabs]);

  const defaultTab = visibleTabs.some((tab) => tab.value === requestedTab) ? requestedTab : 'profile';

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      <Helmet>
        <title>{t('common.settings', 'Settings')} | CashPilot</title>
      </Helmet>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{t('common.settings', 'Settings')}</h1>
        <p className="text-gray-400 mt-2 text-sm">
          {t('settings.subtitle', 'Gérez votre profil, votre société et vos préférences.')}
        </p>
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab} className="w-full">
        <TabsList className="bg-gray-900 border-gray-800 w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={tab.activeClassName}>
              <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SettingsPage;
