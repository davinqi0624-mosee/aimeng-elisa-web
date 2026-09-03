# AI 客服学习闭环补强

时间：2026-07-09 17:49

本轮处理：

- `app/api/ai/chat/route.ts`
  - 为每次 AI 回答生成 `conversationId`
  - 在流式完成事件里回传 `conversationId`
  - 将 `ai_conversations` 写入前置到流式结束时，保证前台反馈可追踪

- `app/(ai)/chat/page.tsx`
  - 点赞/点踩改为真正调用 `/api/ai/feedback`
  - 点踩后增加“补充/纠正”输入框
  - 提交纠正后给出状态提示

- `app/api/ai/feedback/route.ts`
  - 支持 `correction`
  - 点踩且填写纠正内容时，自动生成 `knowledge_candidates` 待审核项
  - 对未执行新 migration 的环境增加兼容回退

- `app/api/knowledge/extract/route.ts`
  - 提取提示词从“仅 ELISA”放宽到 ELISA / 血清 / 动物血制品 / 细胞培养 / 样本处理 / 常规实验问题

- `app/api/knowledge/extract-conversations/route.ts`
  - 同步放宽知识提取范围
  - 若存在 `feedback_note`，优先将人工纠正内容纳入提取上下文
  - 对尚未执行 `046` migration 的环境保持兼容

- `supabase/migrations/046_ai_feedback_learning_notes.sql`
  - 为 `ai_conversations` 增加 `feedback_note`、`feedback_at`

验证：

- `npm exec eslint -- app/api/ai/chat/route.ts app/api/ai/feedback/route.ts app/api/knowledge/extract/route.ts app/api/knowledge/extract-conversations/route.ts app/(ai)/chat/page.tsx`
- `npm run build`

结论：

当前 AI 客服已具备“可控学习”基础闭环：

1. 用户提问
2. AI 回答并落库
3. 用户点赞/点踩
4. 点踩可补充正确说法
5. 系统生成待审核知识候选
6. 管理员审核通过后进入知识库
7. 后续 AI 检索时可用新知识
