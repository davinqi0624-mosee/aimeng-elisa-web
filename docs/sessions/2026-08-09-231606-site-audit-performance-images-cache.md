# 网站功能巡检与性能优化

## 背景

用户要求对网站功能做一次详细巡检，并直接处理可优化的问题，重点提升网站响应速度和图片显示速度。

## 巡检结果

- `npm run health` 通过：23 个页面和 4 个 API 全部返回正常。
- `npm run doctor` 通过，并生成报告：`reports/site-doctor-latest.md`。
- 发现较大的静态图片资源：AI 客服背景、实验方案助手图、AI 客服头像、小蜜蜂浮标、会员徽章。
- 发现较慢公开接口：
  - `/api/search?q=IL-6` 首次约 3-4s。
  - `/api/knowledge/daily?all=true` 首次约 1s+。
  - 首页媒体、广告、商城商品、代理商、文献统计接口约 0.3-1.1s。

## 本次优化

- 图片加载优化：
  - 新增 `/brand/ai-chat-brain-bg-1600.jpg`，替代 3.8MB 原 AI 背景。
  - 新增 `/brand/experiment-ai-assistant-900.jpg`，替代 3.1MB 原实验助手图。
  - 新增 `/brand/ai-chat-agent-720.png`，替代 2.0MB 原 AI 客服头像。
  - 新增 `/brand/aimeng-bee-ip-512.png`，替代 3.0MB 原小蜜蜂浮标。
  - 会员图标缩放到约 384px，单图从 0.5-1.0MB 降到约 116-144KB。
- 静态资源缓存：
  - `next.config.ts` 为 `/brand/*` 和 `/images/*` 增加长期静态缓存头。
- 公开接口短缓存：
  - 新增 `lib/server/memory-cache.ts`。
  - 为 `/api/search`、`/api/shop/items`、`/api/home-media`、`/api/home-banners`、`/api/agents`、`/api/citations/stats`、`/api/knowledge/daily` 增加服务端短缓存和 `X-Aimeng-Cache` 标记。
- 产品搜索优化：
  - 新增 `buildExactProductSearchValues`。
  - `/api/search` 和 `/products/elisa` 搜索页增加“精准优先”路径，常见输入如指标名/货号先走精确匹配，再 fallback 到模糊搜索。
  - `/products/elisa` 搜索页复用查询结果里的 `product_species`，去掉额外一次 `product_species` 查询。

## 优化效果

在本地最新构建上测试：

- `/api/search?q=IL-6`
  - 首次约 1.7s，重复请求约 0.008s。
- `/products/elisa?q=IL-6`
  - 首次约 1.6s，重复请求约 0.016s。
- `/api/knowledge/daily?all=true`
  - 首次约 1.1s，重复请求约 0.004s。
- `/api/shop/items`、`/api/home-media`、`/api/home-banners`、`/api/agents`、`/api/citations/stats`
  - 重复请求约 0.005-0.017s。

## 验证

- 局部 lint 通过：
  - `app/(ai)/chat/page.tsx`
  - `app/lab/experiment/page.tsx`
  - `components/product/AiChatBot.tsx`
  - `app/(user)/member/page.tsx`
  - `app/(shop)/search/page.tsx`
  - `app/api/search/route.ts`
  - `app/api/shop/items/route.ts`
  - `app/api/home-banners/route.ts`
  - `app/api/home-media/route.ts`
  - `app/api/agents/route.ts`
  - `app/api/citations/stats/route.ts`
  - `app/api/knowledge/daily/route.ts`
  - `lib/server/memory-cache.ts`
  - `next.config.ts`
- `npm run build` 通过。

## 后续建议

- 线上如未执行 `supabase/migrations/057_product_search_performance_indexes.sql`，应执行该 SQL，以继续降低产品模糊搜索首次响应时间。
- 项目内保留了旧大图原始文件作为素材源，但页面已改用优化版；后续确认不再需要原始素材后可统一归档到 `project-materials`，减少仓库体积。
