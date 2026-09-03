# Redeem Order Shipping Workflow

Time: 2026-08-06 17:29 CST

## Background

The user redeemed 2000 points for an Apple Watch SE3. The frontend immediately showed "兑换成功", but did not collect recipient information, shipment details, or show a review/shipping workflow. The admin order page also did not show customer contact details.

## Changes

- `app/(shop)/store/page.tsx`
  - Replaced direct redeem action with a "提交兑换申请" modal.
  - Requires recipient name, phone, email, and shipping address.
  - Changed success copy to "兑换申请已提交，后台审核通过后工作人员会联系您确认发货信息。"
- `app/api/shop/redeem/route.ts`
  - Validates recipient/contact/shipping fields before redeeming.
  - Creates pending redeem orders with contact fields.
  - Added fallback: if the new database columns have not been applied yet, stores the submitted contact/shipping information in `remark` so it is not lost.
- `app/admin/orders/page.tsx`
  - Shows customer email, recipient, phone, shipping email, address, customer note, and backend remark.
  - Adds review workflow buttons: approve, mark shipped/completed, cancel/refund.
- `app/api/admin/orders/route.ts`
  - Admin orders now include the auth user email via `auth.admin.getUserById`.
  - Supports `approved` status once migration 058 is applied.
- `app/(user)/member/page.tsx`
  - Shows redeem order status labels in the member center.
- `supabase/migrations/058_redeem_orders_shipping_workflow.sql`
  - Adds contact/shipping fields.
  - Expands redeem order statuses to `pending`, `approved`, `fulfilled`, `cancelled`.

## Verification

- `npm run build` passed.
- Deployed with `SKIP_BUILD=true npm run deploy:aliyun`.
- Production health check passed: 23 pages and 4 APIs.

## Follow-Up

Run `supabase/migrations/058_redeem_orders_shipping_workflow.sql` in Supabase SQL Editor. Before this SQL is applied, new contact information is saved into `remark` as a compatibility fallback, but the full `approved` status requires the migration.
