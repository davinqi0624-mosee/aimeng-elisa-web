-- 积分奖励防刷：每日签到 +1，首次有效 4PL 分析 +2。
-- 奖励由数据库函数原子写入，客户端不能直接伪造积分流水。

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS point_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('daily_checkin', 'analysis_4pl')),
  reward_date DATE NOT NULL,
  data_fingerprint TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, reward_type, reward_date)
);

CREATE INDEX IF NOT EXISTS idx_point_reward_claims_user_created
  ON point_reward_claims(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_reward_claims_unique_fingerprint
  ON point_reward_claims(user_id, reward_type, data_fingerprint)
  WHERE data_fingerprint IS NOT NULL;

ALTER TABLE point_reward_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS point_reward_claims_select_own ON point_reward_claims;
CREATE POLICY point_reward_claims_select_own
  ON point_reward_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_point_reward(
  p_user_id UUID,
  p_reward_type TEXT,
  p_reward_date DATE,
  p_amount INTEGER,
  p_data_fingerprint TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(awarded BOOLEAN, claim_id UUID, balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_claim_id UUID;
  existing_claim_id UUID;
  current_balance INTEGER;
  expected_amount INTEGER;
BEGIN
  expected_amount := CASE p_reward_type
    WHEN 'daily_checkin' THEN 1
    WHEN 'analysis_4pl' THEN 2
    ELSE 0
  END;

  IF expected_amount = 0 OR p_amount <> expected_amount THEN
    RAISE EXCEPTION 'invalid point reward';
  END IF;

  INSERT INTO public.point_reward_claims (
    user_id, reward_type, reward_date, data_fingerprint, metadata
  )
  VALUES (
    p_user_id, p_reward_type, p_reward_date, p_data_fingerprint, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (user_id, reward_type, reward_date) DO NOTHING
  RETURNING id INTO inserted_claim_id;

  IF inserted_claim_id IS NULL THEN
    SELECT id INTO existing_claim_id
    FROM public.point_reward_claims
    WHERE user_id = p_user_id
      AND reward_type = p_reward_type
      AND (
        reward_date = p_reward_date
        OR (p_data_fingerprint IS NOT NULL AND data_fingerprint = p_data_fingerprint)
      )
    ORDER BY reward_date DESC
    LIMIT 1;

    SELECT COALESCE(SUM(
      CASE
        WHEN type IN ('earn', 'refund') THEN amount
        WHEN type = 'spend' THEN -amount
        ELSE 0
      END
    ), 0)::INTEGER INTO current_balance
    FROM public.point_transactions
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT FALSE, existing_claim_id, current_balance;
    RETURN;
  END IF;

  -- 锁定用户档案，避免并发发奖时 balance_after 互相覆盖。
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    DELETE FROM public.point_reward_claims WHERE id = inserted_claim_id;
    RAISE EXCEPTION 'user profile not found';
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN type IN ('earn', 'refund') THEN amount
      WHEN type = 'spend' THEN -amount
      ELSE 0
    END
  ), 0)::INTEGER INTO current_balance
  FROM public.point_transactions
  WHERE user_id = p_user_id;

  INSERT INTO public.point_transactions (
    user_id,
    amount,
    balance_after,
    type,
    source,
    source_id,
    source_table,
    description
  )
  VALUES (
    p_user_id,
    p_amount,
    current_balance + p_amount,
    'earn',
    p_reward_type,
    inserted_claim_id,
    'point_reward_claims',
    CASE p_reward_type
      WHEN 'daily_checkin' THEN '每日登录签到奖励'
      WHEN 'analysis_4pl' THEN '首次有效4PL分析奖励'
    END
  );

  UPDATE public.profiles
  SET
    total_points = COALESCE(total_points, 0) + p_amount,
    available_points = current_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, inserted_claim_id, current_balance + p_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_point_reward(UUID, TEXT, DATE, INTEGER, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_point_reward(UUID, TEXT, DATE, INTEGER, TEXT, JSONB) TO service_role;

COMMENT ON TABLE point_reward_claims IS '用户自动积分奖励领取记录；每个奖励类型每天最多一条。';

NOTIFY pgrst, 'reload schema';
