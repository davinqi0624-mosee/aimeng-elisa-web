# 注册会员赠送50积分

## 背景

用户希望鼓励客户注册会员：新会员注册后赠送 50 积分。

## 本次修改

- 新增服务端注册接口：`app/api/auth/register/route.ts`
  - 注册成功后由服务端写入积分流水。
  - 注册奖励为 50 积分。
  - 积分流水字段：`source='registration_bonus'`、`source_table='profiles'`、`source_id=user.id`。
  - 发放后同步 `profiles.total_points` 与 `profiles.available_points`。
  - 同一用户已有注册奖励时不会重复发放。
- 注册页 `app/register/page.tsx`
  - 从浏览器直连 Supabase 注册改为调用 `/api/auth/register`。
  - 页面提示“注册会员即送50积分”。
  - 注册成功页提示“已赠送50积分”。
- 注册弹窗 `app/components/AuthModal.tsx`
  - 注册入口改为调用同一个服务端注册接口。
  - 增加“注册会员即送50积分”提示。
- 新增数据库迁移：`supabase/migrations/059_registration_bonus_points.sql`
  - 增加注册奖励唯一索引，确保同一用户只能领取一次注册奖励。

## 验证

- `npm run lint -- app/api/auth/register/route.ts app/register/page.tsx app/components/AuthModal.tsx lib/points/ledger.ts`
  - 通过。
- `npm run build`
  - 通过。

## 后续

上线环境建议在 Supabase SQL Editor 执行 `supabase/migrations/059_registration_bonus_points.sql`，用于数据库层防重复。代码层已经有重复检查，但数据库唯一索引能挡住并发重复发放。
