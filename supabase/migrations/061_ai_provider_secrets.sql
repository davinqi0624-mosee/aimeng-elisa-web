-- AI 密钥管理：
-- 允许超级管理员在后台维护 DeepSeek / Kimi 等供应商密钥。
-- 密钥由服务器端加密后写入 ai_provider_secrets，公开页面不可读取完整密钥。

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  homepage_content JSONB,
  product_media JSONB NOT NULL DEFAULT '{}',
  lab_assets JSONB NOT NULL DEFAULT '{}',
  ai_models JSONB NOT NULL DEFAULT '{}',
  ai_provider_secrets JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS ai_models JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_provider_secrets JSONB NOT NULL DEFAULT '{}';

INSERT INTO site_settings (id, ai_models, ai_provider_secrets)
VALUES (
  1,
  jsonb_build_object(
    'default_chat_provider', 'deepseek',
    'longform_provider', 'kimi',
    'protocol_provider', 'kimi',
    'datasheet_provider', 'kimi',
    'fallback_enabled', true
  ),
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  ai_models = COALESCE(site_settings.ai_models, '{}'::jsonb) || EXCLUDED.ai_models,
  ai_provider_secrets = COALESCE(site_settings.ai_provider_secrets, '{}'::jsonb),
  updated_at = NOW();

COMMENT ON COLUMN site_settings.ai_models IS 'AI 多模型路由设置。只保存任务到模型供应商的映射。';
COMMENT ON COLUMN site_settings.ai_provider_secrets IS 'AI 供应商密钥配置。API Key 由服务器端加密保存，公开接口不得返回明文。';

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_settings_select_public ON site_settings;
CREATE POLICY site_settings_select_public
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

NOTIFY pgrst, 'reload schema';
