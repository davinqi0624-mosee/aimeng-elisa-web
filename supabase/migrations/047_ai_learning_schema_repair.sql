-- AI 客服纠错学习闭环结构修复：
-- 线上 ai_conversations 表可能来自早期版本，缺少 source_type 等字段，
-- 导致前台反馈无法绑定学习记录，知识候选无法进入后台审核。

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  question TEXT,
  answer TEXT,
  source_type TEXT DEFAULT 'rag',
  products_referenced TEXT[] DEFAULT ARRAY[]::TEXT[],
  feedback TEXT,
  feedback_note TEXT,
  feedback_at TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS answer TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'rag',
  ADD COLUMN IF NOT EXISTS products_referenced TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS feedback_note TEXT,
  ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE ai_conversations
SET
  question = COALESCE(question, ''),
  answer = COALESCE(answer, ''),
  source_type = COALESCE(source_type, 'rag'),
  products_referenced = COALESCE(products_referenced, ARRAY[]::TEXT[]),
  created_at = COALESCE(created_at, NOW());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_conversations_feedback_check'
  ) THEN
    ALTER TABLE ai_conversations
      ADD CONSTRAINT ai_conversations_feedback_check
      CHECK (feedback IN ('upvote', 'downvote') OR feedback IS NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_conv_feedback
  ON ai_conversations(feedback)
  WHERE feedback IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conv_created
  ON ai_conversations(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_conv_extracted
  ON ai_conversations(extracted_at)
  WHERE extracted_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_conversation_id TEXT,
  source_type TEXT DEFAULT 'ai_chat',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  suggested_title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  ai_quality_score DECIMAL(3,2) DEFAULT 0.50,
  ai_extract_reason TEXT,
  status TEXT DEFAULT 'pending',
  reviewer_id UUID,
  review_note TEXT,
  merged_into_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE knowledge_candidates
  ADD COLUMN IF NOT EXISTS source_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'ai_chat',
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS answer TEXT,
  ADD COLUMN IF NOT EXISTS suggested_title TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS ai_quality_score DECIMAL(3,2) DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS ai_extract_reason TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS merged_into_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status
  ON knowledge_candidates(status);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_created_at
  ON knowledge_candidates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_source_conversation
  ON knowledge_candidates(source_conversation_id, source_type);

COMMENT ON TABLE ai_conversations IS 'AI 客服问答记录。用于点赞/点踩反馈、客户异议提取和知识候选沉淀。';
COMMENT ON TABLE knowledge_candidates IS 'AI 自动提取或客户反馈产生的知识候选，必须经管理员审核后才能进入正式知识库。';

NOTIFY pgrst, 'reload schema';
