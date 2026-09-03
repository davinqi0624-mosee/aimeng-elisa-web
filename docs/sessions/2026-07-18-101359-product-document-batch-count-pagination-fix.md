# Product Document Batch Count Pagination Fix

## Problem

Admin uploaded 139 PDF datasheets. The upload result said:

- success: 139
- failed: 0
- auto matched: 138

But the batch center cards showed only 8 records:

- PDF upload: 8/139
- filename parsed: 8/8
- catalog matched: 8/8
- publish ready: 8/8

This made the workflow impossible to trust.

## Cause

`/api/admin/product-documents/batches` loaded documents for multiple recent batches in one Supabase query. Supabase only returned the first page of rows, so large/recent batches could be partially represented. The selected 139-file batch only had 8 rows in the batch summary response, while the upload/match operation had actually processed 138 matched files.

## Fix

- Updated `app/api/admin/product-documents/batches/route.ts`.
- Added paginated loading for `product_documents` in 1000-row pages.
- Batch summary now calculates modules from the complete set of rows returned for the recent batch list, not just Supabase's first page.

## Verification

- `npm run build` passed.

## Expected Result

For the 139-file batch, the module cards should align with the upload result:

- PDF upload should show 139/139.
- Filename recognition should reflect the actual parsed count.
- Catalog matching should show 138/139 or 138/138 depending on denominator wording.
- Publish check should show 138 files ready to publish.
