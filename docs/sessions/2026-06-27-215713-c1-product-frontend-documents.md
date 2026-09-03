# C1 产品前台资料展示巡检

时间：2026-06-27 21:57

## 背景

上一轮完成产品文档批次中心后，需要确认前台商品详情页、COA 查询页、产品文档入口是否能读取同一套资料数据。

## 发现

- 商品详情页已经读取新表 `product_documents`，并兼容旧字段 `datasheet_pdf`。
- COA 查询页仍只查询旧表 `serum_coa_documents`，会导致后台“产品文档批次中心”上传确认后的 COA 不能通过前台 COA 查询页查到。
- 产品卡片和血清图片组件存在 `<img>` lint warning。

## 修改

- `app/api/products/coa/route.ts`
  - 查询顺序调整为：先查 `product_documents` 中 active 的 COA，再查旧 `serum_coa_documents`。
  - 返回结构保持兼容，增加内部 `source_table` 标识。
  - 两张表都未初始化时返回清晰 setup 提示。

- `components/product/ProductCard.tsx`
  - 产品列表图片改用 `next/image`。

- `components/product/SerumImage.tsx`
  - 血清产品图片改用 `next/image`。
  - 保留图片失败后的兜底状态。

- `app/(shop)/search/page.tsx`
  - 清理无用导入。

## 验证

- 产品前台 scoped lint：0 errors，0 warnings。
- `npm run build` 通过。

## 后续

建议继续做 C2：产品搜索 API 和前台搜索页的特殊字符、希腊字母、货号精准匹配巡检。
