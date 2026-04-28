-- v4.0 说明书权限与货号系统升级

-- 1. 给 auto_datasheets 增加货号字段
ALTER TABLE auto_datasheets ADD COLUMN IF NOT EXISTS catalog_number TEXT;
ALTER TABLE auto_datasheets ADD COLUMN IF NOT EXISTS size TEXT DEFAULT '96T' CHECK (size IN ('96T', '48T'));

-- 2. 创建货号计数器表（按种属维护当前最大序号）
CREATE TABLE IF NOT EXISTS catalog_counters (
  species_code TEXT PRIMARY KEY,
  last_serial INTEGER NOT NULL DEFAULT 0
);

-- 3. 初始化计数器（基于 2026.04.26 产品目录最大值）
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
ON CONFLICT (species_code) DO UPDATE SET last_serial = EXCLUDED.last_serial;

-- 4. 创建货号序号递增函数（原子操作，防并发冲突）
CREATE OR REPLACE FUNCTION next_catalog_number(p_species_code TEXT, p_size TEXT)
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

  RETURN 'LV' || p_species_code || LPAD(v_serial::TEXT, 4, '0') || p_size;
END;
$$;
