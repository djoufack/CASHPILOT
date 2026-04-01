-- CP-30-006 - Smart Dunning rules J+5 / J+15 / J+30 per company
-- Adds company-scoped, activable dunning rule metadata and seeds default 3-step rules.

ALTER TABLE public.payment_reminder_rules
  ADD COLUMN IF NOT EXISTS rule_category TEXT NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS dunning_step INTEGER,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS tone TEXT NOT NULL DEFAULT 'professional';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_reminder_rules_rule_category_check'
      AND conrelid = 'public.payment_reminder_rules'::regclass
  ) THEN
    ALTER TABLE public.payment_reminder_rules
      ADD CONSTRAINT payment_reminder_rules_rule_category_check
      CHECK (rule_category IN ('generic', 'smart_dunning'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_reminder_rules_channel_check'
      AND conrelid = 'public.payment_reminder_rules'::regclass
  ) THEN
    ALTER TABLE public.payment_reminder_rules
      ADD CONSTRAINT payment_reminder_rules_channel_check
      CHECK (channel IN ('email', 'sms', 'whatsapp', 'letter'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_reminder_rules_tone_check'
      AND conrelid = 'public.payment_reminder_rules'::regclass
  ) THEN
    ALTER TABLE public.payment_reminder_rules
      ADD CONSTRAINT payment_reminder_rules_tone_check
      CHECK (tone IN ('friendly', 'professional', 'firm', 'urgent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_reminder_rules_dunning_step_check'
      AND conrelid = 'public.payment_reminder_rules'::regclass
  ) THEN
    ALTER TABLE public.payment_reminder_rules
      ADD CONSTRAINT payment_reminder_rules_dunning_step_check
      CHECK (dunning_step IS NULL OR dunning_step BETWEEN 1 AND 10);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_reminder_rules_company_category_step
  ON public.payment_reminder_rules(company_id, rule_category, dunning_step);

CREATE INDEX IF NOT EXISTS idx_payment_reminder_rules_company_category_active
  ON public.payment_reminder_rules(company_id, rule_category, is_active, days_after_due);

WITH scoped_companies AS (
  SELECT c.id AS company_id, c.user_id
  FROM public.company c
),
default_dunning_rules AS (
  SELECT *
  FROM (
    VALUES
      (1, 'Relance J+5', 5, 'email', 'friendly', 1, true),
      (2, 'Relance J+15', 15, 'sms', 'professional', 1, true),
      (3, 'Relance J+30', 30, 'whatsapp', 'firm', 1, true)
  ) AS t(dunning_step, name, days_after_due, channel, tone, max_reminders, is_active)
)
INSERT INTO public.payment_reminder_rules (
  user_id,
  company_id,
  name,
  days_before_due,
  days_after_due,
  max_reminders,
  is_active,
  rule_category,
  dunning_step,
  channel,
  tone,
  updated_at
)
SELECT
  sc.user_id,
  sc.company_id,
  ddr.name,
  0,
  ddr.days_after_due,
  ddr.max_reminders,
  ddr.is_active,
  'smart_dunning',
  ddr.dunning_step,
  ddr.channel,
  ddr.tone,
  now()
FROM scoped_companies sc
CROSS JOIN default_dunning_rules ddr
ON CONFLICT (company_id, rule_category, dunning_step)
DO UPDATE SET
  name = EXCLUDED.name,
  days_after_due = EXCLUDED.days_after_due,
  channel = EXCLUDED.channel,
  tone = EXCLUDED.tone,
  max_reminders = EXCLUDED.max_reminders,
  updated_at = now();
