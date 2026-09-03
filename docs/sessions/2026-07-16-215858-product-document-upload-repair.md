# Product Document Upload Repair

## Context

管理员批量上传 62 个猪种属说明书后，后台显示全部重复且“确认上架前台”不可用，但前台产品页仍显示说明书暂缺。

## Root Cause

`product_documents` 旧唯一索引 `idx_product_documents_unique_key` 覆盖了 `archived` 记录。已撤回批次中的旧说明书记录仍占用 `(product_id, document_type, document_key)`，导致新上传文件按货号匹配产品时触发唯一键冲突。旧逻辑把冲突当作“已有说明书重复”，删除了新上传 PDF，但前台实际没有 active 且可下载的说明书。

## Changes

- Added migration `050_product_documents_upload_repair.sql` to drop the old full unique index and keep only active-document uniqueness.
- Updated `app/api/admin/products/documents/bind/route.ts`:
  - duplicate is valid only when an active frontend document exists and its storage file exists;
  - broken active documents are archived so new uploads can repair them;
  - inactive legacy key conflicts are released before matching;
  - unmatched files are deleted from storage and marked for retry.
- Updated `app/api/admin/product-documents/batches/route.ts`:
  - batch summaries distinguish frontend-effective duplicates from deleted files that need retry;
  - batch withdrawal deletes storage files and records the result;
  - deleted-file records cannot be restored.
- Updated `app/api/admin/product-documents/route.ts`:
  - single-file withdrawal deletes the storage file;
  - deleted-file records cannot be reopened.
- Updated `app/admin/product-documents/page.tsx`:
  - shows “需重传” for deleted-file records;
  - hides restore actions for deleted-file records;
  - separates “前台已有可用说明书” from “文件已删除需重传”.

## Data Repair

- Marked batch `7d00c3d7-ebaa-4c04-a37b-9262f7ca8b02` as archived with a note that its 62 files were deleted by the old duplicate logic and must be re-uploaded.
- Released 65 archived legacy document keys online so future uploads are not blocked by withdrawn records.

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Health check passed for 22 pages and 4 APIs on `http://106.14.215.238`.
