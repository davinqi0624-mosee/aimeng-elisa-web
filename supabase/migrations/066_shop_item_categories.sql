-- 积分商城商品分类：用于后台归类和前台快速筛选。
-- 执行时会同时为现有商品自动归类，避免历史商品出现空分类。

ALTER TABLE shop_items
  ADD COLUMN IF NOT EXISTS category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shop_items_category_check'
  ) THEN
    ALTER TABLE shop_items
      ADD CONSTRAINT shop_items_category_check
      CHECK (
        category IS NULL OR category IN (
          'digital', 'computer', 'office', 'sports_outdoor',
          'daily_life', 'food_drink', 'beauty', 'home_appliance',
          'travel', 'disposable', 'research', 'gift_card',
          'clothing', 'other'
        )
      );
  END IF;
END $$;

UPDATE shop_items
SET category = CASE
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ 'elisa|试剂盒|胎牛血清|生化检测|抗体|实验耗材|科研' THEN 'research'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '星巴克.*(礼卡|星礼卡)|瑞幸.*(礼卡|储值卡|卡实体)|礼品卡|储值卡' THEN 'gift_card'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '旅行箱|拉杆箱|旅行包' THEN 'travel'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '咖啡机|家电|电器' THEN 'home_appliance'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ 'iphone|airpods|apple watch|充电宝|手机|相机|大疆|dji|拍立得|稳定器|耳机|casio|电子表' THEN 'digital'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '羽毛球|篮球|橄榄球|网球拍|乒乓球|滑雪|骑行|护臂|运动|户外|登山|徒步|越野|跑步|睡袋|帐篷|露营|皮划艇|防晒伞|遮阳伞|头灯|腰包|背包|手套|帽子|护腕|发带' THEN 'sports_outdoor'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ 'macbook|mac mini|ipad|电脑|键盘|鼠标|显示器|硬盘|usb' THEN 'computer'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '咖啡杯|咖啡外带杯|保温杯|水杯|擦汗巾|生活用品' THEN 'daily_life'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '文具|办公|相纸' THEN 'office'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '食品|饮料|咖啡豆|零食' THEN 'food_drink'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '化妆|护肤|洗护|美妆' THEN 'beauty'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '一次性' THEN 'disposable'
  WHEN lower(coalesce(name, '') || ' ' || coalesce(description, '')) ~ '服饰|衣|裤|鞋|袜' THEN 'clothing'
  ELSE 'other'
END;

ALTER TABLE shop_items
  ALTER COLUMN category SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shop_items_category
  ON shop_items(category);

COMMENT ON COLUMN shop_items.category IS '积分商城商品分类代码；新商品必须选择固定分类。';

NOTIFY pgrst, 'reload schema';
