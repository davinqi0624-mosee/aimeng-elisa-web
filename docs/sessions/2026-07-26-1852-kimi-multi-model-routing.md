# 2026-07-26 Kimi K3 多模型路由接入

## 背景

用户决定不把全站直接切换成 Kimi K3，而是采用“多模型备用 / 分任务调用”：

- AI 客服日常回答：DeepSeek 优先。
- 每日知识、实验方案、长说明书生成：Kimi K3 优先。
- 主模型失败、额度不足或超时时：自动切到备用模型。
- 后台增加“AI 模型设置”，后续可切换不同任务的默认模型。

## 改动

- 新增 `lib/ai/model-settings.ts`
  - 统一 AI 路由策略。
  - 默认策略可由环境变量控制。
  - 优先读取 `site_settings.ai_models`，读取失败时自动回退环境变量默认值。
  - 只保存模型供应商选择，不保存 API Key。

- 更新 `lib/ai/llm.ts`
  - 支持 `deepseek` / `kimi` 两个 provider。
  - 支持 `chat` / `longform` / `protocol` / `datasheet` 任务路由。
  - 支持自动备用模型。
  - Kimi K3 自动使用 `temperature=1`，避免接口报错。
  - 增加 45 秒硬超时，Kimi K3 过慢时自动回退 DeepSeek。

- 新增 `app/api/admin/ai-model-settings/route.ts`
  - 后台读取 / 保存 AI 模型路由设置。
  - 返回 DeepSeek / Kimi 的 Key 配置状态，但不返回密钥内容。

- 更新后台设置页 `app/admin/settings/page.tsx`
  - 新增“AI 模型设置”面板。
  - 可分别设置客服、长文、实验方案、说明书生成任务的优先模型。
  - 可开启 / 关闭备用模型自动切换。

- 更新健康检查 `app/api/admin/maintenance/health/route.ts`
  - 分别检查 DeepSeek 和 Kimi。
  - 显示当前模型路由策略。

- 新增迁移 `supabase/migrations/055_ai_model_settings.sql`
  - 为 `site_settings` 增加 `ai_models JSONB`。

## 线上环境

已在服务器 `/etc/aimeng-elisa-web/aimeng-elisa-web.env` 增加：

- `KIMI_API_KEY`
- `KIMI_BASE_URL`
- `KIMI_CHAT_MODEL`
- `AI_DEFAULT_CHAT_PROVIDER`
- `AI_LONGFORM_PROVIDER`
- `AI_PROTOCOL_PROVIDER`
- `AI_DATASHEET_PROVIDER`
- `AI_ENABLE_KIMI_FALLBACK`

密钥只写入服务器环境变量，没有写入代码仓库。

## 数据库迁移状态

本机 Supabase CLI 未登录、项目未 link，且项目没有数据库直连串，无法由 Codex 自动执行 `055_ai_model_settings.sql`。

当前线上代码已兼容未执行迁移的状态：

- 运行时按环境变量默认策略生效。
- 后台读取设置可显示默认策略。
- 如需在后台保存切换后的模型设置，需要先在 Supabase SQL Editor 执行 `supabase/migrations/055_ai_model_settings.sql`。

## 验证

- `npx eslint ... --quiet`：通过。
- `npm run build`：通过。
- `npm run deploy:aliyun`：部署成功。
- 线上健康检查：通过。
- `GET /api/ai/test`：
  - `success: true`
  - DeepSeek Key 已配置。
  - Kimi Key 已配置。
  - 当前策略：客服 DeepSeek，长文 / 实验方案 / 说明书 Kimi，备用开启。
- `POST /api/experiment/generate`：
  - 成功返回实验方案。
  - 验证 Kimi 慢时可自动兜底，不再导致网页一直等待。
