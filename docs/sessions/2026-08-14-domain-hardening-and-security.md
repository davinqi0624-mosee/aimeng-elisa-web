# 域名切换与安全加固

## 目标

将网站切换到真实域名 `animaluni.com`，并尽量提升站点安全性。

## 已完成

- 域名解析已指向新服务器 `106.14.215.238`
- `animaluni.com` 已启用 HTTPS 证书
- `www.animaluni.com` 已做 301 跳转到主域名
- `http` 已自动跳转到 `https`
- Nginx 增加基础安全头
- Nginx 增加 HSTS
- 管理员登录与注册接口增加限流
- 服务器启用 UFW 防火墙，仅开放 `22/80/443`
- SSH 暴力破解防护启用 fail2ban

## 当前安全状态

- 外网访问入口已收敛到主域名
- HTTPS 可用
- SSH 仅密钥登录，且有 fail2ban 和 UFW 基础防护

## 后续建议

- 接入 Cloudflare WAF / Turnstile
- 如需更强安全，可继续迁移到 Cloudflare Tunnel
- 后台登录可再加验证码和二次验证
