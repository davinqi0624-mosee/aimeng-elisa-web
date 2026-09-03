# Product Document Workflow Stage 3

## Objective

Improve batch upload reliability and operator error handling for product PDF documents.

## Changes

- Added pre-publish storage validation:
  - single-file publish checks that the PDF still exists in Supabase Storage;
  - batch publish checks each PDF before publishing;
  - missing files are not published and are marked as needing re-upload.
- Batch publish now processes files independently:
  - one missing/broken file no longer blocks the whole batch;
  - response reports confirmed count and failed count.
- Improved retry filtering:
  - `status=retry` now filters by `storage_status`, `failure_reason`, and legacy notes;
  - it no longer misses pending records whose storage file was already deleted.
- Added admin UI support:
  - `failure_reason`, `storage_status`, `publish_status`, and `match_status` are included in document rows;
  - failure reason is shown before generic match/review notes;
  - “复制异常清单” button copies the current batch issue list for re-upload preparation.
- Added missing-file recognition:
  - records containing “PDF 文件不存在” are treated as needing re-upload;
  - such records cannot be restored as if they still had a file.

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Health check passed for 22 pages and 4 APIs on `http://106.14.215.238`.

## Note

Stage 3 is backward compatible with old schema. For full structured workflow persistence, execute `supabase/migrations/051_product_document_workflow_statuses.sql` in Supabase.
