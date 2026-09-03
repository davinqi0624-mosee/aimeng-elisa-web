ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS feedback_note TEXT,
  ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

COMMENT ON COLUMN ai_conversations.feedback_note IS '用户或管理员对 AI 回答的补充、更正或改写建议，用于后续知识沉淀。';
COMMENT ON COLUMN ai_conversations.feedback_at IS '最近一次点赞/点踩或补充反馈时间。';

NOTIFY pgrst, 'reload schema';
