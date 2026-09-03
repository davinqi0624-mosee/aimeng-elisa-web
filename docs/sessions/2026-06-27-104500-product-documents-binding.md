# 2026-06-27 Product Documents Binding

## Focus
- Product detail/edit workflow concerns
- Bulk import ordering concerns
- PDF/COA file matching after separate uploads

## What changed
- Added a thin `product_documents` table for datasheet/COA binding.
- Added admin API to upload product documents into storage and record them as pending/active.
- Added admin API to scan pending docs and bind them to products by filename/catalog-number heuristics.
- Added cleanup coverage so product document files are not treated as orphans.

## Verification
- Scoped ESLint passed for:
  - `app/admin/products/page.tsx`
  - `app/api/admin/products/route.ts`
  - `app/api/admin/products/bulk-import/route.ts`
  - `app/api/products/match/route.ts`
  - `app/api/admin/product-documents/route.ts`
  - `app/api/admin/products/documents/bind/route.ts`
  - `app/api/admin/storage-cleanup/route.ts`

## Next best slice
- Add a small admin page/action for document upload + binding.
- Decide whether product detail pages should show multiple document types from `product_documents` in addition to `products.datasheet_pdf`.
