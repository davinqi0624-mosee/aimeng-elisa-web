-- Tighten site_settings public access after adding encrypted AI provider secrets.
-- Public pages can still read ordinary site settings, but ai_provider_secrets
-- must never be selectable with the anon/authenticated Supabase clients.

REVOKE SELECT ON TABLE site_settings FROM anon, authenticated;

GRANT SELECT (
  id,
  homepage_content,
  product_media,
  lab_assets,
  ai_models,
  created_at,
  updated_at
) ON TABLE site_settings TO anon, authenticated;

DROP POLICY IF EXISTS site_settings_select_public ON site_settings;
CREATE POLICY site_settings_select_public
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

COMMENT ON COLUMN site_settings.ai_provider_secrets IS 'AI 供应商密钥配置。API Key 由服务器端加密保存，禁止 anon/authenticated 读取本列。';

NOTIFY pgrst, 'reload schema';
