# 2026-07-14 Product Document Upload Failure Hardening

## Context

管理员在产品文档管理中批量上传 101 个说明书 PDF，页面显示：

- 上传成功 88 个
- 失败 13 个
- 批次中已入库并自动匹配 90 个
- 失败提示只显示“上传失败”，无法判断原因

## Root Cause

线上 Nginx 日志显示失败原因不是文件命名问题：

- 2026-07-14 12:14:09 至 12:14:21 出现 11 次 `502 connect() failed`，原因是部署过程中应用服务被停止，上传请求撞上服务重启。
- 2026-07-14 12:15:41 和 12:17:17 出现 2 次 `504 upstream timed out`，原因是个别 PDF 上传耗时超过 Nginx 默认等待时间。
- 11 + 2 = 13，和前台显示失败 13 个一致。

## Changes

- 调整 `scripts/deploy-aliyun.mjs`：先同步到 `app.next`，最后再短暂停服务并切换目录，减少部署期间上传失败概率。
- 调整线上 Nginx：
  - `client_max_body_size 50m`
  - `proxy_connect_timeout 60s`
  - `proxy_send_timeout 300s`
  - `proxy_read_timeout 300s`
- 调整 `next.config.ts`：`proxyClientMaxBodySize` 提升到 `50mb`，让应用层能返回清晰的 20MB PDF 限制错误。
- 优化后台产品文档上传：
  - 单个 PDF 超过 20MB 时前端直接提示文件大小。
  - 502/503 自动重试。
  - 413/502/503/504 显示明确中文原因。
  - 失败列表显示全部失败文件，不再只显示前 5 个。

## Verification

- `npm run build` 通过。
- `npm run deploy:aliyun` 成功。
- 线上健康检查通过。
- Nginx 配置测试通过并已 reload。
