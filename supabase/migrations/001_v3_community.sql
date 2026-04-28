-- v3.0 生态运营模块数据库迁移

-- 1. 论文表
CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  journal TEXT NOT NULL,
  doi TEXT,
  link TEXT,
  abstract TEXT,
  product_id UUID REFERENCES products(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  points_awarded INTEGER DEFAULT 0,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "papers_select_all" ON papers FOR SELECT USING (true);
CREATE POLICY "papers_insert_own" ON papers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "papers_update_own" ON papers FOR UPDATE USING (auth.uid() = user_id);

-- 2. 积分交易记录表
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'refund')),
  source TEXT NOT NULL,
  source_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_select_own" ON point_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pt_insert_admin" ON point_transactions FOR INSERT WITH CHECK (true);

-- 3. 积分商城商品表
CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  points_required INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_items_select_all" ON shop_items FOR SELECT USING (true);
CREATE POLICY "shop_items_insert_admin" ON shop_items FOR INSERT WITH CHECK (true);

-- 4. 兑换订单表
CREATE TABLE IF NOT EXISTS redeem_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id),
  points_spent INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE redeem_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redeem_select_own" ON redeem_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "redeem_insert_own" ON redeem_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. 用户积分余额视图（实时计算）
CREATE OR REPLACE VIEW user_points AS
SELECT
  user_id,
  COALESCE(SUM(CASE WHEN type = 'earn' THEN amount WHEN type = 'spend' THEN -amount ELSE 0 END), 0) AS balance
FROM point_transactions
GROUP BY user_id;

-- 6. 排行榜视图
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  au.id AS user_id,
  COALESCE((au.raw_user_meta_data->>'full_name'), au.email) AS display_name,
  COALESCE(up.balance, 0) AS points,
  (SELECT COUNT(*) FROM papers p WHERE p.user_id = au.id AND p.status = 'verified') AS paper_count,
  (SELECT COALESCE(SUM(points_awarded), 0) FROM papers p WHERE p.user_id = au.id AND p.status = 'verified') AS total_paper_points
FROM auth.users au
LEFT JOIN user_points up ON up.user_id = au.id
ORDER BY points DESC;

-- 7. 索引
CREATE INDEX IF NOT EXISTS idx_papers_user_id ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_pt_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_created_at ON point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_redeem_user_id ON redeem_orders(user_id);
