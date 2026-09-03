# 2026-08-04 Supabase 存储配额、文件清理与后台登录诊断

## 当前结论

线上网站服务器正常运行，但 Supabase 项目 `xzttqwcahwkfddzijqiu` 当前被平台限制。

已验证：

- `GET /api/search?q=IL-6` 返回 `500`，错误为 `exceed_storage_size_quota`。
- Supabase REST API 返回 `HTTP 402`。
- Supabase Storage API 返回 `HTTP 402`。
- 网站服务器 `aimeng-elisa-web.service` 处于 active/running。
- 管理员登录需要读取 `admin_accounts`，Supabase 被限制后无法完成账号校验。
- 首页自媒体接口无法读取 `home_media_items`，因此会退回默认内容。

## 本次不执行的操作

在 Supabase 服务恢复前不执行 Storage 删除，也不直接删除数据库记录。否则无法可靠判断：

- 文件是否仍被产品页面、说明书或首页视频引用；
- 删除是否真正完成；
- 是否留下数据库记录或 Storage 孤儿文件。

## 恢复服务后清理顺序

1. 盘点 `product-assets`、`agent-assets`、`page-assets` 中的全部对象、大小、类型和路径。
2. 读取产品、产品图片、产品说明书、首页视频、首页横幅、客服二维码等引用关系。
3. 生成重复/未引用清单，不直接删除。
4. 完全相同内容优先保留仍被正式页面引用的对象。
5. 未引用的临时文件、失败上传文件和重复副本单独列出。
6. 删除前保存清单和审计记录，删除后重新扫描 Storage 与数据库引用。
7. 再验证产品搜索、首页视频和管理员登录。

## 需要项目所有者先完成

请在 Supabase Dashboard 中对该项目执行以下任一操作：

- 升级到能够覆盖当前 Storage 使用量的套餐；或
- 移除 Spend Cap，使项目恢复服务。

完成后刷新 Supabase Dashboard，确认项目不再显示 `exceed_storage_size_quota`，再继续执行清理。

## 2026-08-04 升级后复核

项目所有者已将 Supabase 升级到 Pro。升级后复核结果：

- `HEALTH_BASE_URL=http://106.14.215.238 npm run health` 通过：23 个页面、4 个接口全部正常。
- `GET /api/search?q=IL-6` 返回 HTTP 200，产品搜索已恢复。
- `GET /api/home-media` 返回 HTTP 200，首页媒体已从数据库读取。
- Storage 当前 7114 个对象、37,229,583,724 bytes，约 37.23 GB。
- 清理脚本再次预览结果为 0 个新的高置信度清理候选，未继续删除文件。
- `product_documents` 共 7379 条，其中 7062 条仍为活动记录，317 条为已删除/历史记录。
- 抽查活动说明书 `LV11654`：HTTP 200，`application/pdf`，文件大小约 5 MB。
- 未携带登录会话访问 `/api/admin/me` 和 `/api/admin/dashboard/stats` 返回 HTTP 401，符合后台权限保护预期。
- `npm run health` 和生产构建均通过；本地 `npm run doctor` 的网页部分因未启动本地服务而跳过，但生产构建通过。

当前剩余动作：请管理员在浏览器中退出旧会话后重新登录后台，确认页面可以进入；若仍失败，再收集登录页面的具体提示和浏览器控制台错误进行定点排查。
