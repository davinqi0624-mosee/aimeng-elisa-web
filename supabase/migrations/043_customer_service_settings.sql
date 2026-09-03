-- 官方客服配置：商品详情页“联系客服咨询”专用，不与代理商二维码混用。

CREATE TABLE IF NOT EXISTS customer_service_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  service_name TEXT NOT NULL DEFAULT '爱萌优宁官方客服',
  phone TEXT DEFAULT '400-888-0123',
  email TEXT DEFAULT 'service@animaluni.com',
  wechat_id TEXT DEFAULT '',
  wechat_qr_url TEXT DEFAULT '',
  work_hours TEXT DEFAULT '周一至周五 9:00 - 18:00',
  note TEXT DEFAULT '添加客服时请备注产品货号或产品名称，方便快速确认库存、报价、货期和资料。',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO customer_service_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION update_customer_service_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_service_settings_updated_at ON customer_service_settings;
CREATE TRIGGER trg_customer_service_settings_updated_at
  BEFORE UPDATE ON customer_service_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_service_settings_updated_at();

ALTER TABLE customer_service_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_service_settings_select_public ON customer_service_settings;
CREATE POLICY customer_service_settings_select_public
  ON customer_service_settings
  FOR SELECT
  TO PUBLIC
  USING (is_active = TRUE);

COMMENT ON TABLE customer_service_settings IS '官方客服配置，仅用于商品详情页联系客服弹窗。代理商二维码继续使用 agents 表。';

NOTIFY pgrst, 'reload schema';
