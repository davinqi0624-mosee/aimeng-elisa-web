# 产品文档批次中心巡检

时间：2026-06-27 21:44

## 背景

用户询问批量上传是否已经从前后台处理完成，并要求继续按 lint 小区块修缮网站历史债务。

## 判断

批量上传已经有基础闭环：

- 表格类商品批量导入有 `bulk_import_batches` 记录。
- PDF 说明书/COA 有 `product_document_batches` 批次中心。
- 文件按货号、批次号自动匹配后需要人工确认才会生效。

本轮重点补强“批量上传误操作后的反应机制”。

## 修改

- `app/admin/product-documents/page.tsx`
  - 批量上传创建批次失败时显示明确错误。
  - 标记批次进入复核状态时检查接口返回。
  - 增加“归档整个批次”按钮。

- `app/api/admin/product-documents/route.ts`
  - 权限从 `requireSuper` 调整为 `requireAdminOrSuper`，与后台导航入口一致。
  - 单个文件确认时检查旧文件归档错误。

- `app/api/admin/product-documents/batches/route.ts`
  - 权限从 `requireSuper` 调整为 `requireAdminOrSuper`。
  - `archive_batch` 会同步归档批次下所有未归档文件。
  - 批量确认精确匹配时检查每一步数据库错误。

- `app/api/admin/products/documents/bind/route.ts`
  - 权限从 `requireSuper` 调整为 `requireAdminOrSuper`。

## 验证

- `npm exec eslint -- app/admin/product-documents/page.tsx app/api/admin/product-documents/route.ts app/api/admin/product-documents/batches/route.ts app/api/admin/products/documents/bind/route.ts`
- `npm run build`

均通过。
