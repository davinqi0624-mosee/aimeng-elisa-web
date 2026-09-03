# Login AI Avatar And Citation IF Edit

Time: 2026-08-06 17:56 CST

## Background

The user asked to replace the login page icon with an AI digital human. They also corrected a reviewed citation IF value: the paper "Sequence-regulated, lung-targeting heteropolypeptide nanoparticles via in situ erythrocyte hitchhiking" should have IF 18.9 instead of 18.1.

## Changes

- `app/login/page.tsx`
  - Replaced the flask icon with an AI digital human image.
  - Kept AIMENG UNING brand text below the image.
- `public/brand/ai-digital-human-login.png`
  - Created a lightweight resized login-specific asset from `public/brand/ai-chat-agent.png`.
  - Reduced image size from about 2MB to about 276KB.
- `papers` Supabase table
  - Updated the target paper's `impact_factor` from 18.1 to 18.9.
  - Kept `points_awarded` at 1200 because both IF values are in the same points tier.
- `app/api/admin/citations/route.ts`
  - Added `update_if` action for verified papers.
  - Blocks automatic IF correction if the new IF would require changing awarded points, to avoid ledger mismatch.
- `app/admin/citations/page.tsx`
  - Added status filters: pending, verified, rejected, all.
  - Allows IF and IF source edits on verified papers.
  - Added "保存 IF 更正" action.

## Verification

- `npm run build` passed.
- Deployed with `SKIP_BUILD=true npm run deploy:aliyun`.
- Production health check passed: 23 pages and 4 APIs.
- Verified `http://106.14.215.238/brand/ai-digital-human-login.png` returns `200 image/png`.
- Re-read the target paper from Supabase and confirmed `impact_factor` is 18.9 and `points_awarded` remains 1200.
