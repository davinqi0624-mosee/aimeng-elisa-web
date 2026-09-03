-- 文献审核增强：防重复、期刊 IF 表、文件信息与审核备注

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES papers(id),
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS if_source TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'extracted', 'manual_required', 'failed'));

CREATE INDEX IF NOT EXISTS idx_papers_file_hash
  ON papers(file_hash)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_papers_doi_lower
  ON papers(lower(doi))
  WHERE doi IS NOT NULL AND doi <> '';

CREATE INDEX IF NOT EXISTS idx_papers_duplicate_of
  ON papers(duplicate_of)
  WHERE duplicate_of IS NOT NULL;

CREATE TABLE IF NOT EXISTS journal_if_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  impact_factor NUMERIC(6,3) NOT NULL CHECK (impact_factor >= 0),
  jcr_year INTEGER NOT NULL,
  cover_url TEXT,
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_if_scores_name
  ON journal_if_scores(normalized_name);

ALTER TABLE journal_if_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_if_scores_select_all ON journal_if_scores;
CREATE POLICY journal_if_scores_select_all
  ON journal_if_scores
  FOR SELECT
  TO anon, authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
