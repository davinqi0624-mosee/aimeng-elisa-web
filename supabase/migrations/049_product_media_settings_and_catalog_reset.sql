-- 产品固定图片配置 + 产品目录重置支持：
-- 第 1 图片位、第 3 图片位是全站固定图，放在 site_settings.product_media 中维护。

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  homepage_content JSONB,
  product_media JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS homepage_content JSONB,
  ADD COLUMN IF NOT EXISTS product_media JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO site_settings (id, product_media)
VALUES (
  1,
  jsonb_build_object(
    'product_ad_image_url', '/images/elisa/elisa_sandwich_lego.jpg',
    'method_image_url', '/images/elisa/elisa_sandwich_sketch.jpg'
  )
)
ON CONFLICT (id) DO UPDATE SET
  product_media = COALESCE(NULLIF(site_settings.product_media, '{}'::jsonb), EXCLUDED.product_media),
  updated_at = NOW();

CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_updated_at();

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_settings_select_public ON site_settings;
CREATE POLICY site_settings_select_public
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (id = 1);

COMMENT ON COLUMN site_settings.product_media IS '产品详情页固定图片配置：第 1 图片位产品展示图、第 3 图片位方法学图。';

NOTIFY pgrst, 'reload schema';
