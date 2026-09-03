# 2026-09-03 AI 防刷与后台登录加固

## 用户提出的风险

1. AI 客服不得回答与实验、产品和专业领域无关的问题，避免无效 token 消耗。
2. 恶意批量注册账号后调用 DeepSeek/Kimi，可能快速耗尽模型余额。
3. 管理后台登录不能只依赖 Nginx 429，应有验证码和防暴力破解机制。

## 已完成的代码与服务器配置

- 新增 `lib/ai/domain-guard.ts`：在检索、Embedding、AI 模型调用及对话写库前本地判断范围；非专业问题直接返回固定说明，不调用模型。
- 新增数据库配额调用模块 `lib/security/ai-usage.ts`：使用 IP、用户、匿名、全站日配额四层限制，并限制单次对话长度。
- 新增 `lib/security/admin-login-security.ts` 与 `lib/security/registration-security.ts`。
- 更新 AI Chat、注册、管理员登录、邮箱验证回调：
  - 注册奖励 50 分改为邮箱验证成功后发放。
  - 旧 `AuthModal` 不再直接调用注册接口，统一跳转到带验证码的注册页。
  - 后台登录使用账号/IP 联合失败计数与渐进式锁定。
  - Turnstile 支持验证 action 和域名，并可用 `TURNSTILE_ENFORCE_AUTH=true` 强制 fail-closed。
- 创建迁移：`supabase/migrations/068_security_limits.sql`。
- 服务器 Nginx 已配置并验证：`/api/ai/chat` 同 IP `6 次/分钟`，超过立即返回 429；Nginx 配置检查和重载成功。
- 静态验证通过：ESLint、`tsc --noEmit`、`npm run build`、`git diff --check`。

## 等待执行的生产配置

1. 在 Supabase SQL Editor 执行 `supabase/migrations/068_security_limits.sql`。
2. 在 Cloudflare Turnstile 创建 `animaluni.com` 和 `www.animaluni.com` 的 Widget，取得 Site Key 和 Secret Key。
3. 将以下变量写入服务器 `/etc/aimeng-elisa-web/aimeng-elisa-web.env`，再部署应用：
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `CLOUDFLARE_TURNSTILE_SECRET_KEY`
   - `TURNSTILE_ENFORCE_AUTH=true`
4. 部署后验证：非专业问题不产生 AI 调用、AI 限额返回明确 429、注册需验证码且验证后才赠送积分、管理员连续错误 5 次锁定 15 分钟。

## 默认 AI 限额（可由服务器环境变量调整）

- 匿名：同 IP 每日 10 次。
- 登录用户：每 10 分钟 8 次、每日 30 次。
- 同 IP（跨账号）：每 10 分钟 12 次、每日 60 次。
- 全站：每日 500 次，预估 token 日预算 400,000。

## 注意

- 代码尚未部署，因为缺少迁移会导致数据库级安全函数不可用，部署会使 AI 与管理员登录拒绝请求。
- 未配置真实 Turnstile 密钥时，不能启用 `TURNSTILE_ENFORCE_AUTH=true`，否则会阻止注册和后台登录。
