-- 购买积分申请：
-- 积分码作为主凭证；规则和活动用于计算；照片用于辅助审核和后续宣传奖励。

CREATE TABLE IF NOT EXISTS purchase_point_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type TEXT NOT NULL CHECK (product_type IN ('elisa', 'fbs', 'animal_serum')),
  product_spec TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL CHECK (points >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type, product_spec)
);

CREATE TABLE IF NOT EXISTS purchase_point_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  product_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  product_specs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  multiplier NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (multiplier >= 1),
  bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_point_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL CHECK (product_type IN ('elisa', 'fbs', 'animal_serum')),
  product_spec TEXT NOT NULL DEFAULT '',
  catalog_number TEXT,
  batch_number TEXT,
  base_points INTEGER NOT NULL CHECK (base_points >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'disabled', 'expired')),
  expires_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_claim_id UUID,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_point_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('elisa', 'fbs', 'animal_serum')),
  product_spec TEXT NOT NULL DEFAULT '',
  point_code TEXT NOT NULL,
  point_code_id UUID REFERENCES purchase_point_codes(id) ON DELETE SET NULL,
  catalog_number TEXT,
  batch_number TEXT,
  purchase_channel TEXT,
  photo_consent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  base_points INTEGER NOT NULL DEFAULT 0 CHECK (base_points >= 0),
  campaign_id UUID REFERENCES purchase_point_campaigns(id) ON DELETE SET NULL,
  campaign_name TEXT,
  campaign_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (campaign_multiplier >= 1),
  campaign_bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (campaign_bonus_points >= 0),
  photo_bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (photo_bonus_points >= 0),
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  duplicate_warnings JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'needs_more_info', 'approved', 'rejected', 'archived')),
  review_note TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES admin_accounts(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_point_claim_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES purchase_point_claims(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL DEFAULT 'product_front',
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  file_hash TEXT NOT NULL,
  storage_status TEXT NOT NULL DEFAULT 'active' CHECK (storage_status IN ('active', 'archived', 'deleted')),
  archive_batch TEXT,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_point_rules_active
  ON purchase_point_rules(product_type, product_spec, is_active);

CREATE INDEX IF NOT EXISTS idx_purchase_point_campaigns_active
  ON purchase_point_campaigns(is_active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_purchase_point_codes_code
  ON purchase_point_codes(code);

CREATE INDEX IF NOT EXISTS idx_purchase_point_codes_status
  ON purchase_point_codes(status, product_type, product_spec);

CREATE INDEX IF NOT EXISTS idx_purchase_point_claims_user
  ON purchase_point_claims(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_point_claims_status
  ON purchase_point_claims(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_point_claims_code
  ON purchase_point_claims(point_code);

CREATE INDEX IF NOT EXISTS idx_purchase_point_claim_photos_hash
  ON purchase_point_claim_photos(file_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_point_claims_active_code
  ON purchase_point_claims(upper(point_code))
  WHERE status IN ('pending', 'needs_more_info', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_unique_purchase_claim_award
  ON point_transactions(source_table, source_id, type)
  WHERE source_table = 'purchase_point_claims'
    AND type = 'earn'
    AND source_id IS NOT NULL;

ALTER TABLE purchase_point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_point_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_point_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_point_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_point_claim_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_point_claims_select_own ON purchase_point_claims;
CREATE POLICY purchase_point_claims_select_own
  ON purchase_point_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS purchase_point_claim_photos_select_own ON purchase_point_claim_photos;
CREATE POLICY purchase_point_claim_photos_select_own
  ON purchase_point_claim_photos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO purchase_point_rules (product_type, product_spec, points, sort_order)
VALUES
  ('elisa', '96T', 50, 10),
  ('elisa', '48T', 25, 20),
  ('fbs', '500ml', 50, 30),
  ('fbs', '50ml*10', 50, 40),
  ('animal_serum', 'default', 20, 50)
ON CONFLICT (product_type, product_spec)
DO UPDATE SET
  points = EXCLUDED.points,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 20971520),
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
WHERE id = 'product-assets';

UPDATE purchase_point_codes
SET code = upper(trim(code))
WHERE code <> upper(trim(code));

CREATE OR REPLACE FUNCTION update_purchase_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_point_rules_updated_at ON purchase_point_rules;
CREATE TRIGGER trg_purchase_point_rules_updated_at
  BEFORE UPDATE ON purchase_point_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_points_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_point_campaigns_updated_at ON purchase_point_campaigns;
CREATE TRIGGER trg_purchase_point_campaigns_updated_at
  BEFORE UPDATE ON purchase_point_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_points_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_point_codes_updated_at ON purchase_point_codes;
CREATE TRIGGER trg_purchase_point_codes_updated_at
  BEFORE UPDATE ON purchase_point_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_points_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_point_claims_updated_at ON purchase_point_claims;
CREATE TRIGGER trg_purchase_point_claims_updated_at
  BEFORE UPDATE ON purchase_point_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_points_updated_at();

COMMENT ON TABLE purchase_point_claims IS '客户购买爱萌优宁商品后的积分申请。积分码是主凭证，照片为辅助审核和额外奖励依据。';
COMMENT ON COLUMN purchase_point_claim_photos.file_hash IS '上传图片内容哈希，用于识别重复照片和后续归档清理后保留追溯。';
COMMENT ON COLUMN purchase_point_campaigns.multiplier IS '活动倍率。最终购买积分 = 基础积分 * 倍率 + 活动额外积分 + 照片奖励积分。';

NOTIFY pgrst, 'reload schema';
