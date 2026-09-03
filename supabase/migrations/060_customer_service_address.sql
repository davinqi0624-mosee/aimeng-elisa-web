-- 联系我们页面的公司地址纳入后台官方客服配置，避免长期写死在前端页面。

ALTER TABLE customer_service_settings
  ADD COLUMN IF NOT EXISTS address TEXT;

UPDATE customer_service_settings
SET address = '上海市浦东新区张江高科技园区科苑路88号'
WHERE id = 1
  AND (address IS NULL OR BTRIM(address) = '');

ALTER TABLE customer_service_settings
  ALTER COLUMN address SET DEFAULT '上海市浦东新区张江高科技园区科苑路88号';

NOTIFY pgrst, 'reload schema';
