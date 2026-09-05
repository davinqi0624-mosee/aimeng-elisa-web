-- 075: Supabase Auth 退役收尾（新认证代码部署并验收通过之后应用）
-- 目的：关死"绕过前端直接向 GoTrue 注册、拿 authenticated JWT 访问 PostgREST"的残余通道。
-- own-data 策略角色面收紧为仅 app_user（应用直连事务；PostgREST 会话不再是数据访问路径）。

ALTER POLICY papers_select_own ON papers TO app_user;
ALTER POLICY papers_insert_own ON papers TO app_user;
ALTER POLICY pt_select_own ON point_transactions TO app_user;
ALTER POLICY point_reward_claims_select_own ON point_reward_claims TO app_user;
ALTER POLICY purchase_point_claims_select_own ON purchase_point_claims TO app_user;
ALTER POLICY purchase_point_claim_photos_select_own ON purchase_point_claim_photos TO app_user;

-- 配套动作（Supabase 控制台手工执行，无 SQL 通道）：
-- 1) Authentication → Providers → Email：关闭 Sign up（allow_new_signups = false）
-- 2) 确认 auth.users 冻结为 15 行（不再增长）
