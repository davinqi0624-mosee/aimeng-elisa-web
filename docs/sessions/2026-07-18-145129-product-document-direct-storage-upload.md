# Product Document Direct Storage Upload

## Goal

Replace the fragile PDF upload path:

`browser -> Next.js API multipart body -> Supabase Storage -> database`

with a direct Storage upload path:

`browser -> Supabase Storage -> Next.js API metadata registration -> database`

This avoids large PDF bodies passing through the Next.js server and removes the repeated `Failed to parse body as FormData` failure mode.

## Implementation

- Added `app/api/admin/product-documents/direct-upload/route.ts`.
  - `action: prepare`
    - requires admin authentication;
    - validates PDF names, size and document type;
    - parses catalog number and document key;
    - generates a server-controlled storage path under `product-assets/product-documents/{type}/`;
    - creates a Supabase signed upload token for that exact path.
  - `action: complete`
    - requires admin authentication;
    - validates the storage path prefix;
    - checks the file exists in Supabase Storage;
    - writes the `product_documents` row with the same fields used by the existing workflow.
- Updated `app/admin/product-documents/page.tsx`.
  - The admin page now uploads PDF files directly to Supabase Storage using `uploadToSignedUrl`.
  - Upload tokens are generated in 50-file chunks to reduce token-expiry risk and request pressure.
  - After each direct upload succeeds, the page calls the server to register the document record.
  - The existing batch, auto-match, confirm-publish, withdraw, retry and issue-list flow remains intact.

## Compatibility

- Existing uploaded files remain in `product-assets`.
- New files also upload into `product-assets/product-documents/datasheet/` or `product-assets/product-documents/coa/`.
- Existing `product_documents.file_url` usage remains unchanged.
- No old files need to be reuploaded.

## Verification

- `npm run build` passed.
- Deployed to `http://106.14.215.238` with `npm run deploy:aliyun`.
- Production health check passed for 22 pages and 4 APIs.
- Production direct upload endpoint is reachable and returns `401 未登录` without admin auth, confirming the deployed route is active and auth-protected.

## Next Validation

- Admin should test 2-3 PDF files first from `/admin/product-documents`.
- If small-batch direct upload passes, test 50-100 files.
- If a file fails, inspect the per-file status and server logs before retrying a large species batch.

## Follow-Up: Empty Content Upload Error

- Observed admin upload status repeatedly showing `No content provided`.
- This error is returned by the Storage upload step when the upload request reaches Storage without usable file content.
- Updated `app/admin/product-documents/page.tsx` so:
  - zero-byte PDF files fail immediately with a clear Chinese message;
  - `No content provided` / empty body errors stop immediately instead of retrying three times;
  - the batch will no longer spend about 10 seconds of retry delay on each file for this non-recoverable error.
- Verified with `npm run build`.
- Deployed to `http://106.14.215.238`; production health check passed.

## Follow-Up: Supabase Signed Upload Multipart Field

- User reported the combined direct/fallback flow still failed:
  - direct upload: `No content provided`;
  - server fallback: multipart request did not fully reach server.
- Root cause found for the direct upload path:
  - Supabase signed Storage upload expects the file in the unnamed multipart field.
  - The page had used `formData.append('file', file, file.name)`, which can cause Storage to return `No content provided`.
- Fixed `uploadFileToSignedUrl` to use:
  - `formData.append('', file, file.name)`
- Kept server fallback path in place.
- Verified with `npm run build`.
- Deployed to `http://106.14.215.238`; production health check passed.

## Follow-Up: Raw Body Signed Upload

- User still saw `No content provided` after the multipart signed upload field-name fix.
- Ran a controlled local test against the same Supabase Storage signed upload API:
  - created a signed upload URL;
  - uploaded a valid PDF with `PUT`, `content-type: application/pdf`, and the raw PDF bytes as the request body;
  - Supabase returned `200` and the file appeared in `product-assets`.
- Updated browser direct upload to use the same raw body shape:
  - `fetch(plan.signed_url, { method: 'PUT', headers: { content-type: application/pdf }, body: file })`
- This removes multipart encoding from the direct Storage path entirely.
- Kept server fallback path in place.
- Verified with `npm run build`.
- Deployed to `http://106.14.215.238`; production health check passed.

## Follow-Up: Local Script Import Fallback

- User copied files to Desktop and to a project-local clean folder, but browser upload still failed with `The I/O read operation failed`.
- Local system checks showed the PDFs are valid and readable:
  - around 4.8MB each;
  - PDF 1.7, 20 pages;
  - readable `%PDF-1.7` header.
