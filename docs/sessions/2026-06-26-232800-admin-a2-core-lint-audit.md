# 2026-06-26 后台 A2-core 静默失败与 Hook lint 巡检

时间：2026-06-26 23:28 CST

## 本轮目标

按 `docs/lint-debt-breakdown.md` 的 A2 路线，优先处理后台页面里的：

- 加载失败静默为空白。
- Hook lint 明确错误。
- 明显 `any` 类型问题。
- 不扩大到文献、商品、产品等重业务模块。

## 阅读的 Next 本地文档

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`

结论：

- 后台交互页面继续作为 Client Components。
- 预期错误应显式展示给管理员，而不是静默吞掉。
- Next 16 使用 `npx eslint`，不再使用 `next lint`。

## 已修复范围

### 管理员管理

文件：`app/admin/admins/page.tsx`

- 增加页面级错误提示。
- 管理员列表加载失败不再静默空表。
- 创建、编辑、启用/禁用、删除失败时同时显示页面错误与弹窗。
- 移除 `any`，增加 `AdminAccountPayload` 和 `ApiErrorResponse`。

### 后台布局

文件：`app/admin/layout.tsx`

- 登录页不再在 `useEffect` 里额外 `setLoading(false)`。
- 避免 Hook lint 的同步 setState 问题。

### 后台登录

文件：`app/admin/login/page.tsx`

- 返回首页链接从 `<a href="/">` 改为 `next/link`。

### 批量导入记录

文件：`app/admin/bulk-imports/page.tsx`

- `fetchBatches` 改为 `useCallback`。
- 修复 Hook 依赖和 set-state-in-effect lint。
- 增加页面级错误提示。
- 回滚失败时不再只弹窗，也会留在页面上。

### 知识候选审核

文件：`app/admin/knowledge/candidates/page.tsx`

- 移除未使用的 `requireRole`。
- `loadCandidates` 改为 `useCallback`。
- 修复 Hook 依赖和函数声明顺序 lint。
- 增加页面级错误提示。
- 审核操作失败不再静默。

### 每日知识生成

文件：`app/admin/knowledge/generate/page.tsx`

- 移除 `any` 错误处理。
- 生成接口非 200 返回时显示明确错误，不再把失败结果当成功结果渲染。
- 保存失败继续显示后端返回的 `details/message/error`。

### Agent 中台

文件：`app/admin/ai-agents/page.tsx`

- 对 localStorage 草稿恢复的 Hook lint 做最小范围说明。
- 保持浏览器挂载后恢复草稿的行为不变。

## 验证结果

### scoped lint

命令：

```bash
npx eslint app/admin/layout.tsx app/admin/login/page.tsx app/admin/admins/page.tsx app/admin/bulk-imports/page.tsx app/admin/dashboard/page.tsx app/admin/maintenance/page.tsx app/admin/home-banners/page.tsx app/admin/knowledge/candidates/page.tsx app/admin/knowledge/generate/page.tsx app/admin/ai-agents/page.tsx app/admin/change-password/page.tsx app/admin/settings/page.tsx app/admin/page.tsx
```

结果：

- 0 errors。
- 2 warnings：`app/admin/home-banners/page.tsx` 中两个广告图预览 `<img>` 的 Next Image 性能提醒。

### build

- `npm run build`：通过。

### 部署

- `npm run deploy:aliyun`：成功。
- 云端服务：`aimeng-elisa-web.service`
- 状态：active running。

### 云端页面检查

以下页面均返回 200：

- `/admin/login`
- `/admin`
- `/admin/admins`
- `/admin/bulk-imports`
- `/admin/home-banners`
- `/admin/knowledge/candidates`
- `/admin/knowledge/generate`
- `/admin/ai-agents`
- `/admin/maintenance`

以下后台 API 未登录均返回 401：

- `/api/admin/accounts`
- `/api/admin/bulk-import-batches`
- `/api/admin/home-banners`
- `/api/admin/knowledge/candidates`
- `/api/admin/me`

公开健康检查：

- `scripts/health-check.mjs`：通过，22 个页面和 4 个 API 均正常。

## 全后台 lint 盘点

`npx eslint app/admin` 仍有历史错误，未在本轮全量处理。下一步建议按以下小圈继续：

1. A2-citations：`app/admin/citations/page.tsx`
2. A2-shop：`app/admin/shop/page.tsx`
3. A2-products-light：`app/admin/products/page.tsx`、`app/admin/serum-products/page.tsx`
4. A2-pages：`app/admin/pages/**`

产品深度逻辑和文献审核业务逻辑不建议混在 A2-core 里一起改。
