-- 文献引用安全加固：收紧早期 RLS 宽权限、防止重复奖励、统一积分流水字段。

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS source_table TEXT;

UPDATE point_transactions
SET
  source = COALESCE(source, type),
  type = 'earn',
  source_table = COALESCE(source_table, 'papers')
WHERE type = 'paper_citation_verified';

-- 早期迁移留下的宽权限会让客户直接读取/更新 papers，文献审核应统一走服务端 API。
DROP POLICY IF EXISTS "papers_select_all" ON papers;
DROP POLICY IF EXISTS "papers_update_own" ON papers;
DROP POLICY IF EXISTS papers_select_public ON papers;
DROP POLICY IF EXISTS papers_select_own ON papers;
DROP POLICY IF EXISTS papers_insert_own ON papers;

CREATE POLICY papers_select_public
  ON papers
  FOR SELECT
  TO anon, authenticated
  USING (upload_status = 'verified' AND is_displayed = true);

CREATE POLICY papers_select_own
  ON papers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY papers_insert_own
  ON papers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND upload_status = 'pending'
    AND status = 'pending'
    AND COALESCE(is_displayed, false) = false
    AND COALESCE(points_awarded, 0) = 0
    AND citation_type = 'user_submitted'
    AND source_type IN ('customer_upload', 'manual_form')
  );

-- 普通客户不能直接更新文献审核状态；后台审核使用 service_role。

WITH ranked_doi AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, lower(doi)
      ORDER BY (upload_status = 'verified') DESC, created_at ASC, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY user_id, lower(doi)
      ORDER BY (upload_status = 'verified') DESC, created_at ASC, id ASC
    ) AS rn
  FROM papers
  WHERE user_id IS NOT NULL
    AND doi IS NOT NULL
    AND doi <> ''
    AND upload_status <> 'rejected'
),
doi_duplicates AS (
  SELECT id, keep_id
  FROM ranked_doi
  WHERE rn > 1
)
UPDATE papers p
SET
  upload_status = 'rejected',
  status = 'rejected',
  is_displayed = false,
  duplicate_of = d.keep_id,
  rejection_reason = COALESCE(p.rejection_reason, '同一客户已经提交过相同 DOI，本次申请按重复提交处理，不能重复发放积分。'),
  review_notes = COALESCE(p.review_notes, '同一客户已经提交过相同 DOI，本次申请按重复提交处理，不能重复发放积分。')
FROM doi_duplicates d
WHERE p.id = d.id;

WITH ranked_file AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, file_hash
      ORDER BY (upload_status = 'verified') DESC, created_at ASC, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY user_id, file_hash
      ORDER BY (upload_status = 'verified') DESC, created_at ASC, id ASC
    ) AS rn
  FROM papers
  WHERE user_id IS NOT NULL
    AND file_hash IS NOT NULL
    AND upload_status <> 'rejected'
),
file_duplicates AS (
  SELECT id, keep_id
  FROM ranked_file
  WHERE rn > 1
)
UPDATE papers p
SET
  upload_status = 'rejected',
  status = 'rejected',
  is_displayed = false,
  duplicate_of = d.keep_id,
  rejection_reason = COALESCE(p.rejection_reason, '同一客户已经提交过相同文件，本次申请按重复提交处理，不能重复发放积分。'),
  review_notes = COALESCE(p.review_notes, '同一客户已经提交过相同文件，本次申请按重复提交处理，不能重复发放积分。')
FROM file_duplicates d
WHERE p.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_unique_active_user_file_hash
  ON papers(user_id, file_hash)
  WHERE file_hash IS NOT NULL
    AND upload_status <> 'rejected';

CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_unique_active_user_doi
  ON papers(user_id, lower(doi))
  WHERE doi IS NOT NULL
    AND doi <> ''
    AND upload_status <> 'rejected';

-- 早期策略 pt_insert_admin 的 WITH CHECK (true) 过宽，会允许普通登录用户伪造积分流水。
DROP POLICY IF EXISTS pt_insert_admin ON point_transactions;
DROP POLICY IF EXISTS "pt_insert_admin" ON point_transactions;
DROP POLICY IF EXISTS pt_select_own ON point_transactions;

CREATE POLICY pt_select_own
  ON point_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 同一篇文献只允许产生一条“审核通过奖励”流水，防止重复点击/并发重复发分。
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_unique_paper_award
  ON point_transactions(source_table, source_id, type)
  WHERE source_table = 'papers'
    AND type = 'earn'
    AND source_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