- Added `scripts/import-product-documents-from-folder.mjs`.
  - Reads PDFs from a local folder with Node.js, bypassing browser File API.
  - Uploads files directly to Supabase Storage `product-assets/product-documents/datasheet/`.
  - Creates a `product_document_batches` record.
  - Inserts `product_documents` rows with exact catalog matching and `publish_status = ready`.
  - Supports optional `--publish` for direct active publishing.
- Ran the script for `/Users/moses/aimeng-elisa-web/project-materials/upload-test-bovine-pdfs-clean`.
  - Batch: `2f25a321-8dd3-4732-9248-a9cc75101eec`
  - Uploaded: 15
  - Matched: 15
  - Failed: 0
- Confirmed/published the batch directly in Supabase.
  - Confirmed: 15
  - Verified `LV80074` and `LV80083` are `status = active`, `publish_status = active`.

## Follow-Up: General Website Upload Resilience

- User correctly pointed out that the local folder script is only an operational fallback, not a general website fix.
- Updated the admin website upload flow to avoid requiring browser-side `arrayBuffer()` / `FileReader` reads.
- New browser upload strategy:
  1. Create a controlled signed Storage upload plan from the server.
  2. Try direct Supabase Storage upload using native `FormData` with the selected `File`.
  3. If direct Storage upload fails with local read / empty-content errors, automatically fall back to the existing server-mediated single-file upload endpoint.
  4. Only if both browser-to-Storage and browser-to-server upload fail does the page show a true browser/system file-access error.
- This keeps the public admin UI usable from other computers and other folders without depending on a fixed local path or Codex-operated scripts.
- Verified with `npm run build`.
- Deployed to `http://106.14.215.238`; production health check passed.

## Follow-Up: Local File Read Failure

- User tested 8 PDFs and all failed with `The I/O read operation failed`.
- Server logs showed no corresponding application error; the failure happens in the browser before the file reaches the website server or Supabase Storage.
- Root cause class: browser cannot read the selected local PDF file handle/content.
- Likely operational causes:
  - file selected from cloud-synced placeholder location;
  - file selected from a compressed archive, external disk, network folder or temporary folder;
  - file is locked, partially generated, corrupted, or not fully written to disk.
- Updated admin upload page:
  - added `FileReader` fallback if `file.arrayBuffer()` fails;
  - local unreadable files are now treated as non-retryable;
  - error message now explains copying files to a normal local folder before reselecting.
- Verified with `npm run build`.
- Deployed to `http://106.14.215.238`; production health check passed.

## Follow-Up: Native Signed URL Upload

- User reported `LV80074-103` still showed `3/3 次重试`.
- Because the new empty-content guard should not retry `No content provided`, this strongly indicates either:
  - the browser was still running the old loaded JS bundle; or
  - the SDK upload wrapper was still returning a different error path.
- Replaced the browser upload implementation again:
  - removed Supabase browser client usage from the admin upload page;
  - upload now uses native `fetch(plan.signed_url, { method: 'PUT', body: file.arrayBuffer() })`;
  - this sends the binary PDF directly to the signed Storage URL and avoids the SDK upload wrapper entirely.
- Verified with `npm run build`.
- Deployed to `http://106.14.215.238`; production health check passed.

## Follow-Up: Binary Upload Path

- A 90-file upload produced 62 successful files and 28 Storage failures with `No content provided`.
- The failed files had passed naming and matching only when uploaded successfully; the failure itself happened before database registration.
- Updated direct upload again:
  - `direct-upload prepare` now returns the full signed upload URL as `signed_url` for future diagnostics/alternate upload handling.
  - The admin page now reads each PDF with `file.arrayBuffer()` and uploads the binary payload to the signed Storage path, avoiding the FormData body path that produced intermittent empty-content errors.
- Verified with `npm run build`.
- Deployed to `http://106.14.215.238`; production health check passed.

## Follow-Up: Raw Server Upload Isolation

- User reported local upload still failed after moving files to Desktop/project-local folders and asked to solve the normal website upload path first.
- Server logs showed repeated `Product document upload form-data parse failed`, meaning the UI was still falling back to the old multipart endpoint after the newer path failed.
- Updated the admin upload page to make the primary local upload path explicit:
  - browser reads the selected PDF as an `ArrayBuffer`;
  - browser posts the raw PDF body to `/api/admin/product-documents/raw-upload`;
  - the old multipart fallback and direct Supabase Storage fallback are no longer used in this flow while diagnosing local upload.
