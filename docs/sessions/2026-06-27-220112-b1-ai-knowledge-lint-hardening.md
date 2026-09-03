# B1 AI/知识生成接口巡检

时间：2026-06-27 22:01

## 背景

用户要求继续按 lint 小范围清单推进，优先处理 AI/知识生成接口权限与错误提示。

## 修改

- `app/api/knowledge/evolve/route.ts`
  - 增加管理员或 `CRON_SECRET` 校验，避免公开接口直接触发 AI 进化消耗 token。
  - AI 返回 JSON 解析改为明确类型。
  - catch 错误从 `any` 收窄为 `unknown`。

- `app/api/admin/knowledge/evolve/route.ts`
  - 生成文章结果、AI 草稿解析、错误提示收窄类型。

- `app/api/knowledge/save/route.ts`
  - 保存失败错误收窄，返回稳定中文提示。

- `app/api/ai/test/route.ts`
  - 测试接口错误收窄，开发环境才返回 stack。

- `lib/ai/llm.ts`
  - DeepSeek 错误翻译移除 `any`，兼容不同 OpenAI-compatible provider 的错误结构。

- `app/api/ai/chat/route.ts`
  - 增加产品引用、知识引用、来源引用类型。
  - 清理 AI 客服接口历史 `any`。

## 验证

- `npm exec eslint -- app/api/ai/chat/route.ts app/api/ai/test/route.ts app/api/knowledge/generate/route.ts app/api/knowledge/save/route.ts app/api/knowledge/evolve/route.ts app/api/admin/knowledge/evolve/route.ts app/api/admin/knowledge/seed-missing/route.ts app/admin/knowledge/generate/page.tsx app/admin/knowledge/candidates/page.tsx lib/ai/llm.ts`
- `npm run build`

均通过。
