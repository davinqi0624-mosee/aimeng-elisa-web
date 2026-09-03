# C4 商品详情深层字段矩阵巡检

时间：2026-06-28 15:01

## 背景

继续 C3 后的产品详情字段巡检，重点看普通 ELISA 商品是否还有“数据库已有字段，但后台/导入/前台没接上”的隐形债务。

## 发现

- 历史迁移 `017_add_product_detail_fields.sql` 已经给 `products` 增加过 `assay_time` 和 `platform`。
- 后台商品编辑页没有这两个输入框。
- 商品保存 API 和批量导入 API 没有持久维护这两个字段。
- 前台详情页没有展示检测平台和检测时间。
- 后台下载的 Excel 模板仍是旧版字段，缺少 C3/C4 已接入的详情字段。
- `lib/xlsx-images.ts` 有 2 个历史 `any` 类型。

## 修改

- `app/admin/products/page.tsx`
  - 新增“检测平台”和“检测时间”编辑项。
  - 新建商品默认值为 `ELISA` 和 `4h 30m`。
  - Excel 解析支持 `platform` / `assay_time` 及中文别名。

- `app/api/admin/products/route.ts`
  - 创建和更新商品时保存 `platform` / `assay_time`。
  - 缺列 fallback 增加这两个字段，避免旧环境直接崩溃。

- `app/api/admin/products/bulk-import/route.ts`
  - 批量导入保存 `platform` / `assay_time`。
  - 缺列剥离逻辑支持这两个字段。

- `app/(shop)/products/[slug]/page.tsx`
  - 前台详情页读取 `platform` / `assay_time`，旧数据默认 `ELISA` / `4h 30m`。

- `components/product/ProductAccordion.tsx`
  - “产品详情”区展示检测平台、检测时间、检测方法、样本类型。

- `lib/xlsx-images.ts`
  - 更新商品导入模板字段。
  - 清理 `any` 类型。

## 验证

- scoped lint 通过。
- `npm run build` 通过。

## 迁移

本轮不需要新增迁移；`assay_time` 和 `platform` 已由历史迁移 `017_add_product_detail_fields.sql` 创建。
