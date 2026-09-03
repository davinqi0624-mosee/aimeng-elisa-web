-- 清理文献审核中明显异常的 IF 值，避免 AI 误读值被用于积分审核。

UPDATE papers
SET
  impact_factor = NULL,
  if_source = NULL
WHERE upload_status = 'pending'
  AND impact_factor IS NOT NULL
  AND impact_factor < 0.1;

NOTIFY pgrst, 'reload schema';
