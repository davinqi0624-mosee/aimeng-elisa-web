-- ============================================================
-- 产品图片表：支持每个产品多张图片
-- ============================================================

-- 1. 创建 product_images 表
CREATE TABLE IF NOT EXISTS product_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type TEXT NOT NULL DEFAULT 'other',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, image_type)
);

-- 2. 索引
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- 3. 为每个产品生成默认图片数据（4种类型）
-- 标准曲线
INSERT INTO product_images (product_id, image_url, image_type, display_order)
SELECT id, '/images/elisa/elisa_sandwich_sketch.jpg', 'standard_curve', 1
FROM products
WHERE status = 'active'
ON CONFLICT (product_id, image_type) DO NOTHING;

-- 实验参数
INSERT INTO product_images (product_id, image_url, image_type, display_order)
SELECT id, '/images/elisa/elisa_sandwich_pencil.jpg', 'parameters', 2
FROM products
WHERE status = 'active'
ON CONFLICT (product_id, image_type) DO NOTHING;

-- 检测原理
INSERT INTO product_images (product_id, image_url, image_type, display_order)
SELECT id, '/images/elisa/elisa_sandwich_lego.jpg', 'principle', 3
FROM products
WHERE status = 'active'
ON CONFLICT (product_id, image_type) DO NOTHING;

-- 验证数据
INSERT INTO product_images (product_id, image_url, image_type, display_order)
SELECT id, '/images/elisa/elisa_full_workflow_vertical.jpg', 'validation', 4
FROM products
WHERE status = 'active'
ON CONFLICT (product_id, image_type) DO NOTHING;
