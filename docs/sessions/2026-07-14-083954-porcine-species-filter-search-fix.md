# Porcine Species Filter Search Fix

## 时间
2026-07-14 08:39 CST

## 问题
前台 ELISA 产品搜索页选择“猪”种属后，页面显示 0 款产品，并提示“搜索暂时启用基础模式”。数据库中实际已有猪产品。

## 排查结果
- `products.species = 'Porcine'` 的 active 产品存在：591 条。
- `product_species.species = 'Porcine'` 的关联记录也存在：591 条。
- 前端按钮显示“猪”，实际筛选值是 `Porcine`，这部分没有问题。
- 问题在搜索页服务端查询：
  - 原逻辑先查 `product_species` 得到几百个 `product_id`。
  - 再把这些 ID 拼进 `.or(...)` 查询。
  - 猪产品数量多，导致查询条件过长/过复杂，PostgREST 报错，页面进入基础模式并返回 0。

## 本次处理
- 修改 `app/(shop)/search/page.tsx`：
  - 种属筛选不再把大量 `product_id` 拼进 `.or(...)`。
  - 直接按 `products.name` 和 `products.species` 的英文/中文种属模式查询。
  - `Porcine` 会匹配 `Porcine` 和 `猪`。
  - `Monkey` 会匹配 `Monkey` 和 `猴`。
- 顶部数量改为使用数据库返回的总数 `count`，不再只显示当前加载的前 48 条数量。

## 验证
- `npm run build` 通过。
- 已部署到 `http://106.14.215.238`。
- 部署健康检查通过。
- 访问 `/products/elisa?species=Porcine`：
  - 不再出现“基础模式”提示。
  - 不再出现“未找到匹配的产品”。
  - 页面返回猪/Porcine 产品内容。

## 说明
这不是猪产品没上传，也不是种属中文按钮传错，而是查询条件拼接方式在大量产品时不稳定。
