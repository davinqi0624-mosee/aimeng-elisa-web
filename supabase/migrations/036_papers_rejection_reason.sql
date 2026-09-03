-- 文献审核拒绝原因：给客户展示明确的拒绝反馈。

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

NOTIFY pgrst, 'reload schema';
