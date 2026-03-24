-- Add rotation support columns to api_keys
ALTER TABLE IF EXISTS api_keys
  ADD COLUMN IF NOT EXISTS key_version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES api_keys(id),
  ADD COLUMN IF NOT EXISTS grace_period_days INT DEFAULT 7;
CREATE INDEX IF NOT EXISTS idx_api_keys_rotation
  ON api_keys(key_hash, is_active, superseded_at);
COMMENT ON COLUMN api_keys.superseded_at IS 'When this key was replaced by a new version';
COMMENT ON COLUMN api_keys.grace_period_days IS 'Days after superseded_at during which old key still works';
