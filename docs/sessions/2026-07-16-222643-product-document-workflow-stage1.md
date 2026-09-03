# Product Document Workflow Stage 1

## Objective

Start the modular rebuild of product PDF document upload using six workflow modules:

1. PDF upload
2. Filename recognition
3. Catalog/product matching
4. Publish validation
5. Error handling
6. Batch audit and rollback

## Changes

- Extended `/api/admin/product-documents/batches` batch summaries with structured workflow fields:
  - `requested_total`
  - `upload_success`
  - `upload_failed`
  - `filename_ok`
  - `filename_failed`
  - `matched_exact`
  - `matched_manual`
  - `match_failed`
  - `publish_ready`
  - `published`
  - `frontend_verified`
  - `storage_deleted`
  - `alert_level`
- Added a `retry` document status filter to `/api/admin/product-documents` so deleted/failed files can be listed directly.
- Rebuilt the admin product document batch center into six workflow cards:
  - PDF upload
  - name recognition
  - catalog matching
  - publish validation
  - error handling
  - batch audit
- Added direct actions for:
  - viewing filename/match issues
  - viewing files that must be re-uploaded
  - one-click publishing when exact matches are ready
- Added high-failure alert when a batch has a failure ratio of 20% or higher.

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Health check passed for 22 pages and 4 APIs on `http://106.14.215.238`.

## Next Stage

Stage 2 should formalize status fields in the database instead of deriving workflow state from existing columns and notes.
