-- AI 多模型路由设置：
-- API Key 仍放服务器环境变量；后台只保存不同任务使用哪个模型，以及是否启用备用模型。

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  homepage_content JSONB,
  product_media JSONB NOT NULL DEFAULT '{}',
  lab_assets JSONB NOT NULL DEFAULT '{}',
  ai_models JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS ai_models JSONB NOT NULL DEFAULT '{}';

INSERT INTO site_settings (id, ai_models)
VALUES (
  1,
  jsonb_build_object(
    'default_chat_provider', 'deepseek',
    'longform_provider', 'kimi',
    'protocol_provider', 'kimi',
    'datasheet_provider', 'kimi',
    'fallback_enabled', true
  )
)
ON CONFLICT (id) DO UPDATE SET
  ai_models = EXCLUDED.ai_models || COALESCE(site_settings.ai_models, '{}'::jsonb),
  updated_at = NOW();

COMMENT ON COLUMN site_settings.ai_models IS 'AI 多模型路由设置。只保存任务到模型供应商的映射，不保存任何 API Key。';

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_settings_select_public ON site_settings;
CREATE POLICY site_settings_select_public
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

NOTIFY pgrst, 'reload schema';
