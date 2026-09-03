# 2026-07-02 G1 历史备份/废弃文件清理

## 背景

本轮按 G1 范围巡检 `.backup`、旧页面、废弃组件，目标是确认无引用后归档或删除，减少以后误改、误用历史文件的风险。

## 已处理

- 将 12 个历史页面备份文件归档到：
  - `project-materials/99-archive/legacy-page-backups/2026-07-02-g1/`
- 归档文件包括：
  - `app/(ai)/chat/page.tsx.backup`
  - `app/analysis/page.tsx.backup`
  - `app/analysis/page.tsx.bak.v2`
  - `app/analysis/page.tsx.bak.v3`
  - `app/analysis/page.tsx.bak.v4`
  - `app/analysis/page.tsx.bak.v5`
  - `app/analysis/page.tsx.bak.v6`
  - `app/contact/page.tsx.backup`
  - `app/knowledge/page.tsx.backup`
  - `app/lab/analysis/page.tsx.backup`
  - `app/login/page.tsx.backup`
  - `app/register/page.tsx.backup`
- 删除旧空壳组件 `components/Navbar.tsx`。
- 清理旧页面中对 `components/Navbar.tsx` 的无效导入和调用：
  - `app/(ai)/chat/page.tsx`
  - `app/login/page.tsx`
  - `app/register/page.tsx`
  - `app/videos/page.tsx`
- 顺手压实 `app/(ai)/chat/page.tsx` 中本轮触碰到的 lint 问题：
  - `MODE_CONFIG` icon 使用 `LucideIcon` 类型替代 `any`。
  - 避免在 render 阶段使用 `Date.now()` / `Math.random()` 生成会话 ID。
  - URL mode 同步不再直接在 effect 中同步 setState。
  - 异常捕获从 `any` 收窄为 `unknown`。
- 清理 `app/videos/page.tsx` 未使用的 `Video` 导入。

## 特意保留

- `app/analysis/page.tsx`：旧 `/analysis` 链接兼容跳转到 `/lab/analysis`。
- `app/ai-chat/page.tsx`：旧 `/ai-chat` 链接兼容跳转到 `/chat`。
- `app/points/page.tsx`：旧 `/points` 链接兼容跳转到 `/member`。
- `app/api/admin/maintenance/backups`：这是后台备份功能，不是废弃页面备份。

## 验证

- `npm run lint -- 'app/(ai)/chat/page.tsx' app/login/page.tsx app/register/page.tsx app/videos/page.tsx components/AppChrome.tsx components/ui/Navbar.tsx` 通过。
- `npm run build` 通过。
- 已确认 `app` 目录不再存在需要清理的页面 `.backup` / `.bak.*` 文件。
- 已确认没有残留 `@/components/Navbar` 或 `LegacyNavbar` 引用。

## 后续建议

- 下一轮可以继续做 G2：项目根目录和 `project-materials` 中的历史文档、临时脚本、一次性报告分区归档。
- 旧兼容路由暂时保留，等网站正式域名稳定、外部链接统一后，再考虑是否通过重定向日志判断能否删除。
