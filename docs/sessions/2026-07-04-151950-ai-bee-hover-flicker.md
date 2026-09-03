# 2026-07-04 小蜜蜂悬停闪烁修复

## 问题

前台小蜜蜂 AI 客服在鼠标悬停时会闪烁约 2 秒。

## 原因

悬停提示气泡原本作为普通布局元素插入到小蜜蜂上方，会改变外层容器高度和鼠标命中区域，导致 hover 状态反复进入/离开。

## 处理

- 将小蜜蜂外层容器固定为按钮尺寸。
- 将 tooltip 改为 `absolute` 定位并设置 `pointer-events-none`，不再参与布局。
- 将 hover 监听放到稳定外层容器，避免 tooltip 出现时推动小蜜蜂。

## 验证

- `npm run lint -- components/product/AiChatBot.tsx`
- `npm run build`
