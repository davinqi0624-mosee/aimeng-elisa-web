-- 实验室工具下载模板配置：
-- 允许后台上传并替换 ELISA 数据分析 Excel 模板，前台下载按钮自动读取当前配置。

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  homepage_content JSONB,
  product_media JSONB NOT NULL DEFAULT '{}',
  lab_assets JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS lab_assets JSONB NOT NULL DEFAULT '{}';

INSERT INTO site_settings (id, lab_assets)
VALUES (
  1,
  jsonb_build_object(
    'elisa_analysis_template_url', '/downloads/AM-ELISA数据分析模板.xlsx',
    'elisa_analysis_template_name', 'AM-ELISA数据分析模板.xlsx',
    'elisa_testing_service_form_url', '/downloads/AMUN-ELISA-testing-service-form.docx',
    'elisa_testing_service_form_name', 'AMUN Elisa实验代测表.docx'
  )
)
ON CONFLICT (id) DO UPDATE SET
  lab_assets = EXCLUDED.lab_assets || COALESCE(site_settings.lab_assets, '{}'::jsonb),
  updated_at = NOW();

COMMENT ON COLUMN site_settings.lab_assets IS '实验室工具下载资源配置，例如 ELISA 数据分析 Excel 模板。';

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_settings_select_public ON site_settings;
CREATE POLICY site_settings_select_public
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

NOTIFY pgrst, 'reload schema';
