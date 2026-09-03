# 购买积分新增其他生化检测试剂品类

时间：2026-07-22 18:29

## 需求

在购买积分申请页面的产品类型中新增“其他生化检测试剂”，该类产品积分规则统一按 50 积分奖励。

## 处理

- 新增共享购买积分产品配置：`lib/purchase-points.ts`
  - ELISA 试剂盒：96T / 48T
  - 胎牛血清：500ml / 50ml*10
  - 动物血制品：default
  - 其他生化检测试剂：default，默认 50 积分
- 前台 `/member/purchase-points` 增加“其他生化检测试剂”产品类型按钮。
- 后台 `/admin/purchase-points` 增加该产品类型。
- 后台选择“其他生化检测试剂”时：
  - 规格自动填 `default`
  - 基础积分自动填 `50`
- 后端接口放行新产品类型：
  - `/api/purchase-points/claims`
  - `/api/admin/purchase-points/codes`
  - `/api/admin/purchase-points/rules`
  - `/api/admin/purchase-points/campaigns`
- 后端强制规则：
  - `biochemical_reagents` 类型无论管理员误填多少基础积分，保存积分码/规则和客户提交计算时均按 50 分处理。
  - `biochemical_reagents` 类型规格统一按 `default` 处理。
- 新增数据库迁移：
  - `supabase/migrations/054_purchase_points_biochemical_reagents.sql`
  - 扩展 `purchase_point_rules`、`purchase_point_codes`、`purchase_point_claims` 的 product_type check 约束。
  - 写入默认规则：`biochemical_reagents / default / 50 分`。

## 验证

- 针对修改文件执行 ESLint，通过。
- `npm run build` 通过。
- 已部署到 `http://106.14.215.238`。
- 线上健康检查通过。

## 注意

本地缺少 Supabase 数据库直连 URL，Supabase CLI 也缺少 `SUPABASE_ACCESS_TOKEN`，所以无法自动执行数据库 DDL。

已用 service role 探测线上数据库，当前仍被 `purchase_point_rules_product_type_check` 拒绝：

```text
new row for relation "purchase_point_rules" violates check constraint "purchase_point_rules_product_type_check"
```

因此正式提交/创建“其他生化检测试剂”积分码前，需要在 Supabase SQL Editor 执行：

```text
supabase/migrations/054_purchase_points_biochemical_reagents.sql
```
