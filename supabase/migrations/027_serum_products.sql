CREATE TABLE IF NOT EXISTS serum_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('fbs', 'animal-serum')),
  name TEXT NOT NULL,
  english_name TEXT DEFAULT '',
  catalog_number TEXT DEFAULT '',
  origin TEXT DEFAULT '',
  serum_type TEXT DEFAULT '',
  package_size TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  description TEXT[] DEFAULT '{}',
  applications TEXT[] DEFAULT '{}',
  quality_items JSONB DEFAULT '[]',
  cell_applications TEXT[] DEFAULT '{}',
  comparison_points JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_serum_products_category_status
  ON serum_products(category, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_serum_products_catalog_number
  ON serum_products(catalog_number);

CREATE OR REPLACE FUNCTION update_serum_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_serum_products_updated_at ON serum_products;
CREATE TRIGGER trg_serum_products_updated_at
  BEFORE UPDATE ON serum_products
  FOR EACH ROW
  EXECUTE FUNCTION update_serum_products_updated_at();
