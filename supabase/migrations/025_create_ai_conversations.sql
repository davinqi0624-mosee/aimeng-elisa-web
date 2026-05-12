-- ============================================================
-- AI Self-Evolution System: Conversation Logging Table
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_type TEXT DEFAULT 'rag', -- 'rag', 'product', 'knowledge'
  products_referenced TEXT[], -- array of product IDs mentioned
  feedback TEXT CHECK (feedback IN ('upvote', 'downvote', null)),
  extracted_at TIMESTAMPTZ, -- set when processed into knowledge_candidates
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_feedback ON ai_conversations(feedback) WHERE feedback IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_conv_created ON ai_conversations(created_at);
