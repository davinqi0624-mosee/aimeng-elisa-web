# 2026-08-14 AI Key Management, Downloads, Image Optimization

## User Request
- Cloudflare plan: Free.
- Add super-admin-only AI key management page.
- Keep AI keys away from ordinary pages.
- Add audit trail for key changes.
- Improve mobile image loading speed.
- Product manuals can preview but need a download button.

## Changes
- Added `/admin/ai-keys` for super admins only.
- Added `/api/admin/ai-keys` with `requireSuper` guard.
- API returns key status/tail only; full key is never returned to the browser.
- Added encrypted AI provider secret storage helper.
- AI calling layer now prefers encrypted DB credentials, then falls back to server env keys.
- Added audit logging for AI provider key updates.
- Added `/api/products/documents/download` to force product document downloads.
- Product detail UI now separates online preview from direct download.
- Enabled Next Image optimizer by removing global `images.unoptimized`.
- Added migration `061_ai_provider_secrets.sql`.
- Added migration `062_site_settings_secret_column_security.sql` to prevent public selection of `ai_provider_secrets`.
- Added `AI_CREDENTIALS_ENCRYPTION_KEY` to server env without exposing its value, then restarted `aimeng-elisa-web`.
- Added `ADMIN_JWT_SECRET` to server env without exposing its value, then restarted `aimeng-elisa-web`; existing admin sessions need to log in again.

## Deployment
- Ran targeted ESLint successfully.
- Deployed to Aliyun with `npm run deploy:aliyun`.
- Production health check passed: 23 pages and 4 APIs.

## Verification
- `/api/admin/ai-keys` unauthenticated returns `401`.
- Product document download API returns `Content-Disposition: attachment`.
- Local Next image optimization endpoint returns `200`.

## Remaining Manual Step
- Supabase migrations `061_ai_provider_secrets.sql` and `062_site_settings_secret_column_security.sql` still need to be executed in Supabase SQL Editor if they have not already been applied.

## Follow-up Verification On 2026-08-15
- User executed migrations `061` and `062`.
- AI key save API returned `200`.
- Found audit writes were not persisted because the legacy `admin_audit_logs.admin_id` foreign key still pointed to `profiles(id)` while current admin sessions use `admin_accounts(id)`.
- Added `063_admin_audit_log_account_id_repair.sql` to remove legacy foreign-key coupling from admin audit/export/quota log tables.
- Updated `lib/admin/audit.ts` so audit inserts use the Supabase service-role admin client.
- User executed migration `063`.
- Re-tested AI key save API successfully.
- Confirmed `admin_audit_logs` contains `ai_provider_secret_update` records with provider, key tail, and change flags only.
- Production health check passed with `HEALTH_BASE_URL=https://animaluni.com`.

## Follow-up Admin Users Repair On 2026-08-15
- User reported `/admin/users` had unreadable dark-theme text and API error `column profiles.email does not exist`.
- Fixed `/api/admin/users` to read email, phone, created time, and last sign-in from Supabase Auth users, then merge profile-only fields from `profiles`.
- Updated `/admin/users` title/subtitle/button/empty/loading colors for the dark admin shell.
- Normalized role display for `admin_l1/admin_l2` and legacy `level1/level2`.
- Moved export quota/export log helpers to the service-role client to avoid RLS blocking admin operation logs.
- Deployed to Aliyun.
- Verified production health check passed.
- Verified `/api/admin/users?limit=5` returns 5 users with emails and profile names.
- Verified `/api/admin/users?limit=5&export=true` returns exported data with masked email addresses.

## Follow-up Admin Orders Repair On 2026-08-15
- User reported `/admin/orders` error: `Could not find a relationship between 'redeem_orders' and 'profiles' in the schema cache`.
- Removed embedded Supabase joins from `/api/admin/orders`; orders now load from `redeem_orders` and manually merge `profiles.full_name` and `shop_items.name`.
- Removed the Auth user list lookup from orders for speed and stability; the page uses `contact_email` from the order when present.
- Updated `/admin/orders` title/subtitle/loading/empty text colors for the dark admin shell.
- Deployed to Aliyun.
- Verified `/api/admin/orders?pageSize=5` returns `200`, total `1`, including the pending Apple Watch SE3 order.
- Verified production health check passed.

## Follow-up Registration Bonus And Site Guide Infographic On 2026-08-16
- User requested registration bonus enforcement and a one-image explanation of site value.
- Verified registration bonus code existed but failed in production because `auth.signUp` attached a new-user session to the same Supabase client, causing `profiles.upsert` to run under RLS instead of service-role.
- Updated `/api/auth/register` to use a fresh service-role client for profile creation and 50-point registration bonus transaction.
- Deployed to Aliyun.
- Verified test registration returned `bonusPoints: 50` and message `注册成功，已赠送50积分。请查收邮箱并完成验证。`
- Verified the test point transaction had amount `50`, type `earn`, source `registration_bonus`, description `注册会员赠送积分`.
- Cleaned up temporary test users, profiles, and point transactions.
- Created SVG infographic asset: `public/brand/aimeng-site-guide-infographic.svg`.
- Created local PNG preview: `reports/aimeng-site-guide-infographic-preview.png`.
- Synced the SVG to production and restarted the app so standalone static file discovery picked it up.
- Verified production URL returns `200`: `https://animaluni.com/brand/aimeng-site-guide-infographic.svg`.
- Verified production health check passed.
