# 2026-06-27 Product Contact Service Modal

## 背景

用户希望商品详情页“联系客服咨询”不要再跳不稳定的 `weixin://`，而是点击后弹出客服二维码、电话和微信说明，方便客户添加。

## 已完成

- 修改 `components/product/OrderPanel.tsx`
  - “联系客服咨询”从外链改为站内弹窗。
  - 弹窗优先读取 `/api/agents` 中第一个带 `wechat_qr` 的二维码。
  - 如果暂未配置二维码，显示“客服二维码待配置”的占位提示。
  - 展示电话、邮箱、添加微信说明。
  - 提醒客户发送货号或产品名称，方便客服确认库存、报价、货期和资料。
  - 提供“查看更多联系方式”入口到 `/contact`。

## 验证

- `npm exec eslint -- components/product/OrderPanel.tsx` 通过。
- `npm run build` 通过。

## 后续建议

后续可以增加一个“官方客服设置”后台配置项，专门维护官方客服二维码、客服电话、客服微信号和工作时间，避免依赖代理商二维码。
