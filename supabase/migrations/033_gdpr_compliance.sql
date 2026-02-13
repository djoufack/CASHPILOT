-- GDPR Compliance Tables
-- DOWN: DROP TABLE IF EXISTS consent_logs; DROP TABLE IF EXISTS data_export_requests;

CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('cookies', 'analytics', 'marketing', 'necessary')),
  granted BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  file_size BIGINT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see/manage their own data
CREATE POLICY consent_logs_select_own ON consent_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY consent_logs_insert_own ON consent_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY consent_logs_update_own ON consent_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY data_export_select_own ON data_export_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY data_export_insert_own ON data_export_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_id ON consent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_user_id ON data_export_requests(user_id);
