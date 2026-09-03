# AI 客服异议纠错学习闭环

时间：2026-07-10

背景：

客户通常不会主动花时间为 AI 客服纠错或补充知识。更合理的机制是：客户在正常对话中表达异议、补充专业看法或指出遗漏时，系统自动识别并沉淀为“知识候选”，再由管理员审核后进入正式知识库。

本轮处理：

- `app/api/ai/chat/route.ts`
  - AI 开始输出前先创建 `ai_conversations` 学习记录，前端可以立即拿到 `conversationId`。
  - AI 输出结束后再补全回答内容，避免点赞/点踩时出现“回答还在保存中”的高频提示。
  - 如果线上旧表暂时缺少 `source_type` 或 `products_referenced` 字段，自动降级为基础字段写入，避免整条学习记录失败。
  - 新增客户异议/补充识别逻辑。
  - 当用户上一轮是在回应 AI 回答，并出现“没提到、补充、建议、应该、不准确、不一致、纠正”等信号时，系统自动生成一条 `knowledge_candidates`。
  - 候选来源标记为 `source_type = ai_objection`。
  - 候选内容保留完整审核上下文：
    - 原始问题
    - AI 原回答
    - 客户提出的异议或补充
    - AI 修正后的回复
    - 审核建议
  - 只进入后台待审核，不直接进入正式知识库。
  - 审核通过后，后续类似问题可通过知识库检索优先引用。

- `app/api/ai/feedback/route.ts`
  - 点踩即生成后台待审核候选，即使客户没有填写纠正内容。
  - 未填写纠正时，候选标记为“回答复核”，提醒管理员检查是否存在错误、遗漏或话术问题。
  - 客户后续填写纠正时，更新同一条候选，避免重复候选。
  - 如果线上旧表暂时缺少 `source_type`，反馈接口会降级查询基础字段，保证候选仍可生成。

- `app/api/admin/knowledge/candidates/route.ts`
  - 后台知识候选审核改用 service role 客户端读取/写入，避免 RLS 策略导致“数据库有候选但后台看不到”。
  - 审核通过/拒绝/合并不再写入指向 `auth.users` 的 `reviewer_id`，避免当前后台账号体系使用 `admin_accounts` 时出现外键不匹配。

- `supabase/migrations/047_ai_learning_schema_repair.sql`
  - 修复线上旧版 `ai_conversations` 缺字段问题。
  - 补齐 `source_type`、`products_referenced`、`feedback_note`、`feedback_at`、`extracted_at` 等字段。
  - 确保 `knowledge_candidates` 必要字段和索引存在。
  - 执行 `NOTIFY pgrst, 'reload schema'` 刷新 Supabase schema cache。

- `app/(ai)/chat/page.tsx`
  - 底部提示改为“AI 会自动沉淀有价值的客户异议和专业补充；点赞/点踩只是帮助后台更快判断优先级。”
  - 当回答还没保存完成时，反馈提示改为：系统也会自动识别有价值的异议和补充进入后台待审核。
  - 点赞/点踩选中后使用不同颜色高亮，提升点击反馈。
  - 前端在流式回答过程中即可接收 `conversationId`，减少反馈绑定失败。

闭环逻辑：

1. 客户正常咨询。
2. AI 客服回答。
3. 客户提出不满意、补充或专业异议。
4. AI 客服继续回复。
5. 系统自动生成知识候选。
6. 管理员在后台“知识候选审核”中审核。
7. 审核通过后进入正式知识库。
8. 后续类似问题优先引用正式知识库内容。

验证：

- `npm exec eslint -- app/api/ai/chat/route.ts app/'(ai)'/chat/page.tsx`
- `npm exec eslint -- app/api/ai/chat/route.ts app/api/ai/feedback/route.ts app/'(ai)'/chat/page.tsx`
- `npm exec eslint -- app/api/ai/chat/route.ts app/api/ai/feedback/route.ts app/api/admin/knowledge/candidates/route.ts`
- `npm run build`

结论：

AI 客服已具备“客户异议驱动”的纠错学习闭环雏形。客户不需要专门帮网站纠错；系统会从真实问答中自动捕捉可沉淀知识点，并交由管理员把关。
