-- 积分商城实物兑换流程：
-- 前台提交收货信息，后台审核后发货；取消订单时保留退积分能力。

ALTER TABLE redeem_orders
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address TEXT,
  ADD COLUMN IF NOT EXISTS shipping_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_company TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT;

DO $$
DECLARE
  check_name TEXT;
BEGIN
  FOR check_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'redeem_orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE redeem_orders DROP CONSTRAINT IF EXISTS %I', check_name);
  END LOOP;

  ALTER TABLE redeem_orders
    ADD CONSTRAINT redeem_orders_status_check
    CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled'));
END $$;

CREATE INDEX IF NOT EXISTS idx_redeem_orders_status_created
  ON redeem_orders(status, created_at DESC);

COMMENT ON COLUMN redeem_orders.contact_name IS '收件人姓名';
COMMENT ON COLUMN redeem_orders.contact_phone IS '收件人手机号或联系电话';
COMMENT ON COLUMN redeem_orders.contact_email IS '发货通知邮箱';
COMMENT ON COLUMN redeem_orders.shipping_address IS '收货地址';
COMMENT ON COLUMN redeem_orders.shipping_note IS '客户兑换备注';
COMMENT ON COLUMN redeem_orders.reviewed_at IS '后台审核通过时间';
COMMENT ON COLUMN redeem_orders.shipped_at IS '发货或完成时间';

NOTIFY pgrst, 'reload schema';
