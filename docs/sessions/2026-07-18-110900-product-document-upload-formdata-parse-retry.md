# Product Document Upload FormData Parse Retry

## Problem

During a 200-file datasheet upload, the first 50 files reached the backend, then many later files failed with:

`服务器返回 500`

Server logs showed:

`TypeError: Failed to parse body as FormData.`

## Cause

The request body did not arrive at the Next.js route as a complete multipart form upload. This happens before Supabase storage upload and before database insert. It is not a catalog number matching error and not a PDF-to-product binding error.

Disk space and nginx upload size limits were checked and were normal:

- root disk had ample free space;
- inode usage was normal;
- nginx `client_max_body_size` was 50 MB;
- proxy timeouts were 300 seconds.

The likely trigger was a long sequence of large browser uploads causing some request bodies to be interrupted/truncated.

## Fix

- `app/api/admin/product-documents/route.ts`
  - wrapped `request.formData()` in a try/catch;
  - returns a clear 408 JSON error when the upload request body is incomplete;
  - logs the parse failure explicitly.
- `app/admin/product-documents/page.tsx`
  - recreates `FormData` for every retry attempt;
  - retries incomplete upload-body failures;
  - adds a short 1.5 second pause after every 40 successful files in a large batch.

## Verification

- `npm run build` passed.
