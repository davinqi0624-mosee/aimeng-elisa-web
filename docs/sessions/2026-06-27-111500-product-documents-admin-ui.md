# 2026-06-27 Product Documents Admin UI

## Scope
- `app/admin/product-documents/page.tsx`
- `app/admin/layout.tsx`
- `app/api/admin/product-documents/route.ts`
- `app/api/admin/products/documents/bind/route.ts`

## What changed
- Added a thin admin page for uploading and managing product datasheets / COA docs.
- Added sidebar navigation entry under admin.
- Kept upload and binding separate from product master-data editing.

## Verification
- Scoped ESLint passed for the files above.

## Next best slice
- Expose `product_documents` on product detail pages so admins and customers can see datasheet/COA attachments without hunting.
- Decide whether to show matched docs as a separate card/accordion section.
