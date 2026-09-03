-- 产品前台详情展示字段固化：
-- 确保后台编辑/批量导入的核心介绍字段能稳定展示在商品详情页。

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS detection_method TEXT DEFAULT '双抗夹心法 (Sandwich ELISA)',
  ADD COLUMN IF NOT EXISTS sample_types_text TEXT;

UPDATE products
SET detection_method = '双抗夹心法 (Sandwich ELISA)'
WHERE detection_method IS NULL OR detection_method = '';

COMMENT ON COLUMN products.description IS '产品详情介绍，用于前台商品详情页“产品详情”。';
COMMENT ON COLUMN products.detection_method IS '检测方法，例如 双抗夹心法 (Sandwich ELISA)。';
COMMENT ON COLUMN products.sample_types_text IS '样本类型文本，例如 血清、血浆、细胞培养上清、组织匀浆。';

NOTIFY pgrst, 'reload schema';
