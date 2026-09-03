# 2026-08-17 产品搜索与 AI 客服匹配优化

## 背景

用户要求单独优化产品搜索规则和产品匹配。前一轮测试发现“小鼠 IL-6 ELISA 试剂盒怎么选择？”在产品库中实际存在 `LV30325`，但 AI 客服没有优先拿到该产品。

## 修改

- `lib/products/search.ts`
  - 新增 `parseProductSearchIntent()`。
  - 能从自然语言中识别种属，例如小鼠、Mouse、犬、Canine 等。
  - 会剥离搜索套话，例如 ELISA、试剂盒、怎么选择、推荐、查询等，只保留核心靶标。
  - 继续沿用原有大小写、横线、希腊字母、中文数字、中文指标名别名规则。

- `app/api/search/route.ts`
  - 前台搜索接入“种属 + 靶标”解析。
  - 用户输入“小鼠 IL-6 ELISA 试剂盒怎么选择？”会拆为 `Mouse + IL-6`，先走精确匹配。

- `app/api/products/match/route.ts`
  - 后台/自动匹配接口接入同一规则。
  - 先精确匹配，再模糊匹配，避免 `IL-6R alpha` 混入主结果。

- `app/api/ai/chat/route.ts`
  - AI 客服产品检索接入同一规则。
  - 售前场景中如果唯一精确命中产品，直接用产品库生成快速确定答复，不再等待大模型，从而减少卡顿和幻觉。

## 验证

- `npm run lint -- lib/products/search.ts app/api/search/route.ts app/api/products/match/route.ts app/api/ai/chat/route.ts` 通过。
- `npm run build` 通过。
- `npm run deploy:aliyun` 部署成功。
- 线上健康检查通过。
- 线上 `/api/search` 验证：
  - `小鼠 IL-6 ELISA 试剂盒怎么选择？` -> `LV30325 / Mouse IL-6`
  - `mouse il6` -> `LV30325 / Mouse IL-6`
  - `小鼠白介素六` -> `LV30325 / Mouse IL-6`
  - `LV30325` -> `LV30325 / Mouse IL-6`
  - `犬 IL-6R alpha` -> `LV60294 / Canine IL-6R alpha`
- 线上 AI 客服验证：`小鼠 IL-6 ELISA 试剂盒怎么选择？` 直接返回 `LV30325`、检测范围、灵敏度、规格价格和产品详情链接。
