# ECS 部署备份清理记录

日期：2026-09-03

## 处理结果

- 检查 `/opt/aimeng-elisa-web`，确认当前运行目录为 `/opt/aimeng-elisa-web/app`。
- 发现历史 `app.prev.*` 备份 243 个。
- 保留最近 3 天的 10 个备份，删除 233 个更早备份。
- 删除后磁盘可用空间约 50GB，使用率约 12%。
- `aimeng-elisa-web` systemd 服务保持运行，服务器本地访问返回 HTTP 200。

## 后续规则

已在 `scripts/deploy-aliyun.mjs` 中加入部署后清理逻辑：每次部署成功启动服务后，自动删除 3 天以前的 `app.prev.*`，保留短期回滚能力，避免备份无限增长。