- Updated `raw-upload` route:
  - pinned route to Node.js runtime and dynamic execution;
  - receives raw PDF bytes with `request.arrayBuffer()`;
  - checks expected file size against received byte size;
  - logs empty body, size mismatch, Storage upload failure, and DB insert failure separately.
- Verified with `npm run build`.

## Follow-Up: Browser File Read Failure

- User tested `LV80090-Bovine CD28 Elisa Kit.pdf`; UI failed before the request reached the server:
  - `浏览器无法读取该 PDF 文件`
  - original browser error: `The I/O read operation failed`
- Since this happens before Supabase/database/matching, updated the upload UI again:
  - file input is no longer `display: none`; it is visually hidden with `sr-only` and opened by a real button;
  - local upload no longer calls `file.arrayBuffer()`;
  - local upload no longer prepares Supabase direct-upload tokens;
  - files are sent to the website server with `XMLHttpRequest.send(file)`, a more traditional and stable browser upload path.
- Verified with `npm run build`.

## Follow-Up: Nginx Upload Timeout

- User retested after XHR upload; UI showed `浏览器到网站服务器的上传连接失败`.
- Nginx access log showed the raw upload request did reach the server, but returned `408` after exactly 60 seconds:
  - `POST /api/admin/product-documents/raw-upload?...file_size=5056544 HTTP/1.1" 408`
- This means Nginx timed out while receiving the client request body before forwarding it to Next.js.
- Updated production Nginx config for `/api/admin/product-documents/raw-upload`:
  - `client_body_timeout 900s`;
  - `proxy_request_buffering off`;
  - `proxy_buffering off`;
  - `proxy_send_timeout 900s`;
  - `proxy_read_timeout 900s`;
  - kept `client_max_body_size 50m`.
- Also moved an accidental backup file out of `/etc/nginx/sites-enabled` to `/root/nginx-backups`, because files in `sites-enabled` are loaded as active Nginx configs.
- `nginx -t` passed and Nginx was reloaded.

## Follow-Up: Disable Signed Upload Tokens

- User decided the "上传预签名/上传令牌" feature is not needed.
- Removed product-document upload page code related to signed direct upload:
  - direct-upload plan types;
  - signed URL upload helper;
  - prepare/complete direct-upload calls;
  - "上传令牌" and direct Storage flow remnants.
- Product-document PDF upload now uses only the controlled server path:
  - browser XHR -> `/api/admin/product-documents/raw-upload` -> Supabase Storage -> database record.
- Changed `/api/admin/product-documents/direct-upload` to a disabled compatibility endpoint returning `410 DIRECT_UPLOAD_DISABLED`, so old cached clients cannot obtain upload tokens.
- Verified with `npm run build`.

## Follow-Up: Long Upload Visibility

- User reported one PDF upload stayed in progress for about 5 minutes.
- Server logs showed the active request was aborted from the client side after the front-end XHR 5-minute timeout:
  - Next logged `ECONNRESET`;
  - Nginx logged the raw-upload request as `408`.
- Updated production Nginx upload block again:
  - changed `proxy_request_buffering` back to `on`;
  - changed `proxy_buffering` back to `on`;
  - added `client_body_buffer_size 512k`;
  - kept `client_body_timeout 900s`, `proxy_send_timeout 900s`, `proxy_read_timeout 900s`.
- Reason: for Safari and slow client uploads, Nginx should first receive the complete PDF body, then forward it to Next.js, instead of streaming an incomplete body to the app process.
- Updated admin upload UI:
  - XHR timeout increased from 5 minutes to 15 minutes;
  - XHR upload progress now reports percentage and sent MB/total MB in the status message.
- Verified with `npm run build`.

## Follow-Up: Keep Server-Mediated Upload Only

- User requested restoring/keeping the upload architecture as:
  - browser -> website server -> Supabase.
- Removed the locally added experimental chunk-upload route before deployment.
- Confirmed no `chunk-upload`, `server_chunk_upload`, signed URL creation, or direct Storage upload code remains in the active product-document upload flow.
- Current active flow:
  - admin page sends the PDF to `/api/admin/product-documents/raw-upload`;
  - server uploads the received PDF to Supabase Storage;
  - server writes the `product_documents` record.
- `/api/admin/product-documents/direct-upload` remains disabled with `410 DIRECT_UPLOAD_DISABLED`.
- Verified with `npm run build`.

## Follow-Up: Upload Status Display

- User pointed out that the upload status area used to show uploaded count / selected total, but was replaced by single-file percentage.
- Updated admin product document upload UI:
  - main status line now shows batch count progress, e.g. `已成功 3 个 / 共 10 个`;
  - current file percentage remains as a secondary smaller line below it.
- Verified with `npm run build`.
