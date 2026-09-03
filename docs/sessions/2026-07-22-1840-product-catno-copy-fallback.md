# 产品详情页货号复制修复

时间：2026-07-22 18:40

## 问题

产品详情页货号旁边的“复制”按钮点击后没有反应。

## 原因

原实现直接调用 `navigator.clipboard.writeText()`。线上访问地址为 `http://106.14.215.238`，在非 HTTPS 环境下，浏览器通常会限制现代剪贴板 API，因此点击按钮可能失败且没有可见反馈。

## 处理

- 修改 `components/product/OrderPanel.tsx`。
- 复制货号时：
  - 优先使用 `navigator.clipboard.writeText()`。
  - 若当前不是 secure context 或 API 调用失败，自动降级为隐藏 `textarea + document.execCommand('copy')`。
  - 成功后按钮显示“已复制”。
  - 仍失败时按钮显示“请手动复制”。

## 验证

- `npx eslint components/product/OrderPanel.tsx` 通过。
- `npm run build` 通过。
- 已部署到 `http://106.14.215.238`。
- 线上健康检查通过。
