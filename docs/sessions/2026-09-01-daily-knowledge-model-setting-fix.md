# 每日知识模型设置修复

日期：2026-09-01

## 问题

后台 AI 模型设置中，“每日知识 / 长文总结”已经选择 DeepSeek，但“每日知识生成”页面在生成时仍显示“Kimi 正在生成文章”。

## 原因

每日知识生成接口原本已经通过 `chatCompletion(..., { task: 'longform' })` 读取长文任务模型设置，实际路由并不是固定 Kimi；但后台每日知识页面的加载按钮文案被写死为 Kimi，因此页面提示与实际模型不一致。

此外，备用模型自动切换开启时，如果 DeepSeek 失败、超时或额度不足，系统会按策略切换到 Kimi。此前生成结果没有返回实际使用的供应商，无法直观看出是否发生了备用切换。

## 修改

- `app/admin/knowledge/generate/page.tsx`
  - 加载 AI 模型设置中的 `longform_provider`。
  - 生成中动态显示 DeepSeek 或 Kimi K3。
  - 生成成功后显示本次实际使用的供应商和模型。
  - 如果触发备用模型，明确显示“主模型失败后切换了备用模型”。
- `app/api/knowledge/generate/route.ts`
  - 每次生成前刷新长文模型设置，避免短缓存导致刚保存的设置未及时生效。
  - 显式使用长文任务选择的供应商。
  - 返回实际使用的供应商、模型和是否发生备用切换。
- `app/api/knowledge/auto-generate/route.ts`
  - 自动生成任务同样读取长文模型设置，并显式传入选择的供应商。
- `lib/ai/llm.ts`
  - 增加 `onProviderUsed` 回调，记录非流式、流式兜底和备用模型最终成功的实际供应商与模型。

## 四项任务路由补强

为避免其他应用漏传任务类型，已进一步显式绑定：

- AI 客服日常回答 -> `chat`
- 每日知识、知识提取、文章进化、长文总结 -> `longform`
- 实验方案生成 -> `protocol`
- 说明书生成/总结、指标简介和性能候选 -> `datasheet`

实验方案和说明书接口也会返回本次实际使用的供应商、模型及是否触发备用切换；客服流式响应会携带同样的模型信息。

后台设置页底部现在同时显示四项当前配置，选择后点击“保存 AI 模型设置”即可生效。

## 补充验证

- 四项路由相关文件定向 ESLint：通过。
- TypeScript：通过。
- `git diff --check`：通过。
- 再次执行 `npm run deploy:aliyun`：部署成功。
- 线上健康检查：23 个页面、4 个 API 全部通过。

## 验证

- 定向 ESLint：通过。
- TypeScript：通过。
- `npm run build`：通过，181 个页面生成成功。
- `npm run deploy:aliyun`：部署成功。
- 线上服务：`aimeng-elisa-web.service` active (running)。
- `https://animaluni.com` 健康检查：23 个页面、4 个 API 全部通过。

## 使用说明

重新打开或刷新“每日知识生成”页面后，点击生成：

- 后台设置为 DeepSeek 且调用成功：显示“DeepSeek 正在生成文章”。
- 后台设置为 Kimi：显示“Kimi K3 正在生成文章”。
- DeepSeek 失败且备用模型开启：结果中会显示实际切换到的模型。
