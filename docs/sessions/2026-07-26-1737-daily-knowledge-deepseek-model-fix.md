# 2026-07-26 每日知识生成 DeepSeek 模型名修复

## 用户反馈

后台「每日知识生成」点击生成文章失败，页面报错：

`The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you passed deepseek-chat.`

## 原因

- `app/api/knowledge/generate/route.ts` 中每日知识生成接口仍然硬编码 `model: 'deepseek-chat'`。
- 站点其他 AI 调用已经使用 `DEEPSEEK_CHAT_MODEL=deepseek-v4-flash`，但每日知识接口没有同步。
- 当前 DeepSeek 兼容接口只接受 `deepseek-v4-pro` 或 `deepseek-v4-flash`，因此拒绝请求。

## 修复

- 修改 `app/api/knowledge/generate/route.ts`。
- 新增 `DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-v4-flash'`。
- 每日知识生成改为使用 `DEEPSEEK_CHAT_MODEL`。
- DeepSeek 地址改为读取 `DEEPSEEK_BASE_URL`，默认 `https://api.deepseek.com`。

## 验证

- `npx eslint app/api/knowledge/generate/route.ts --quiet`
- `npm run build`
- `rg -n "deepseek-chat" app lib scripts` 已无旧模型名
- `npm run deploy:aliyun`
- 线上健康检查通过
