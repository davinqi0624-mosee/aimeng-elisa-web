# 其他生化检测试剂分类卡片文案调整

## 背景

用户希望将“其他生化检测试剂”页面中的三张分类卡片，从“酶法检测试剂 / 比色法检测试剂 / 小分子指标检测”调整为：

- 蛋白免疫印迹 WB 试剂
- 免疫组化 IHC 试剂
- 生化检测

## 调整

- 更新 `app/(shop)/products/biochemical-reagents/page.tsx`：
  - 三张卡片标题、说明和示例标签同步调整。
  - 页面简介从“酶法/比色法/小分子”改为“WB/IHC/生化检测”。
  - 选型前建议增加 WB、IHC 和仪器条件。
- 更新 `components/ui/Navbar.tsx`：
  - 产品中心下拉中的新品类描述改为“查看 WB、IHC 和生化检测相关试剂”。
- 更新 `app/api/ai/chat/route.ts`：
  - AI 客服对“其他生化检测试剂”的识别范围同步改为 WB、IHC、生化检测。
  - 没有正式产品库数据时仍禁止虚构货号、价格和库存。

## 验证

- `npx eslint components/ui/Navbar.tsx app/(shop)/products/biochemical-reagents/page.tsx app/api/ai/chat/route.ts`
- `npm run build`

均已通过。
