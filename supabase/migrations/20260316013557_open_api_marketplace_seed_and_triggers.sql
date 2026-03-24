-- ---------------------------------------------------------------------------
-- 6. Seed marketplace_apps with sample applications
-- ---------------------------------------------------------------------------
INSERT INTO public.marketplace_apps (name, slug, description, developer_name, icon_url, category, version, is_published, install_count, rating)
VALUES
  (
    'Slack Notifications',
    'slack-notifications',
    'Send invoice and payment notifications directly to your Slack channels. Supports custom channel routing per event type.',
    'CashPilot Labs',
    'https://cdn.cashpilot.tech/marketplace/slack.svg',
    'communication',
    '2.1.0',
    true,
    1240,
    4.70
  ),
  (
    'Google Sheets Sync',
    'google-sheets-sync',
    'Automatically sync your invoices, expenses, and client data to Google Sheets for custom reporting and analysis.',
    'CashPilot Labs',
    'https://cdn.cashpilot.tech/marketplace/google-sheets.svg',
    'productivity',
    '1.5.0',
    true,
    890,
    4.50
  ),
  (
    'Stripe Advanced',
    'stripe-advanced',
    'Enhanced Stripe integration with automatic reconciliation, dispute management, and payout tracking.',
    'FinTech Partners',
    'https://cdn.cashpilot.tech/marketplace/stripe.svg',
    'payments',
    '3.0.1',
    true,
    2150,
    4.80
  ),
  (
    'Tax Compliance EU',
    'tax-compliance-eu',
    'Automated VAT validation, VIES checks, and EU tax compliance reporting for cross-border transactions.',
    'EuroTax Solutions',
    'https://cdn.cashpilot.tech/marketplace/tax-eu.svg',
    'compliance',
    '1.2.0',
    true,
    560,
    4.30
  ),
  (
    'AI Receipt Scanner',
    'ai-receipt-scanner',
    'Snap a photo of any receipt and automatically extract vendor, amount, date, and category using AI vision.',
    'CashPilot Labs',
    'https://cdn.cashpilot.tech/marketplace/receipt-ai.svg',
    'automation',
    '2.0.0',
    true,
    1780,
    4.60
  ),
  (
    'Hubspot CRM Sync',
    'hubspot-crm-sync',
    'Two-way sync between CashPilot clients and HubSpot contacts. Automatically create deals from quotes.',
    'HubConnect Inc.',
    'https://cdn.cashpilot.tech/marketplace/hubspot.svg',
    'crm',
    '1.1.0',
    true,
    430,
    4.20
  )
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Helper: increment install_count on app install
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_increment_app_install_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_apps
  SET install_count = install_count + 1
  WHERE id = NEW.app_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_app_install_count ON public.installed_apps;
CREATE TRIGGER trg_increment_app_install_count
  AFTER INSERT ON public.installed_apps
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_increment_app_install_count();

-- ---------------------------------------------------------------------------
-- 8. Helper: decrement install_count on app uninstall
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_decrement_app_install_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_apps
  SET install_count = GREATEST(install_count - 1, 0)
  WHERE id = OLD.app_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_app_install_count ON public.installed_apps;
CREATE TRIGGER trg_decrement_app_install_count
  AFTER DELETE ON public.installed_apps
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_decrement_app_install_count();;
