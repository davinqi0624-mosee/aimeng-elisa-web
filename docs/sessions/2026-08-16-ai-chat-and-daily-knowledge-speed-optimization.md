# 2026-08-16 AI 客服与每日知识速度优化

## 背景

用户反馈 AI 客服回复偏慢、每日小知识生成偏慢，询问是否因为 Kimi 生成速度慢，并要求按建议直接优化。

## 发现

- 每日小知识主要使用 Kimi K3 做长文生成，长内容生成天然会比普通聊天慢。
- AI 客服默认走 DeepSeek，但慢点不只在模型本身：
  - 产品、血清、知识库检索原来存在顺序等待，已改为并行。
  - 当前 OpenAI embedding 代理不支持 `text-embedding-3-small`，每次向量检索都会先失败再降级，造成额外等待。
  - DeepSeek `deepseek-v4-flash` 流式接口默认先输出 `reasoning_content`，正文 `content` 要等推理阶段结束后才开始，前端表现为长时间空白。

## 修改

- `lib/ai/llm.ts`
  - 缓存单次调用内的供应商凭据、模型、client 和温度配置，避免重复读取。
  - 对 DeepSeek v4 系列聊天请求加入 `reasoning_effort: 'none'`，减少正文前的推理等待。
  - 保留 Kimi 作为长文、方案、说明书等任务模型。

- `app/api/ai/chat/route.ts`
  - 产品、血清、知识库检索改为并行。
  - 限制聊天上下文引用数量和片段长度，降低提示词体积。
  - 根据聊天模式设置更合理的 `maxTokens`。
  - 空流式片段不再推给前端。
  - 若 embedding 不可用，10 分钟内直接走基础知识库检索，避免每次重复请求失败模型。
  - 增加 `Server-Timing: aimeng-chat-prestream` 便于线上测速。

- `app/api/knowledge/auto-generate/route.ts`
  - 修复未来文章数量判断逻辑。
  - 7 天批量生成改为并发 2 个任务，避免完全串行等待。

- `app/api/knowledge/generate/route.ts`
  - 单篇知识生成 `maxTokens` 从 3000 调整到 1500。

- `app/admin/knowledge/generate/page.tsx`
  - 增加生成耗时显示和等待提示，避免管理员以为页面卡死。

## 验证

- `npm run lint -- lib/ai/llm.ts app/api/ai/chat/route.ts` 通过。
- `npm run build` 通过。
- `npm run deploy:aliyun` 部署成功。
- 线上健康检查通过：23 个页面、4 个 API 全绿。
- 线上 AI 客服 curl 测试：能够持续流式输出正文并正常返回 `done:true`。

## 备注

- 当前 AI 客服测试“小鼠 IL-6”时，模型未匹配到产品库中的小鼠 IL-6，这属于产品数据/检索命中问题，不是本次速度问题。
- 如果后续需要更快，下一步可以按问题类型跳过部分检索，例如纯货号查询只查产品表，不查知识库。
