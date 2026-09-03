# Product Document Upload Refresh And Auto Match

Date: 2026-07-14

## Issue

After uploading 14 datasheet PDFs, the batch summary showed 14 uploaded and 14 unmatched, but the document table showed no records. The files existed in `product_documents`; the UI had refreshed documents using stale batch state after creating a new upload batch.

## Fix

- Changed the admin product documents page so document loading can explicitly target a batch id and status.
- After upload, the page now:
  - switches status to pending,
  - automatically runs document matching for the newly created batch,
  - reloads the document table using that exact batch id.
- The refresh button now calls document loading without accidentally passing the click event as options.

## Current Batch Repair

The latest batch `814dd556-d223-4287-a6f2-f10a42f8b042` was repaired:

- Total files: 14
- Unmatched: 0
- Pending review: 14
- Exact pending: 14
- Active: 0
- Archived: 0

All files `LV170001` through `LV170014` matched active Guinea-Pig products by exact catalog number and remain pending for admin confirmation.

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Production health check passed.
- Database verification confirmed the latest batch has 14 exact catalog matches pending confirmation.
