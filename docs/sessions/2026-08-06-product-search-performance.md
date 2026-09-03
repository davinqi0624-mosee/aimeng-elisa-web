# Product Search Performance Repair

Time: 2026-08-06 16:53 CST

## Background

The user reported that product lookup and finding information felt slow. Initial production timing showed:

- `/products/elisa`: about 10.7s TTFB.
- `/api/search?q=il6`: about 4.35s.
- `/`: about 0.05s TTFB, so the whole server was not generally slow.

## Root Causes

- The ELISA search page queried Supabase many times on every request to count available species.
- The search API used exact count and returned all product fields for a small result list.
- Fuzzy product search uses `ILIKE '%keyword%'`; without trigram indexes, Postgres may scan more rows.
- Supabase is remote from the Aliyun server, so every extra database round trip is amplified.

## Changes

- `app/(shop)/search/page.tsx`
  - Removed repeated species count queries from the public search page.
  - Uses the known `SPECIES_ORDER` list for the filter UI instead.
- `app/api/search/route.ts`
  - Removed exact count from public search results.
  - Replaced `select('*')` with a focused field list.
- `lib/downloads/service-forms-server.ts`
  - Cached ELISA testing service form settings for 10 minutes with `unstable_cache`.
- `supabase/migrations/057_product_search_performance_indexes.sql`
  - Added pg_trgm and search-related indexes for products, aliases, catalog numbers, and species filters.

## Verification

- `npm run build` passed.
- Deployed with `SKIP_BUILD=true npm run deploy:aliyun`.
- Health check passed: 23 pages and 4 APIs.
- After deployment:
  - `/products/elisa`: about 0.12s.
  - `/search`: about 0.13s.
  - `/api/search?q=il6`: still about 2-3s before applying migration 057.
  - `/products/elisa?q=IL-6&species=Mouse`: about 2.6s before applying migration 057.

## Follow-Up

Run `supabase/migrations/057_product_search_performance_indexes.sql` in Supabase SQL Editor to improve keyword fuzzy search.
