# Mouse Product Search Fix

## 时间
2026-07-19 09:38 CST

## 问题
前台 ELISA 产品搜索页选择“小鼠 / Mouse”后显示“未找到匹配的产品”，并出现“搜索暂时启用基础模式，部分扩展字段可能未参与检索”。选择小鼠并输入 IL-6 也没有结果。

## 排查
- 数据库中 `products.species = Mouse` 的 active 产品存在 1374 条。
- `product_species.species = Mouse` 的关联记录也存在。
- Mouse IL-6 产品存在，货号为 `LV30325`。
- 页面查询失败原因是：先查出大量小鼠产品 ID，再把 1000 多个 ID 拼进下一次 `.in('id', ids)` 查询，导致 PostgREST 返回 `Bad Request`。

## 处理
- 修改 `app/(shop)/search/page.tsx`：
  - 种属筛选改为直接按 `products.species` 精确过滤。
  - 不再拼接大量产品 ID，避免请求过长。
  - 将“基础模式”提示改为更准确的检索异常提示。
- 修改 `app/api/search/route.ts`：
  - 同步去掉大量 ID 拼接逻辑。
  - API 也直接按规范化后的 `products.species` 值过滤。

## 验证
- 直接查询验证：
  - `Mouse` 返回 1374 条。
  - `Mouse + IL-6` 返回 2 条。
  - 首条为 `LV30325 Mouse IL-6 ELISA Kit`。
- 本地页面验证：
  - `/products/elisa?species=Mouse&q=IL-6` 正常显示 2 款产品。
  - 不再出现“未找到匹配的产品”。
  - 不再出现“基础模式”提示。
- `npx eslint 'app/(shop)/search/page.tsx' app/api/search/route.ts` 通过。
