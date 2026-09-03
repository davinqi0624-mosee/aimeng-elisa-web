# Product Document Upload Duplicate and Copy Fix

## Problem

Admin uploaded a 200-file monkey datasheet batch and saw confusing counts:

- top workflow cards showed 117/200 in one view
- upload summary showed 199 successful, 1 failed, 189 matched, 10 duplicates
- the "复制异常清单" button appeared to do nothing

## Investigation

Database checks showed two important batches:

- `60b4a67d-ea9f-46a6-99c1-8fd65bdcc6b0`
  - `199` documents total
  - `189` pending/matched
  - `10` archived duplicates
  - `10` storage-deleted duplicate records
- `f2331201-1895-4780-a131-57eac6e32bb6`
  - `200` documents total
  - `200` active

The 10 "duplicates" were not caused by stale deletions. They were genuine duplicates of monkey catalog numbers that already had active frontend documents in the previous completed batch `f233...`.

## Changes

- `app/api/admin/product-documents/route.ts`
  - added storage existence validation before confirming a single document;
  - missing files are marked as `archived` / `storage_status='missing'` and cannot be restored;
  - `retry` filtering now recognizes `storage_status`, `failure_reason`, and legacy notes.
- `app/api/admin/product-documents/batches/route.ts`
  - batch confirm now validates each file independently;
  - missing files no longer block the whole batch;
  - batch response now returns `confirmed`, `failed`, and `failures`;
  - `storage_status='PDF 文件不存在'` style failures are treated as re-upload candidates.
- `app/admin/product-documents/page.tsx`
  - added clipboard fallback for "复制异常清单":
    - `navigator.clipboard`
    - `document.execCommand('copy')`
    - `window.prompt` fallback
  - failure reasons now prefer structured `failure_reason`.

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Health check passed for 22 pages and 4 APIs on `http://106.14.215.238`.

## Note

The duplicate count here is expected for identical catalog numbers that already have active frontend documents. It is not evidence of residual deleted files for those 10 items.
