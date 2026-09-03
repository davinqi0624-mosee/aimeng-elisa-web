# 后台基础操作巡检：登录态、管理员管理、部署脚本

## 本轮范围

按约定从第 1 项“后台基础操作”开始巡检：

- 登录态与管理员 Cookie
- 管理员列表/新增/编辑/禁用的接口边界
- 修改密码入口
- 后台敏感知识接口鉴权
- 云端部署流程稳定性

## 发现的问题

1. 管理员 Cookie 原来只校验 token 签名，不会每次回查数据库。
   - 风险：管理员被禁用或降级后，旧登录态可能继续使用旧角色。

2. `/api/admin/accounts` 的 GET 只要求登录，没有限制为超级管理员。
   - 风险：普通管理员也可能读取管理员账号列表。

3. `/api/admin/knowledge/evolve` 和 `/api/admin/knowledge/seed-missing` 缺少后台鉴权。
   - 风险：未登录请求可能触发后台知识生成/写库。

4. 修改密码页面存在，但后台侧边栏没有明显入口。
   - 体验问题：管理员需要手输地址或依赖浏览器密码管理器入口。

5. 云端部署此前容易漏同步 `.next/static` 和 `public`。
   - 风险：页面 HTML 正常，但 CSS/JS/图片 404，页面退化成原始蓝色链接。

## 已修复

- 修改 `lib/admin/auth.ts`
  - `getCurrentAdmin` / `requireAdminSession` 在 token 校验后，会回查 `admin_accounts`。
  - 账号不存在、被禁用、角色异常时，返回 401 并要求重新登录。
  - 角色以数据库最新值为准，避免旧 token 持续保留旧权限。

- 修改 `app/api/admin/accounts/route.ts`
  - 管理员账号列表改为仅超级管理员可访问。
  - 继续保留管理员编辑能力：用户名、显示名、角色、权限、可选重置密码。

- 修改 `app/api/admin/knowledge/evolve/route.ts`
  - 手动触发必须是超级管理员。
  - 如未来配置 `CRON_SECRET`，可用 `x-cron-secret` 给定时任务使用。

- 修改 `app/api/admin/knowledge/seed-missing/route.ts`
  - 补充超级管理员鉴权。

- 修改 `app/admin/layout.tsx`
  - 侧边栏和移动菜单增加“修改密码”入口。

- 新增 `scripts/deploy-aliyun.mjs`
  - 固化阿里云部署流程：构建、同步 standalone、同步 `.next/static`、同步 `public`、切换版本、启动服务、健康检查。

- 修改 `package.json`
  - 新增 `npm run deploy:aliyun`。

## 验证

- `npm run deploy:aliyun` 成功。
- 云端 `aimeng-elisa-web.service` 正常运行。
- 云端健康检查通过：22 个页面 + 4 个 API。
- `/admin/admins` 返回 200。
- 后台 CSS 静态资源返回 200。
- 未登录访问 `/api/admin/accounts` 返回 401。
- 未登录访问 `/api/admin/knowledge/evolve` 返回 401。
- 未登录访问 `/api/admin/knowledge/seed-missing` 返回 401。
- 使用签名格式正确但数据库不存在的伪造管理员 Cookie 访问 `/api/admin/accounts` 返回 401。

## 下一步

继续第 1 项后台基础操作里剩余栏目：

- 后台商品管理/血清产品/说明书生成/批量导入记录的保存、删除、上传、错误提示
- 后台积分商城、文献审核、首页广告位的表单体验和接口保护
