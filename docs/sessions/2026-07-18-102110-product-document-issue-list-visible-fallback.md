# Product Document Issue List Visible Fallback

## Problem

The admin "复制异常清单" button appeared to do nothing. On plain HTTP deployments, browsers may block `navigator.clipboard`, and the previous fallback did not give a visible result if copying failed.

## Fix

- Updated `app/admin/product-documents/page.tsx`.
- The button now reloads all documents for the selected batch before generating the issue report.
- The issue report is always rendered in a visible textarea on the page.
- The app still attempts clipboard copy first, then falls back to `document.execCommand('copy')`.
- If browser copy permissions are blocked, admins can manually copy from the visible report.
- The report separates:
  - items requiring manual handling;
  - upload failure lines from the batch note;
  - duplicates that were automatically hidden because the frontend already has an active document.

## Verification

- `npm run build` passed.
