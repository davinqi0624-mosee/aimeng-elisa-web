# 网站巡检记录

日期：2026-07-05

## 巡检范围

- 当前本地开发服务状态
- 首页改版后的关键公开链路
- 自动健康检查脚本
- 生产构建
- 首页相关 lint

## 发现与判断

### 1. 端口导致的误报

本轮 `npm run dev` 启动时，`3000` 端口已经被另一个 Node 进程占用，Next 自动切换到 `3001`：

- 当前有效预览地址：`http://localhost:3001`
- `3000` 端口也有 Node 进程，但不是本轮首页预览服务

第一次运行 `npm run health` 和 `npm run doctor` 时默认检查 `http://localhost:3000`，因此出现大量 404 和导航缺失提示。切换为正确地址后，检查通过。

建议后续优化 `scripts/health-check.mjs`：允许从当前 dev server 自动识别端口，或在输出中明确提醒设置 `HEALTH_BASE_URL`。

### 2. 正确端口下巡检结果

使用：

```bash
HEALTH_BASE_URL=http://localhost:3001 npm run health
HEALTH_BASE_URL=http://localhost:3001 npm run doctor
```

结果：

- 22 个公开页面通过
- 4 个 API 通过
- `npm run build` 通过
- doctor 报告已生成到 `reports/site-doctor-latest.md`

### 3. 手动抽查

使用 Node fetch 抽查关键页面和 API，以下路径均返回 200：

- `/`
- `/products`
- `/products/elisa`
- `/products/fbs`
- `/products/coa`
- `/chat`
- `/lab/analysis`
- `/knowledge`
- `/citations`
- `/store`
- `/community`
- `/contact`
- `/login`
- `/register`
- `/api/home-banners`
- `/api/agents`
- `/api/citations/stats`

### 4. Lint

首页相关文件局部 lint 通过：

```bash
npm run lint -- app/page.tsx components/home/HomeHeroCarousel.tsx components/ui/Navbar.tsx components/AppChrome.tsx app/layout.tsx
```

## 当前结论

首页改版后的本地站点在 `http://localhost:3001` 下公开链路、构建和首页相关 lint 均通过。本轮没有发现需要立刻修复的阻断性问题。

## 后续建议

- 优先优化健康检查脚本的端口提示，避免误打旧服务导致误判。
- 后续做全量 lint 时仍需按已划分的小区块逐步推进，不建议一次性处理全站历史债务。
