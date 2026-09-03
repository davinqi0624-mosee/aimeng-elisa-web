# 购买积分申请模块落地记录

日期：2026-07-06

## 背景

客户购买爱萌优宁 ELISA 试剂盒、胎牛血清或动物血制品后，可以在网站会员中心申请对应积分。设计目标是：

- 客户提交要轻：积分码 + 至少 1 张商品照片即可申请。
- 后台审核要准：识别重复积分码、重复照片，并保留拒绝/补充资料/归档理由。
- 积分发放要稳：通过审核后写入统一积分流水，不能重复发放。
- 活动规则要活：基础积分和活动加分不写死，后台可维护。

## 本轮实现

### 数据库迁移

新增 `supabase/migrations/045_purchase_point_claims.sql`：

- `purchase_point_rules`：基础积分规则。
- `purchase_point_campaigns`：活动规则，支持产品类型/规格、倍率、额外积分、起止时间。
- `purchase_point_codes`：积分码主凭证，支持状态、过期时间、货号/批号追溯。
- `purchase_point_claims`：客户购买积分申请。
- `purchase_point_claim_photos`：申请照片、照片类型、文件哈希、归档/删除状态。
- 为 `point_transactions` 增加购买积分申请唯一发放索引，避免同一申请重复发放。

### 客户端

新增页面：

- `/member/purchase-points`

客户可以：

- 选择产品类型和规格。
- 输入积分码。
- 上传 1-3 张照片。
- 可选填写货号、批号、购买渠道、备注。
- 查看自己的申请记录和审核反馈。

入口：

- 会员中心新增“购买积分”入口。
- 前台导航“积分商城”下拉新增“购买积分申请”。

### 后台

新增页面：

- `/admin/purchase-points`

管理员可以：

- 按状态查看申请：待审核、需补充、已通过、已拒绝、已归档、全部。
- 查看客户资料、积分码、货号/批号、渠道、备注、照片、重复照片警告。
- 通过审核并发放积分。
- 设置照片奖励积分。
- 要求客户补充资料。
- 拒绝并填写原因。
- 维护积分码，支持单个录入和多行批量录入。
- 维护基础积分规则。
- 维护活动积分规则。

后台导航新增：

- “购买积分审核”

### API

新增：

- `GET/POST /api/purchase-points/claims`
- `GET/POST /api/admin/purchase-points/claims`
- `GET/POST/DELETE /api/admin/purchase-points/codes`
- `GET/POST/DELETE /api/admin/purchase-points/rules`
- `GET/POST/DELETE /api/admin/purchase-points/campaigns`

关键安全点：

- 积分码规范化为大写并去除空格。
- 同一积分码处于 pending / needs_more_info / approved 时不能重复申请。
- 照片保存 SHA-256 哈希，用于后台提示重复照片风险。
- 审核通过时检查 `point_transactions` 中是否已有同源流水。
- 通过后积分码状态更新为 `used`。
- 发放积分后同步 `profiles.total_points` 和 `profiles.available_points`。

## 验证

- `npm run lint -- ...`：通过。
- `npm run build`：通过。

## 后续建议

- 在后台继续补“照片原图归档/清理”批处理按钮：删除 Supabase Storage 原图，同时保留照片哈希和审核记录。
- 后续如要大批量生成积分码，可再增加 CSV 导入和导出。
- 如果每件商品随包装印刷唯一积分码，建议积分码在发货前批量生成并导出给包装/标签流程使用。
