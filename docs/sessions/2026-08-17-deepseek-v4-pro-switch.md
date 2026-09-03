# 2026-08-17 DeepSeek 模型切换为 v4 Pro

## 背景

用户希望将网站当前接入的 `deepseek-v4-flash` 切换为 `deepseek-v4-pro`，API Key 已接入，不需要更换。

## 操作

- 读取 `site_settings.ai_provider_secrets.deepseek` 当前配置：
  - Base URL: `https://api.deepseek.com`
  - Model: `deepseek-v4-flash`
  - Key 已加密保存，仅确认尾号，不读取明文。
- 仅更新模型名为 `deepseek-v4-pro`。
- 保持 DeepSeek API Key 与 Base URL 不变。

## 验证

- 数据库配置确认：DeepSeek model 已为 `deepseek-v4-pro`。
- 线上 AI 客服测试：`ELISA标准曲线R2偏低，常见原因有哪些？`
  - 接口返回 200。
  - 流式输出正常。
  - 无错误事件。
  - 返回 `done:true`。

## 备注

- 本次是配置更新，不需要重新部署代码。
- 服务端 AI 配置有约 30 秒内存缓存，等待缓存过期后已确认新模型生效。
