-- 为说明书表添加商品关联，支持一键上架追踪
ALTER TABLE auto_datasheets ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_auto_datasheets_product_id ON auto_datasheets(product_id);
