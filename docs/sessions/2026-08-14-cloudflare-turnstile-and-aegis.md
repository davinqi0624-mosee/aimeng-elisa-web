# 2026-08-14 Cloudflare / Turnstile / Aegis 安全修缮

## 用户诉求

- 继续修缮阿里云 Aegis 安全 Agent 的失败状态。
- 准备接入 Cloudflare，隐藏源站 IP，并启用 WAF 和 Turnstile。

## Aegis 状态

- `aegis.service` 原先显示 `failed`。
- 检查发现 Aegis 核心进程仍在运行：
  - `/usr/local/aegis/aegis_update/AliYunDunUpdate`
  - `/usr/local/aegis/aegis_client/aegis_12_93/AliYunDun`
  - `/usr/local/aegis/aegis_client/aegis_12_93/AliYunDunMonitor`
- Aegis 漏洞扫描日志仍在更新，说明安全中心 Agent 并非完全失效。
- 已执行 `systemctl reset-failed aegis`，服务状态从 `failed` 清理为 `inactive`，避免后台长期红色失败状态误导。
- 没有强行杀进程或重装，避免误伤阿里云安全中心自保护进程。

## Turnstile 代码准备

- 新增通用组件：
  - `components/security/TurnstileWidget.tsx`
- 新增服务端校验：
  - `lib/security/turnstile.ts`
- 已接入后台登录：
  - `app/admin/login/page.tsx`
  - `app/api/admin/login/route.ts`
- 已接入用户注册：
  - `app/register/page.tsx`
  - `app/api/auth/register/route.ts`
- 采用开关式启用：
  - 没有配置 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `CLOUDFLARE_TURNSTILE_SECRET_KEY` 时，不显示验证码，也不拦截当前功能。
  - 配置后，前端显示 Cloudflare Turnstile，后端调用 Cloudflare `siteverify` 接口校验 token。

## Cloudflare 锁源准备

- 新增脚本：
  - `scripts/lock-origin-to-cloudflare.sh`
- 已同步到服务器：
  - `/opt/aimeng-elisa-web/scripts/lock-origin-to-cloudflare.sh`
- 已执行 dry-run，确认能拉取 Cloudflare IPv4/IPv6 地址段并生成 UFW 规则。
- 该脚本尚未正式执行，必须等 `animaluni.com` 和 `www.animaluni.com` 在 Cloudflare 中变成 Proxied 后再执行：
  - `/opt/aimeng-elisa-web/scripts/lock-origin-to-cloudflare.sh --apply`

## 用户需要做的 Cloudflare 操作

1. 注册或登录 Cloudflare。
2. Add a site：添加 `animaluni.com`。
3. 选择 Free 免费套餐即可。
4. Cloudflare 扫描 DNS 后，确认至少有：
   - `animaluni.com` / `@` 指向 `106.14.215.238`
   - `www` 指向 `106.14.215.238` 或 CNAME 到 `animaluni.com`
5. 把 `@` 和 `www` 都设置成橙色云 `Proxied`。
6. 按 Cloudflare 提示，去阿里云域名控制台把 NS 服务器换成 Cloudflare 给出的两个 nameserver。
7. 等 Cloudflare 显示站点 Active 后，再执行锁源和 Turnstile 密钥配置。

## 后续待执行

- 用户提供或截图 Cloudflare 的 Turnstile：
  - Site Key
  - Secret Key
- 写入服务器环境文件 `/etc/aimeng-elisa-web/aimeng-elisa-web.env`。
- 重新部署网站。
- 检查后台登录页和注册页验证码显示与服务端验证。
- Cloudflare Active 且 DNS Proxied 后，执行服务器锁源脚本。
- 在 Cloudflare WAF 中增加基础规则：
  - `/admin*` 提高安全等级或 Managed Challenge。
  - `/api/admin/*` 阻挡异常国家/地区和高风险请求。
  - 登录、注册、上传等路径增加速率限制。

## 验证

- `npm exec eslint -- components/security/TurnstileWidget.tsx lib/security/turnstile.ts app/admin/login/page.tsx app/api/admin/login/route.ts app/register/page.tsx app/api/auth/register/route.ts` 通过。
- `npm run build` 通过。
- `npm run deploy:aliyun` 已部署。
- 正式域名健康检查通过：
  - 23 个页面
  - 4 个 API
- 线上 `/admin/login` 和 `/register` 在未配置 Cloudflare key 时未加载 Turnstile 脚本，当前功能不受影响。
