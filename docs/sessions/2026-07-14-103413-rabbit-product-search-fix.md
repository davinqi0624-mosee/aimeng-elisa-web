# Rabbit Product Search Fix

Date: 2026-07-14

## Issue

Newly imported Rabbit ELISA products existed in the database, but the frontend species filter did not reliably show Rabbit. During the previous fix attempt, `/products`, `/products/elisa`, and `/search` hit a runtime error because a Server Component imported constants from a `'use client'` icon module.

## Fix

- Moved shared species constants into `lib/products/species.ts`.
- Updated server routes/pages to import species matching data from the server-safe module.
- Kept `components/icons/SpeciesIcons.tsx` client-only and re-exported the constants for existing client imports.
- Preserved the product search species count check so low-count species such as Rabbit are not missed by Supabase row limits.

## Verification

- `npm run build` passed locally.
- `npm run deploy:aliyun` completed.
- Production health check passed.
- Verified production pages:
  - `/products/elisa` returns 200.
  - `/products/elisa?species=Rabbit` returns 4 Rabbit products.
  - `/products/elisa?q=Rabbit` returns Rabbit products.
  - `/products/elisa?q=兔` returns Rabbit products when URL encoded.
  - `/products/elisa?q=LV210002` returns the Rabbit TNF-a product.

Rabbit products verified:

- `LV210002` Rabbit tnf-a ELISA Kit
- `LV210003` Rabbit TGF-β1 ELISA Kit
- `LV210004` Rabbit VEGF/VEGFA ELISA Kit
- `LV210005` Rabbit β-NGF ELISA Kit
