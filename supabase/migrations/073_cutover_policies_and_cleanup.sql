-- 073: cutover 迁移（与新认证代码同窗口应用）
-- 1) own-data 策略表达式：auth.uid() → app_uid()（public schema，PostgREST 与直连事务都能读），
--    角色面扩为 authenticated + app_user（authenticated 暂留保证旧会话零中断，075 收尾时移除）
-- 2) 关闭活库宽开口策略（2026-09-05 快照：papers_full_access / pt_insert_open 等匿名任意写通道）
-- 3) 删除死策略与废弃脚手架表
-- 4) leaderboard 视图改建于 app_users

-- ===== 1) own-data 策略改写（语义与活库完全一致，仅换身份函数 + 扩角色面） =====
DROP POLICY IF EXISTS "Users can insert own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
CREATE POLICY "Users can insert own conversations" ON ai_conversations FOR INSERT
  WITH CHECK ((user_id = app_uid()) OR (user_id IS NULL));
CREATE POLICY "Users can view own conversations" ON ai_conversations FOR SELECT
  USING (user_id = app_uid());

DROP POLICY IF EXISTS "Users can insert own messages" ON ai_messages;
DROP POLICY IF EXISTS "Users can view own messages" ON ai_messages;
CREATE POLICY "Users can insert own messages" ON ai_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM ai_conversations c
    WHERE c.id = ai_messages.conversation_id
      AND (c.user_id = app_uid() OR c.user_id IS NULL)));
CREATE POLICY "Users can view own messages" ON ai_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM ai_conversations c
    WHERE c.id = ai_messages.conversation_id
      AND (c.user_id = app_uid() OR c.user_id IS NULL)));

DROP POLICY IF EXISTS datasheet_select_own ON auto_datasheets;
DROP POLICY IF EXISTS datasheet_insert_own ON auto_datasheets;
DROP POLICY IF EXISTS datasheet_update_own ON auto_datasheets;
DROP POLICY IF EXISTS datasheet_delete_own ON auto_datasheets;
CREATE POLICY datasheet_select_own ON auto_datasheets FOR SELECT USING (app_uid() = user_id);
CREATE POLICY datasheet_insert_own ON auto_datasheets FOR INSERT WITH CHECK (app_uid() = user_id);
CREATE POLICY datasheet_update_own ON auto_datasheets FOR UPDATE USING (app_uid() = user_id);
CREATE POLICY datasheet_delete_own ON auto_datasheets FOR DELETE USING (app_uid() = user_id);

DROP POLICY IF EXISTS "Public experiments are viewable" ON experiments;
DROP POLICY IF EXISTS "Users can manage own experiments" ON experiments;
CREATE POLICY "Public experiments are viewable" ON experiments FOR SELECT
  USING ((is_public = true) OR (user_id = app_uid()));
CREATE POLICY "Users can manage own experiments" ON experiments FOR ALL
  USING (user_id = app_uid()) WITH CHECK (user_id = app_uid());

DROP POLICY IF EXISTS papers_select_own ON papers;
DROP POLICY IF EXISTS papers_insert_own ON papers;
DROP POLICY IF EXISTS papers_select_public ON papers;
CREATE POLICY papers_select_own ON papers FOR SELECT
  TO authenticated, app_user USING (app_uid() = user_id);
CREATE POLICY papers_insert_own ON papers FOR INSERT
  TO authenticated, app_user WITH CHECK (
    (app_uid() = user_id)
    AND (upload_status = 'pending')
    AND (status = 'pending')
    AND (COALESCE(is_displayed, false) = false)
    AND (COALESCE(points_awarded, 0) = 0)
    AND (citation_type = 'user_submitted')
    AND (source_type IN ('customer_upload', 'manual_form'))
  );
CREATE POLICY papers_select_public ON papers FOR SELECT
  TO anon, authenticated, app_user
  USING ((upload_status = 'verified') AND (is_displayed = true));

DROP POLICY IF EXISTS pt_select_own ON point_transactions;
CREATE POLICY pt_select_own ON point_transactions FOR SELECT
  TO authenticated, app_user USING (app_uid() = user_id);

DROP POLICY IF EXISTS point_reward_claims_select_own ON point_reward_claims;
CREATE POLICY point_reward_claims_select_own ON point_reward_claims FOR SELECT
  TO authenticated, app_user USING (app_uid() = user_id);

DROP POLICY IF EXISTS purchase_point_claims_select_own ON purchase_point_claims;
CREATE POLICY purchase_point_claims_select_own ON purchase_point_claims FOR SELECT
  TO authenticated, app_user USING (app_uid() = user_id);

DROP POLICY IF EXISTS purchase_point_claim_photos_select_own ON purchase_point_claim_photos;
CREATE POLICY purchase_point_claim_photos_select_own ON purchase_point_claim_photos FOR SELECT
  TO authenticated, app_user USING (app_uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE
  USING (app_uid() = id);

DROP POLICY IF EXISTS redeem_select_own ON redeem_orders;
DROP POLICY IF EXISTS redeem_insert_own ON redeem_orders;
CREATE POLICY redeem_select_own ON redeem_orders FOR SELECT USING (app_uid() = user_id);
CREATE POLICY redeem_insert_own ON redeem_orders FOR INSERT WITH CHECK (app_uid() = user_id);

-- ===== 2) 宽开口策略关闭（快照核实过的匿名任意写通道） =====
DROP POLICY IF EXISTS papers_full_access ON papers;
DROP POLICY IF EXISTS pt_insert_open ON point_transactions;
DROP POLICY IF EXISTS agents_full_access ON agents;
DROP POLICY IF EXISTS agents_admin_all ON agents;
DROP POLICY IF EXISTS pages_full_access ON pages;
DROP POLICY IF EXISTS shop_full_access ON shop_items;
DROP POLICY IF EXISTS shop_items_insert_admin ON shop_items;
DROP POLICY IF EXISTS antibody_insert_admin ON antibody_catalog;
DROP POLICY IF EXISTS antibody_update_admin ON antibody_catalog;
DROP POLICY IF EXISTS template_insert_admin ON datasheet_templates;
DROP POLICY IF EXISTS "knowledge_candidates admin all" ON knowledge_candidates;

-- ===== 3) 废弃脚手架与旧触发器 =====
DROP TABLE IF EXISTS public.users;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'auth.users 触发器属 supabase_auth_admin，无法删除；迁移后不再有新插入，保留无副作用。';
END
$$;

-- ===== 4) leaderboard 改建于 app_users（不再依赖 auth.users） =====
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  au.id AS user_id,
  COALESCE(NULLIF(au.full_name, ''), au.email) AS display_name,
  COALESCE(up.balance, 0) AS points,
  (SELECT COUNT(*) FROM papers p WHERE p.user_id = au.id AND p.status = 'verified') AS paper_count,
  (SELECT COALESCE(SUM(points_awarded), 0) FROM papers p WHERE p.user_id = au.id AND p.status = 'verified') AS total_paper_points
FROM app_users au
LEFT JOIN user_points up ON up.user_id = au.id
WHERE au.is_active AND au.email_verified_at IS NOT NULL
ORDER BY points DESC;

GRANT SELECT ON leaderboard TO anon, app_user;
