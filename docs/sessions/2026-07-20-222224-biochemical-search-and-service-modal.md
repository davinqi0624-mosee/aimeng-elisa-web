# 2026-07-20 22:22 其他生化检测试剂页面检索和转人工优化

## 背景

用户反馈“其他生化检测试剂”页面缺少设计感，搜索界面不明确，没有明确搜索按钮；WB/IHC/生化检测三个范围不应像按钮一样排列；多个客服入口逻辑重复且跳转到联系我们/代理商页面，实际应转人工客服。

## 改动

- 新增可复用组件 `components/product/OfficialCustomerServiceButton.tsx`：
  - 点击后打开官方客服弹窗。
  - 弹窗读取 `/api/customer-service` 中的官方客服二维码、电话、邮箱、微信和工作时间。
  - 不再跳转到代理商联系方式页面。
- 顶部“咨询人工客服”改为打开官方客服弹窗。
- 右侧流程说明卡从深色大卡改为浅蓝信息面板，降低视觉压迫感。
- 重做 `BiochemicalProductSearch`：
  - 明确的“产品检索”标题。
  - 搜索输入框 + 产品方向下拉 + 独立搜索按钮。
  - WB/IHC/生化检测改为“当前检索范围”说明卡，不再像三个筛选按钮。
  - “转人工客服”和“联系客服确认”统一打开官方客服弹窗。
  - 空状态文案改为强调公开目录整理中，可人工确认规格、库存、报价和说明书。

## 验证

- `npx eslint app/(shop)/products/biochemical-reagents/page.tsx app/(shop)/products/biochemical-reagents/BiochemicalProductSearch.tsx components/product/OfficialCustomerServiceButton.tsx`
- `npm run build`
- `npm run deploy:aliyun`
- 线上健康检查通过：`http://106.14.215.238/products/biochemical-reagents`
