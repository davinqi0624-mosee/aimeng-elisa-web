# AI 客服反馈学习闭环修复

时间：2026-07-10 20:39 CST

## 问题

- 前台点赞/点踩后，后台“知识候选审核”看不到记录。
- 前台提示“这条回答还在保存中”，说明回答消息没有绑定到 `conversationId`。
- AI 客服同类咨询回复差异偏大，缺少稳定的业务服务骨架。

## 根因

- 线上 `ai_conversations.user_id` 实际为 UUID 类型，代码写入了 `session_xxx`、`feedback_fallback` 这类文本，导致对话初始化失败。
- 前台反馈逻辑过度依赖 `conversationId`，没有 ID 时直接停止提交。
- 提示词已有“不强行拉回 ELISA”的规则，但没有固定要求每次咨询都覆盖背景追问、产品详情、试用装和人工客服下一步。

## 修复

- `app/api/ai/chat/route.ts`
  - 对话记录写入时不再向 `user_id` 塞文本，改为 `null`，兼容线上 UUID 字段。
  - SSE 流中返回 `sourceType`。
  - 将模型温度从 `0.7` 降到 `0.5`。
  - 增加“稳定服务骨架”：先回答当前问题，再追问关键背景，引导产品详情、10ml 试用装/试用申请、人工客服确认。

- `app/api/ai/feedback/route.ts`
  - 支持无 `conversationId` 的兜底反馈写入：前台传问题和回答，接口自动补建 `ai_conversations`。
  - 点踩一定生成后台待审核候选。
  - 点赞也生成“优质回答候选”，便于管理员审核后沉淀为知识库或标准话术。

- `app/(ai)/chat/page.tsx`
  - 每条 AI 回答保存对应的用户问题。
  - 反馈提交时带上问题、回答正文和来源类型。
  - 没有 `conversationId` 时不再提前终止，改走后端兜底写入。
  - 解析 SSE 结束缓冲，减少最后事件丢失造成的 ID 缺失。

## 验证

- 本地 `npm run build` 通过。
- 本地无 `conversationId` 反馈测试成功生成 `conversationId` 和 `candidateId`，测试记录已删除。
- 已部署至 `http://106.14.215.238`。
- 线上健康检查通过。
- 线上无 `conversationId` 反馈测试成功生成候选，测试记录已删除。
- 线上 `/api/ai/chat` 测试确认可返回 `conversationId`，测试记录已删除。
