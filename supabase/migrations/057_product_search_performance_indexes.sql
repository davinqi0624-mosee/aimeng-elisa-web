-- Product search performance repair:
-- Speeds up product lookup, species filtering, and fuzzy matching for ELISA catalog searches.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_status_species
  ON products(status, species);

CREATE INDEX IF NOT EXISTS idx_products_status_featured
  ON products(status, is_featured DESC);

CREATE INDEX IF NOT EXISTS idx_products_catalog_number_lower
  ON products(LOWER(catalog_number));

CREATE INDEX IF NOT EXISTS idx_products_cat_no_lower
  ON products(LOWER(cat_no));

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_target_trgm
  ON products USING GIN (target gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_catalog_number_trgm
  ON products USING GIN (catalog_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_cat_no_trgm
  ON products USING GIN (cat_no gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_aliases_alias_trgm
  ON product_aliases USING GIN (alias gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_aliases_product_id
  ON product_aliases(product_id);

CREATE INDEX IF NOT EXISTS idx_product_species_species_product
  ON product_species(species, product_id);

NOTIFY pgrst, 'reload schema';
