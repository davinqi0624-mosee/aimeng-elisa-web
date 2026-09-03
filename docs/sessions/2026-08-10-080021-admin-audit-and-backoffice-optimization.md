# 后台巡检与操作优化

## 背景

用户希望对后台也做一次巡检，让后台操作更丝滑，并找出没有用的功能，判断原因、未来是否会用到、是否需要删除。

## 后台入口盘点

后台页面共 28 个：

- 常用主入口：仪表盘、产品管理、血清产品、代理商、首页广告位、自媒体内容、说明书生成、产品文档、产品图片、每日知识生成、知识候选审核、批量导入记录、积分商城、购买积分审核、文献引用审核、运维中心、管理员管理、系统设置。
- 有页面但原来无侧边栏入口：
  - `/admin/orders`：兑换订单管理。实际有用，仪表盘有卡片入口，但侧边栏没有，已补上。
  - `/admin/users`：用户管理。实际有用，仅超级管理员应可见，已补上。
  - `/admin/change-password`：页脚已有入口，保留。
  - `/admin/papers`、`/admin/reviews`：仅做旧路径跳转到 `/admin/citations`，保留兼容旧链接。
  - `/admin/pages`、`/admin/pages/[id]/editor`：早期 CMS/页面编辑器，当前没有菜单入口，代码质量和权限模型不适合作为日常后台功能。

## 已处理的问题

### 1. 后台导航高亮错误

原来侧边栏“仪表盘”的 href 是 `/admin`，active 判断使用 `pathname.startsWith('/admin/')`，导致进入几乎所有后台页面时，“仪表盘”也会被错误高亮。

已修复：

- `/admin` 和 `/admin/dashboard` 才高亮仪表盘。
- 其他页面只高亮自己的菜单项。

### 2. 兑换订单、用户管理入口不顺

已加入侧边栏：

- `/admin/orders`：兑换订单，超级管理员和普通管理员可见。
- `/admin/users`：用户管理，仅超级管理员可见。

### 3. 仪表盘加载全量产品

原来 `/admin/dashboard` 调 `/api/admin/products` 不带分页，会拉取全量产品。产品超过 1 万条时会拖慢后台首页。

已修复：

- 仪表盘改为 `/api/admin/products?pageSize=1`，只取总数和 1 条数据。
- 统计产品数量时使用接口返回的 `total`。

### 4. 兑换订单接口默认全量返回

原来 `/api/admin/orders` 默认返回所有兑换订单，并且每条订单再查一次 Supabase Auth 邮箱。订单增长后会明显变慢。

已修复：

- `/api/admin/orders` 增加默认分页，默认最多 100 条。
- 支持 `page`、`pageSize`、`limit`。
- 返回 `total` 总数。
- 仪表盘改为 `/api/admin/orders?limit=1`，只取总数。

### 5. 仪表盘库存统计拉全表

原来 `/api/admin/dashboard/stats` 拉取所有产品的 `stock_status` 后在 Node 里统计。

已修复：

- 改成 Supabase count 查询，只取有货/缺货数量，不拉全量数据。

### 6. 后台 lint 噪音清理

已清理：

- 产品文档页未使用变量 `manualReviewCount`。
- 产品管理页未使用函数 `toNumber`。

## 无用/低频功能判断

### 建议保留

- `/admin/orders`：兑换审核必须保留，已补入口。
- `/admin/users`：查看用户和积分余额有用，已补入口。
- `/admin/papers`、`/admin/reviews`：虽然没有实际页面，但作为旧链接跳转到文献审核，建议保留，避免旧入口 404。
- `/admin/ai-agents`：目前偏规划/配置型，暂时只给超级管理员看。未来做多 Agent 管理会用到，建议保留。

### 建议暂时归档，不建议直接删除

- `/admin/pages`
- `/admin/pages/[id]/editor`
- `/api/admin/pages`
- `/api/admin/pages/seed`

原因：

- 没有侧边栏入口，说明不是当前运营主流程。
- 页面直接使用前端 Supabase anon key 创建客户端，不走现有后台认证 API，权限模型不统一。
- 全后台 lint 中，该功能贡献了最多类型错误和 React 规则问题。
- 未来如果要做“可视化页面装修/CMS”，这个方向有价值，但需要按现有后台权限体系重做，不适合现在直接开放。

建议：

- 当前不删除，继续隐藏。
- 后续单独做“CMS 页面编辑器重构”时再评估。
- 如果 1-2 个月内没有市场运营需求，可迁移到 `project-materials/archive` 或删除页面和 API。

## 验证

- 后台相关局部 lint 通过：
  - `app/admin/layout.tsx`
  - `app/admin/dashboard/page.tsx`
  - `app/api/admin/orders/route.ts`
  - `app/api/admin/dashboard/stats/route.ts`
  - `app/admin/product-documents/page.tsx`
  - `app/admin/products/page.tsx`
- `npm run build` 通过。

## 仍需后续专项处理

- `/admin/pages` 早期页面编辑器建议单独决定归档或重构。
- 全后台 lint 仍有一些历史 `any` 类型问题，集中在早期或复杂批处理模块；不影响当前构建，但建议后续分模块清理。
- 后台列表页后续可以继续补分页/筛选，优先级：兑换订单、用户管理、文献审核、产品文档批次。
