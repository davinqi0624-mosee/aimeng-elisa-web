# 2026-07-21 客服二维码上传兼容与 AI 页面视觉优化

## 背景

用户反馈后台上传官方客服二维码时出现：

`crypto.randomUUID is not a function`

同时反馈 AI 客服页顶部文字颜色太淡，标题前希望恢复智慧大脑图标；实验方案生成器顶部图片和文字间距偏大，文字科技感和醒目程度不足。

## 本次变更

- 后台官方客服二维码上传增加浏览器兼容 ID 生成函数。
- 代理商批量导入批次 ID 同步增加兼容兜底，避免同类浏览器环境再次报错。
- AI 客服页：
  - 标题前增加蓝色发光智慧大脑图标。
  - 标题使用更醒目的蓝色科技渐变。
  - 副标题和当前模式文字加深颜色，并增加半透明浅底，提升可读性。
- 实验方案生成器页：
  - 顶部图片和文字间距缩小。
  - 保持长方形图片展示。
  - 标题改为更醒目的科技渐变风格，并增加 AI Protocol Designer 标签。

## 验证

- `npx eslint app/admin/settings/page.tsx app/admin/agents/page.tsx app/(ai)/chat/page.tsx app/lab/experiment/page.tsx` 通过；仅代理商页存在历史 `<img>` 性能 warning。
- `npm run build` 通过。
