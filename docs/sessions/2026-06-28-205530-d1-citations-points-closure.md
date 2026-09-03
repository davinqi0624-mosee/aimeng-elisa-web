# D1 文献引用 + 积分体系闭环巡检

时间：2026-06-28

## 巡检目标

检查文献审核、积分发放、重复提交、拒绝理由、积分流水一致性，避免客户提交/审核/兑换过程中出现状态和积分不一致。

## 本轮修复

- 新增 `lib/points/ledger.ts`，统一从 `point_transactions` 计算：
  - `available_points = earn + refund - spend`
  - `total_points = earn`
- 文献审核通过发分改为幂等：
  - 同一篇文献已有奖励流水时，不再重复插入。
  - 如果之前只写入流水但文献状态没更新，管理员重试可以补齐余额和文献状态。
  - 如果已有奖励流水金额和当前 IF 对应积分不一致，系统阻止继续操作并提示人工核对。
- 管理员手动发分接入统一余额同步。
- 用户积分查询接入统一积分计算，会员等级按累计获得积分判断。
- 商城兑换成功后同步 `profiles.available_points`。
- 商城兑换失败补偿：扣分后如果订单创建或库存扣减失败，自动写退款流水并同步余额。
- 管理员取消兑换订单时，先检查是否已有退款流水，避免重复退款。
- 用户“我的文献投稿”加载失败改为页面展示错误，不再静默。
- 文献提交、上传、AI 识别 API 收窄错误类型和入参结构，减少异常输入导致服务端崩溃。

## 验证

- `npm exec eslint -- app/api/admin/citations/route.ts app/admin/citations/page.tsx app/api/citations/submit/route.ts app/api/citations/upload/route.ts app/api/citations/extract/route.ts app/api/user/citations/route.ts app/user/citations/page.tsx app/user/citations/submit/page.tsx app/api/user/points/route.ts app/api/points/award/route.ts app/api/shop/redeem/route.ts app/api/admin/orders/route.ts lib/points/ledger.ts`
- `npm run build`

两项均通过。

## 后续建议

- 下一轮可做“积分流水对账页”：扫描用户 profile 与流水计算结果是否一致，一键修复。
- 商城兑换和订单退款后续最好升级为数据库 RPC 事务，做到扣积分、建订单、扣库存真正原子化。
- 可新增唯一索引限制同一 `redeem_orders` 订单只允许一条退款流水，进一步抵御并发重复退款。
