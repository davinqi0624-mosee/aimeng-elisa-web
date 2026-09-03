# 2026-08-04 Supabase 国内迁移可行性评估

## 当前网站对 Supabase 的依赖

- PostgreSQL 数据库：产品、文档、批次、知识、文献、积分等业务表。
- Supabase Auth：普通用户登录、`auth.users` 外键、`auth.uid()` RLS。
- Supabase Storage：产品说明书、图片、视频、客服二维码、模板和文献附件。
- Supabase Storage 公共 URL：部分 URL 已写入业务表。
- pgvector：RAG 知识检索相关向量字段。
- 管理员账号虽然使用网站自己的 JWT，但 `admin_accounts` 仍存储在 Supabase 数据库中。

## 推荐国内架构

当前网站服务器已经在阿里云，因此优先推荐：

- 阿里云 RDS PostgreSQL：业务数据库。
- 阿里云 OSS：PDF、视频、图片和附件。
- 现有阿里云 ECS：继续运行 Next.js 网站。
- 可选 CDN：只给前台公开图片、视频和说明书加速。
- RAM 最小权限、跨可用区/定时备份和对象生命周期规则。

腾讯云 TencentDB PostgreSQL + COS 也可以，华为云 RDS PostgreSQL + OBS 也可以，但跨云迁移会增加网络、账号和运维复杂度。

## 迁移影响

### 容易迁移

- 普通 PostgreSQL 表和索引。
- 产品、说明书、视频元数据。
- 管理员账号的 bcrypt 密码哈希和网站 JWT 逻辑。

### 需要改造

- Supabase Auth 需要替换为网站自建认证或国内认证服务；现有用户会话不能直接沿用。
- Storage 公共 URL 需要全部改为 OSS URL，并更新产品、文档、视频等表。
- `auth.uid()`、RLS 策略、Auth 触发器需要改为网站用户 ID 和数据库权限逻辑。
- RAG 的 pgvector 需要确认国内数据库扩展支持，或改为独立向量服务。
- 所有直接调用 Supabase JS/Storage 的代码需要收敛到统一适配层。

## 建议顺序

1. 先升级 Supabase Pro，恢复现有网站。
2. 盘点并清理重复 PDF、视频和未引用文件。
3. 将数据库访问、文件存储、用户认证封装成可替换接口。
4. 在阿里云新建 RDS + OSS，导入测试副本。
5. 用测试域名验证登录、搜索、说明书下载、视频播放和 AI 功能。
6. 确认无误后再切换生产环境，保留 Supabase 一段时间作为回退源。

## 初步判断

按约 4000 份、每份约 8MB 的说明书估算，文件本体约 32GB；Pro 截图中显示包含 100GB file storage，短期大概率够用。实际用量仍需 Supabase 恢复后扫描确认，不能仅按文件数量做最终判断。
