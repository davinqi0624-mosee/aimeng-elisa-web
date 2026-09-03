# 2026-06-27 Product Document Batch Center

## 背景

用户强调批量上传 PDF 时必须有撤回、归档和批次级复核能力。尤其是上千份文件上传时，不能靠逐个删除错误文件，也不能让自动匹配结果直接对客户生效。

## 已完成

- 新增数据库迁移：
  - `supabase/migrations/042_product_document_batches.sql`
  - 新增 `product_document_batches` 批次表。
  - 给 `product_documents` 增加：
    - `batch_id`
    - `match_method`
    - `review_note`
  - `match_method` 支持：
    - `none`
    - `exact_catalog`
    - `name_similarity`
    - `manual`

- 新增批次 API：
  - `app/api/admin/product-documents/batches/route.ts`
  - `GET`：读取批次列表和统计。
  - `POST`：创建上传批次。
  - `PATCH mark_reviewing`：上传完成后进入复核。
  - `PATCH confirm_exact`：批量确认“货号精确匹配”的文件。
  - `PATCH archive_batch`：归档批次。

- 更新文档上传 API：
  - `app/api/admin/product-documents/route.ts`
  - 上传时接收 `batch_id`。
  - 新文件统一为 `pending`，不直接前台生效。
  - 手工指定商品时标记 `match_method = manual`。
  - 撤回匹配时重置 `match_method = none`。

- 更新自动匹配 API：
  - `app/api/admin/products/documents/bind/route.ts`
  - 支持按当前批次匹配。
  - 货号命中时写入 `match_method = exact_catalog`。
  - 名称/靶标相似度命中时写入 `match_method = name_similarity`。
  - 自动匹配仍保持 `pending`，必须管理员确认。

- 更新后台页面：
  - `app/admin/product-documents/page.tsx`
  - 多文件上传时自动创建批次。
  - 批次中心可选择批次并查看统计：
    - 总文件
    - 未匹配
    - 待确认
    - 可批量确认
    - 已生效
    - 已归档
  - 增加“批量确认精确匹配”按钮。
  - 该按钮只处理 `match_method = exact_catalog` 且已匹配到商品的 pending 文件。

## 安全边界

- 自动匹配不直接生效。
- 名称相似匹配不能批量确认，必须人工逐个确认。
- 批量确认只放行货号精确匹配文件。
- 确认新说明书时，同商品旧 active 说明书会归档。
- 确认同批次 COA 时，同商品同批次旧 active COA 会归档。

## 验证

- 局部 lint 通过：
  - `app/api/admin/product-documents/route.ts`
  - `app/api/admin/product-documents/batches/route.ts`
  - `app/api/admin/products/documents/bind/route.ts`
  - `app/admin/product-documents/page.tsx`
- `npm run build` 通过。

## 待执行

需要在 Supabase SQL Editor 执行：

```text
supabase/migrations/042_product_document_batches.sql
```

## 下一步建议

- 做一次本地/云端小批量真实测试：
  - 3 个正确命名说明书。
  - 1 个错误货号说明书。
  - 2 个 COA，不同批次。
- 验证上传、自动匹配、批量确认、撤回、归档、前台展示是否都符合预期。
