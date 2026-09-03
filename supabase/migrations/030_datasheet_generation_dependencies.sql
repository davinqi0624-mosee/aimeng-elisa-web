-- 说明书生成依赖修复：管理员生成记录 + 爱萌优宁 LV 产品货号函数
-- 说明书货号结构：LV + 种属编号 + 流水号
-- 说明书固定覆盖 96T/48T，规格不进入说明书货号
-- 种属编号：1 Human / 2 Rat / 3 Mouse / 5 Monkey / 6 Canine / 7 Porcine
--         8 Bovine / 9 Chicken / 17 Guinea pig / 18 Sheep / 19 Zebrafish / 21 Rabbit

ALTER TABLE auto_datasheets
  ADD COLUMN IF NOT EXISTS catalog_number TEXT;

ALTER TABLE auto_datasheets
  ADD COLUMN IF NOT EXISTS size TEXT DEFAULT '96T' CHECK (size IN ('96T', '48T'));

ALTER TABLE auto_datasheets
  ADD COLUMN IF NOT EXISTS admin_id UUID;

ALTER TABLE auto_datasheets
  ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auto_datasheets_admin_id
  ON auto_datasheets(admin_id);

CREATE TABLE IF NOT EXISTS catalog_counters (
  species_code TEXT PRIMARY KEY,
  last_serial INTEGER NOT NULL DEFAULT 0
);

INSERT INTO catalog_counters (species_code, last_serial)
VALUES
  ('1', 1768),
  ('2', 1107),
  ('3', 1385),
  ('5', 860),
  ('6', 553),
  ('7', 615),
  ('8', 710),
  ('9', 562),
  ('17', 29),
  ('18', 27),
  ('19', 48),
  ('21', 9)
ON CONFLICT (species_code) DO UPDATE
SET last_serial = GREATEST(catalog_counters.last_serial, EXCLUDED.last_serial);

CREATE OR REPLACE FUNCTION public.next_catalog_number(p_species_code TEXT, p_size TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_serial INTEGER;
BEGIN
  UPDATE catalog_counters
  SET last_serial = last_serial + 1
  WHERE species_code = p_species_code
  RETURNING last_serial INTO v_serial;

  IF v_serial IS NULL THEN
    INSERT INTO catalog_counters (species_code, last_serial)
    VALUES (p_species_code, 1)
    RETURNING last_serial INTO v_serial;
  END IF;

  RETURN 'LV' || p_species_code || LPAD(v_serial::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_catalog_number(TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
