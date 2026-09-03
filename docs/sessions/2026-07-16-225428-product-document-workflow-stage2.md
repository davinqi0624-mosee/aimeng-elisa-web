# Product Document Workflow Stage 2

## Objective

Formalize product document workflow state in database fields instead of relying on `review_note` text parsing.

## Migration

Added `supabase/migrations/051_product_document_workflow_statuses.sql`.

New `product_documents` columns:

- `upload_status`
- `parse_status`
- `match_status`
- `publish_status`
- `storage_status`
- `failure_reason`
- `workflow_updated_at`

The migration backfills existing rows from current `status`, `product_id`, `catalog_number`, `review_note`, and `match_reason`.

## Code Changes

- `app/api/admin/product-documents/route.ts`
  - upload inserts structured workflow states;
  - single-file archive/reopen/reset/confirm writes workflow states;
  - all workflow writes fall back to legacy fields if migration 051 has not been executed.

- `app/api/admin/products/documents/bind/route.ts`
  - match success writes `match_status='matched'` and `publish_status='ready'`;
  - duplicate frontend-effective uploads write `match_status='duplicate'`;
  - failed/unmatched/deleted files write `match_status='failed'`, `storage_status='deleted'`, and `failure_reason`;
  - broken active documents write `storage_status='missing'`.

- `app/api/admin/product-documents/batches/route.ts`
  - batch summaries prefer structured workflow fields;
  - if workflow columns are missing, summaries fall back to the previous `status`/`review_note` logic;
  - batch archive/reopen/confirm writes structured workflow states with legacy fallback.

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Health check passed for 22 pages and 4 APIs on `http://106.14.215.238`.

## Operator Note

The deployed code is backward compatible. To activate structured workflow persistence in Supabase, execute:

`supabase/migrations/051_product_document_workflow_statuses.sql`
