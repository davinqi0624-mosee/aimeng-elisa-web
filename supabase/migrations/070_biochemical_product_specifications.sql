-- 生化法试剂盒规格与价格兼容升级。
-- 如果 069 已经执行，本迁移把单一96T结构升级为96T必有、48T可选。

ALTER TABLE biochemical_products
  ADD COLUMN IF NOT EXISTS specifications TEXT[];

ALTER TABLE biochemical_products
  ADD COLUMN IF NOT EXISTS price_96t NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS price_48t NUMERIC(12, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'biochemical_products' AND column_name = 'specification'
  ) THEN
    EXECUTE $sql$
      UPDATE biochemical_products
      SET
        specifications = CASE
          WHEN COALESCE(specification, '96T') = '48T' THEN ARRAY['96T', '48T']::TEXT[]
          ELSE ARRAY['96T']::TEXT[]
        END,
        price_96t = COALESCE(price_96t, price),
        price_48t = CASE WHEN COALESCE(specification, '96T') = '48T' THEN price ELSE price_48t END
      WHERE specifications IS NULL OR price_96t IS NULL
    $sql$;
  ELSE
    UPDATE biochemical_products
    SET
      specifications = COALESCE(specifications, ARRAY['96T']::TEXT[]),
      price_96t = COALESCE(price_96t, 0)
    WHERE specifications IS NULL OR price_96t IS NULL;
  END IF;
END $$;

ALTER TABLE biochemical_products
  DROP CONSTRAINT IF EXISTS biochemical_products_specification_check,
  DROP CONSTRAINT IF EXISTS biochemical_products_specifications_check;

ALTER TABLE biochemical_products
  ALTER COLUMN specifications SET DEFAULT ARRAY['96T']::TEXT[],
  ALTER COLUMN specifications SET NOT NULL,
  ALTER COLUMN price_96t SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'biochemical_products' AND column_name = 'price'
  ) THEN
    ALTER TABLE biochemical_products ALTER COLUMN price DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE biochemical_products
  ADD CONSTRAINT biochemical_products_specifications_check CHECK (
    specifications <@ ARRAY['48T', '96T']::TEXT[]
    AND specifications @> ARRAY['96T']::TEXT[]
    AND cardinality(specifications) BETWEEN 1 AND 2
    AND (('48T' = ANY(specifications) AND price_48t IS NOT NULL) OR NOT ('48T' = ANY(specifications)))
  );

CREATE INDEX IF NOT EXISTS idx_biochemical_products_specifications
  ON biochemical_products USING GIN (specifications);

COMMENT ON COLUMN biochemical_products.specifications IS '生化法试剂盒规格。96T必选，48T可选。';
COMMENT ON COLUMN biochemical_products.price_96t IS '生化法试剂盒96T规格手动录入价格。';
COMMENT ON COLUMN biochemical_products.price_48t IS '生化法试剂盒48T规格手动录入价格，可为空。';

NOTIFY pgrst, 'reload schema';
