# Product Document Batch Recovery

Date: 2026-07-14

## Issue

Product document uploads were hard to recover from mistakes:

- Automatic matching only processed pending documents.
- If a document or batch was archived by mistake, it could not be restored from the admin UI.
- Batch confirmation only counted pending exact matches, so archived exact matches made the confirm button unavailable.
- Product detail pages with URL-encoded Greek characters in slugs could return 404.

The Rabbit datasheets were present in storage but archived, so product pages showed the datasheet as missing.

## Fix

- Added server support to reopen individual archived product documents.
- Added batch action to restore archived batch documents back to pending review.
- Changed exact-match batch confirmation so mistakenly archived exact matches can still be confirmed.
- Updated automatic matching to optionally include archived documents when reviewing archived records.
- Admin UI now defaults to the latest batch and exposes a "恢复批次待确认" action.
- Product detail pages now decode dynamic slugs before querying products.

## Data Repair

Restored and activated current Rabbit datasheets:

- `LV210002-Rabbit tnf-a Elisa Kit.pdf`
- `LV210003-Rabbit TGF-β1 Elisa Kit.pdf`
- `LV210004-Rabbit VEGF VEGFA Elisa Kit.pdf`
- `LV210005-Rabbit β-NGF Elisa Kit.pdf`

Existing Goat datasheets remained active:

- `LV220001-Capra hircus LPS Elisa Kit.pdf`
- `LV220002-Capra hircus DAO Elisa Kit.pdf`

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Production health check passed.
- Rabbit species product listing returns 200 and shows all 4 Rabbit products.
- All 4 Rabbit product detail pages return 200, show one "下载说明书" action, and no longer show "说明书暂缺".
