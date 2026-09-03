# 每日签到与 4PL 使用奖励

日期：2026-08-31

## 规则

- 每个用户按北京时间每日首次进入已登录网站，获得 1 积分。
- 每个用户按北京时间每日首次完成有效 4PL 分析，获得 2 积分。
- 4PL 奖励要求至少 4 个不同标准品浓度、至少 1 个检测样本，标准品/样本 OD 在有效范围内，且拟合 R² 有效。
- 同一天重复计算仍可正常使用功能，但不重复获得奖励。
- 同一份 4PL 数据使用 SHA-256 指纹，不能跨天反复提交同一份数据领取奖励。
- 奖励由服务端和数据库函数发放，前端不能直接写积分流水。

## 实现

- `supabase/migrations/067_point_rewards_checkin_and_analysis.sql`
  - 新增 `point_reward_claims` 幂等记录表。
  - 增加每日奖励和数据指纹唯一约束。
  - 增加 `claim_point_reward` 原子数据库函数。
  - 函数会锁定用户档案、写入 `point_transactions` 并更新 `profiles` 余额。
- `app/api/points/check-in/route.ts`
  - 验证登录态，按北京时间发放每日签到奖励。
- `app/api/points/rewards/analysis/route.ts`
  - 验证登录态、4PL 参数、标准品、样本、OD 和 R²，再发放每日分析奖励。
- `components/points/DailyCheckIn.tsx`
  - 登录用户进入网站后自动请求签到，并显示一次性提示。
- `components/AppChrome.tsx`
  - 全站挂载签到触发组件，覆盖登录后进入的普通页面和后台页面。
- `app/lab/analysis/page.tsx`
  - 有效 4PL 计算完成后异步请求奖励接口，不阻塞计算结果。
- `app/(user)/member/page.tsx`
  - 增加奖励规则说明。
- `lib/points/rewards.ts`
  - 统一北京时间日期和数据库奖励调用。

## 数据库执行

本项目的 Supabase 没有可调用的 `exec_sql` RPC，迁移不能通过 REST 自动执行。请在 Supabase Dashboard -> SQL Editor 中完整执行：

```text
supabase/migrations/067_point_rewards_checkin_and_analysis.sql
```

执行前后都不需要改环境变量，也不要把 service role key 放到浏览器端。

## 验证

- 目标 ESLint：通过，无错误。
- `npm run build`：通过，181 个静态页面生成成功。
- 线上部署：`https://animaluni.com` 已更新，systemd 服务正常运行。
- 线上健康检查：23 个页面和 4 个 API 全部通过。
- 未登录调用 `/api/points/check-in`：返回 401 `未登录`。
- 未登录调用 `/api/points/rewards/analysis`：返回 401 `未登录`。

## 注意

数据库迁移执行前，签到和 4PL 奖励不会发放，但不会影响登录、4PL 计算、报告和其他积分功能。执行迁移后，用户下一次登录会自动领取当天签到积分；完成一次有效 4PL 且包含样本后会领取当天分析积分。
