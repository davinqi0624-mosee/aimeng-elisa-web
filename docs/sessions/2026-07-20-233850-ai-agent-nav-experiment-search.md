# 2026-07-20 AI 客服视觉、导航、实验方案与 ELISA 搜索优化

## 背景

用户反馈截图中的几个问题：

- AI 客服页两个图标缺少人工智能 Agent 的科技感。
- 导航栏“实验报告”和“数据分析”指向同一页面，形成重复入口。
- “实验方案设计”当前是先选产品再生成方案，业务逻辑应改成先描述实验需求，再由 AI 设计实验方案并推荐产品。
- ELISA 产品搜索页未筛选时默认展示牛种属产品，容易让客户误解为默认推荐。

## 本次改动

- 更新 `app/(ai)/chat/page.tsx` 的 AI 客服头部和助手头像图标，改为更偏 AI Agent 的科技风视觉。
- 从 `components/ui/Navbar.tsx` 的“实验工具”下移除重复的“实验报告”入口，保留“数据分析”。
- 重构 `app/lab/experiment/page.tsx`，从产品优先改为实验优先：
  - 选择实验类型：ELISA、细胞实验、WB、IHC、生化检测。
  - 填写样本种属、样本类型、检测指标、样本数量/分组、实验目的。
  - 页面不再要求先选择某个 ELISA 产品。
- 重构 `app/api/experiment/generate/route.ts`：
  - 根据实验需求生成 protocol。
  - 仅在能匹配网站产品时推荐产品。
  - 产品库未匹配时明确提示联系人工确认，不虚构货号、库存、价格或说明书。
- 优化 `app/(shop)/search/page.tsx` 默认状态：
  - 未输入筛选条件时不再查询并展示前 48 个产品。
  - 增加搜索引导区和常用搜索示例。
  - 只有输入货号/指标或选择种属后，才展示搜索结果。

## 验证

- `npx eslint components/ui/Navbar.tsx app/'(ai)'/chat/page.tsx app/lab/experiment/page.tsx app/api/experiment/generate/route.ts app/'(shop)'/search/page.tsx`
- `npm run build`

两项均通过。
