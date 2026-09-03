-- 注册会员赠送积分：同一用户只能领取一次注册奖励。

ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS source_table TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_unique_registration_bonus
  ON point_transactions(source_table, source_id, type)
  WHERE source_table = 'profiles'
    AND source = 'registration_bonus'
    AND type = 'earn'
    AND source_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
