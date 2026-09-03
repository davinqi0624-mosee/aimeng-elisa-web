# Product Document UI Simplification

Date: 2026-07-14

## Issue

The product document admin page exposed too many internal workflow states. It was unclear whether a batch had been uploaded, matched, or published. The list also defaulted to pending-only records, so a batch with all documents already active could show "暂无文档".

## Changes

- Document list now defaults to all statuses instead of pending-only.
- Backend list API supports `status=all`.
- Batch progress cards were simplified to three business states:
  - Uploaded to backend
  - Catalog matched
  - Published to frontend
- Main batch action labels were simplified:
  - `确认上架前台`
  - `撤回本批次`
- Status labels were renamed:
  - `未匹配`
  - `待上架`
  - `已上架`
  - `已撤回`

## Verification

- `npm run build` passed.
- `npm run deploy:aliyun` completed.
- Production health check passed.
- The active Guinea-Pig batch should now show the 14 uploaded documents in the table instead of an empty pending-only list.
