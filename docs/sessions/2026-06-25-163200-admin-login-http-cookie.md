# 后台管理员登录失败修复

## 问题

用户反馈用管理员身份登录后台登不上去。云服务器页面本身可访问，`/admin/login` 和 `/admin` 均返回 200。

## 原因

当前阿里云测试地址使用 `http://106.14.215.238`，不是 HTTPS。后台登录 Cookie 原逻辑在生产环境总是设置 `secure: true`，浏览器在 HTTP 访问下不会保存 `Secure` Cookie。

结果表现为：账号密码校验可能成功，但跳转后台后 `/api/admin/me` 读不到登录 Cookie，于是又被判断为未登录。

日志中同时出现过 `Failed to find Server Action "x"`，这是旧页面/旧脚本和新部署版本不一致时常见的浏览器缓存问题，建议用户登录前强制刷新页面。

## 修改

- 修改 `lib/admin/auth.ts`
  - 新增 `ADMIN_COOKIE_SECURE` 环境变量开关。
  - `ADMIN_COOKIE_SECURE=false` 时，后台 Cookie 不带 `Secure`，允许当前 HTTP IP 测试环境保存登录态。
  - `ADMIN_COOKIE_SECURE=true` 时强制 HTTPS 安全 Cookie。
  - 未设置时保持原生产环境默认安全策略。

- 修改 `project-materials/07-deployment-and-migration/env-vars.md`
  - 补充 `ADMIN_COOKIE_SECURE` 的使用说明。

- 云服务器 `/etc/aimeng-elisa-web/aimeng-elisa-web.env` 已加入：
  - `ADMIN_COOKIE_SECURE=false`

## 验证

- `npm run build` 通过。
- 已部署到云服务器并重启 `aimeng-elisa-web.service`。
- `curl -I http://106.14.215.238/admin/login` 返回 200。
- `/api/admin/login` 假账号测试返回清晰的 `401 用户名或密码错误`，说明接口正常响应。
- `HEALTH_BASE_URL=http://106.14.215.238 npm run health` 通过。

## 后续

正式域名启用 HTTPS 后，应将 `ADMIN_COOKIE_SECURE=true`，或删除该变量让生产环境默认启用安全 Cookie。
