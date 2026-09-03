-- 购买积分新增品类：其他生化检测试剂。
-- 该品类统一按 50 积分奖励，规格使用 default。

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN (
        'purchase_point_rules'::regclass,
        'purchase_point_codes'::regclass,
        'purchase_point_claims'::regclass
      )
      AND pg_get_constraintdef(oid) ILIKE '%product_type%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', constraint_record.table_name, constraint_record.conname);
  END LOOP;
END $$;

ALTER TABLE purchase_point_rules
  ADD CONSTRAINT purchase_point_rules_product_type_check
  CHECK (product_type IN ('elisa', 'fbs', 'animal_serum', 'biochemical_reagents'));

ALTER TABLE purchase_point_codes
  ADD CONSTRAINT purchase_point_codes_product_type_check
  CHECK (product_type IN ('elisa', 'fbs', 'animal_serum', 'biochemical_reagents'));

ALTER TABLE purchase_point_claims
  ADD CONSTRAINT purchase_point_claims_product_type_check
  CHECK (product_type IN ('elisa', 'fbs', 'animal_serum', 'biochemical_reagents'));

INSERT INTO purchase_point_rules (product_type, product_spec, points, sort_order, is_active)
VALUES ('biochemical_reagents', 'default', 50, 60, true)
ON CONFLICT (product_type, product_spec)
DO UPDATE SET
  points = 50,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';
