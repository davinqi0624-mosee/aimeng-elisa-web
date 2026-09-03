-- 生化法试剂盒独立产品目录。
-- 不复用 products 表，避免把 ELISA 的 48T、灵敏度、检测范围等字段带入生化产品。

CREATE TABLE IF NOT EXISTS biochemical_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_number TEXT NOT NULL,
  indicator_name TEXT NOT NULL,
  specifications TEXT[] NOT NULL DEFAULT ARRAY['96T']::TEXT[],
  wavelength TEXT NOT NULL DEFAULT '',
  price_96t NUMERIC(12, 2) NOT NULL CHECK (price_96t >= 0),
  price_48t NUMERIC(12, 2) CHECK (price_48t IS NULL OR price_48t >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT biochemical_products_catalog_number_unique UNIQUE (catalog_number)
  ,CONSTRAINT biochemical_products_specifications_check CHECK (
    specifications <@ ARRAY['48T', '96T']::TEXT[]
    AND specifications @> ARRAY['96T']::TEXT[]
    AND cardinality(specifications) BETWEEN 1 AND 2
    AND (('48T' = ANY(specifications) AND price_48t IS NOT NULL) OR NOT ('48T' = ANY(specifications)))
  )
);

CREATE INDEX IF NOT EXISTS idx_biochemical_products_active_sort
  ON biochemical_products(status, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_biochemical_products_indicator
  ON biochemical_products(indicator_name);

CREATE INDEX IF NOT EXISTS idx_biochemical_products_wavelength
  ON biochemical_products(wavelength);

ALTER TABLE biochemical_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS biochemical_products_select_active ON biochemical_products;
CREATE POLICY biochemical_products_select_active
  ON biochemical_products
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE OR REPLACE FUNCTION update_biochemical_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_biochemical_products_updated_at ON biochemical_products;
CREATE TRIGGER trg_biochemical_products_updated_at
  BEFORE UPDATE ON biochemical_products
  FOR EACH ROW
  EXECUTE FUNCTION update_biochemical_products_updated_at();

COMMENT ON TABLE biochemical_products IS '生化法试剂盒独立产品目录，仅使用货号、指标名称、规格、操作波长和对应价格等生化字段。';
COMMENT ON COLUMN biochemical_products.specifications IS '生化法试剂盒规格。96T必选，48T可选。';
COMMENT ON COLUMN biochemical_products.price_96t IS '生化法试剂盒96T规格手动录入价格。';
COMMENT ON COLUMN biochemical_products.price_48t IS '生化法试剂盒48T规格手动录入价格，可为空。';

NOTIFY pgrst, 'reload schema';
