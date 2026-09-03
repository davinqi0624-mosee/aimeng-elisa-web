# 2026-06-26 后台基础与 AI/知识生成巡检 Round 3

时间：2026-06-26 23:09 CST

## 本轮范围

- 后台基础模块：代理商、兑换订单、用户管理。
- AI/知识生成：每日知识生成接口权限。
- lint 债务治理：先拆分全站债务，再清一个小范围。

## 已完成修改

### 1. lint 债务拆分

- 新增 `docs/lint-debt-breakdown.md`。
- 将历史 lint 债务拆成 A-G 小范围：
  - A 后台基础模块
  - B AI 与知识生成
  - C 产品与搜索前台
  - D 文献引用与积分体系
  - E ELISA 实验工具
  - F 首页与公共组件
  - G 历史备份和废弃文件
- 后续每轮巡检按小范围逐一处理，避免一次性全站大改。

### 2. 代理商管理

- 新增后台专用接口 `app/api/admin/agents/route.ts`。
- 后台代理商页面改用 `/api/admin/agents`，不再复用公开 `/api/agents` 做增删改。
- 公开 `/api/agents` 默认只返回启用代理商，避免客户看到已禁用代理商。
- 后台代理商加载失败时页面显示错误提示，不再静默空白。
- 批量导入和单条保存/删除都改走后台鉴权接口。
- 清理本页明显 lint 问题：
  - 移除未使用图标、状态和模板函数导入。
  - `require('xlsx')` 改为动态 `import('xlsx')`。
  - `any` 改为 `unknown` 或明确接口。

### 3. 兑换订单

- `app/api/admin/orders/route.ts` 改用 service role admin client。
- 订单状态只允许 `pending` / `fulfilled` / `cancelled`。
- 只有待处理订单允许改状态，避免重复完成或重复退积分。
- 取消订单时：
  - 自动写入 `refund` 积分流水。
  - 恢复积分商城商品库存。
  - 写入审核日志。
- 前台积分余额接口和兑换接口均已把 `refund` 当作正向积分计算。
- 后台订单页面增加错误提示，更新失败不再静默。

### 4. 用户管理

- `app/api/admin/users/route.ts` 改用 service role admin client。
- 避免依赖不稳定的 `auth.users!inner` 查询，改为：
  - 先读 `profiles`
  - 再用 `supabase.auth.admin.listUsers()` 补邮箱、手机号、最后登录等 Auth 信息
- 用户积分余额计算加入 `refund`。
- CSV 导出继续脱敏邮箱和手机号，并保留审计记录。
- 修复导出时 email 可能为空导致 build 类型失败的问题。
- 用户页面增加错误提示。

### 5. 每日知识生成

- `app/api/knowledge/generate/route.ts` 加入 `requireAdminOrSuper`。
- 未登录访问会返回 401，避免公开页面或外部请求消耗 AI token。

## 验证结果

### 本地构建

- `npm run build`：通过。

### scoped lint

命令：

```bash
npx eslint app/api/admin/agents/route.ts app/api/agents/route.ts app/api/admin/orders/route.ts app/api/admin/users/route.ts app/api/knowledge/generate/route.ts app/admin/agents/page.tsx app/admin/orders/page.tsx app/admin/users/page.tsx
```

结果：

- 0 errors。
- 2 warnings，均为 `app/admin/agents/page.tsx` 中二维码预览 `<img>` 的 Next Image 优化提醒。
- 这两个 warning 已纳入后续 lint 债务，不影响上线。

### 云端部署

- 执行 `npm run deploy:aliyun`：成功。
- 服务：`aimeng-elisa-web.service`
- 状态：active running。
- 云端地址：`http://106.14.215.238`

### 云端健康检查

- `scripts/health-check.mjs`：通过。
- 检查 22 个页面和 4 个 API 均通过。

### 后台专项检查

- 页面返回 200：
  - `/admin/agents`
  - `/admin/orders`
  - `/admin/users`
  - `/admin/maintenance`
  - `/admin/knowledge/generate`
  - `/admin/ai-agents`
- 未登录后台 API 拦截：
  - `/api/admin/agents` -> 401
  - `/api/admin/orders` -> 401
  - `/api/admin/users` -> 401
  - `POST /api/knowledge/generate` -> 401
- 公开代理商接口：
  - `/api/agents` -> 200
  - 返回启用代理商数据。

## 剩余问题与下一轮建议

1. 代理商页二维码预览仍有 2 个 `<img>` lint warning，后续可统一改成 `next/image` 或保留为管理后台低风险预览图。
2. 全站 lint 债务仍很大，建议下一轮继续按 `docs/lint-debt-breakdown.md`：
   - A2：后台页面静默失败和 Hook lint。
   - 或 B1：AI/知识生成接口权限与错误提示。
3. 后台页面目前只做了未登录访问和页面返回检查，真正的新增/编辑/删除仍建议用测试账号做一轮人工操作验收。
