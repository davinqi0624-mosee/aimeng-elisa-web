# 后台基础操作巡检第二轮

时间：2026-06-26 22:45 CST

## 本轮范围

- 商品管理：列表读取、搜索分页、保存、删除、批量导入。
- 积分商城后台：奖品保存、删除、图片上传提示。
- 通用后台上传：后台各模块使用的 Storage bucket 白名单。
- 仪表盘存储清理：避免误删新模块正在使用的文件。
- 文献引用审核：审核通过发放积分的错误处理、列表加载失败提示。
- 首页广告位：数据库未初始化时的中文提示。

## 已修复

1. `app/admin/products/page.tsx`
   - 商品管理列表不再用浏览器匿名 Supabase key 直连数据库。
   - 改为调用 `/api/admin/products?page=&pageSize=&search=`，后台读取不再受公开 RLS/匿名策略影响。

2. `app/api/admin/products/route.ts`
   - GET 增加后台搜索、分页、总数返回。
   - POST/PUT/DELETE 改为服务端 `createAdminClient()`。
   - PUT 遇到不存在的商品 ID 时返回明确的“商品不存在或已被删除”。

3. `app/api/admin/products/bulk-import/route.ts`
   - 批量导入改为服务端 admin client，减少批量导入受 RLS 影响的风险。

4. `app/admin/shop/page.tsx`
   - 保存失败时显示后端真实错误。
   - 删除失败时显示错误。
   - 积分和库存增加前端校验。
   - 图片上传支持 WebP。

5. `app/api/admin/shop/route.ts`
   - 改为服务端 admin client。
   - 积分必须大于 0，库存不能小于 0。
   - 名称做 trim 校验。

6. `app/api/admin/upload/route.ts`
   - bucket 白名单补充 `agent-assets`、`page-assets`。
   - 修复代理商管理上传二维码/图片可能被“桶不允许”拒绝的问题。

7. `app/api/admin/storage-cleanup/route.ts`
   - 存储清理加入 `home_banners.image_url`、`serum_products.image_url`、`serum_coa_documents.file_url`。
   - 避免后续点击“清理未引用文件”时误删首页广告图、血清产品图和 COA 文件。

8. `app/api/admin/citations/route.ts`
   - 审核通过前必须读取到提交用户。
   - 检查积分流水写入错误和用户积分更新错误，避免“文献已通过但积分未成功发放”。

9. `app/admin/citations/page.tsx`
   - 文献审核列表加载失败时显示明确红色错误，不再静默显示 0 篇。

10. `app/api/admin/home-banners/route.ts`
    - `home_banners` 表未创建时返回中文迁移提示：执行 `supabase/migrations/031_home_banners.sql`。

## 验证

- 本地 `npm run build` 通过。
- `npm run deploy:aliyun` 部署成功。
- 云服务器 `aimeng-elisa-web.service` 状态：active。
- 健康检查通过：22 个页面、4 个 API。
- 云端后台页面抽查：
  - `/admin/products` 200
  - `/admin/shop` 200
  - `/admin/citations` 200
  - `/admin/home-banners` 200
  - `/admin/datasheet` 200
- 云端后台 API 未登录鉴权抽查：
  - `/api/admin/products?page=0&pageSize=10` 401
  - `/api/admin/shop` 401
  - `/api/admin/citations` 401
  - `/api/admin/home-banners` 401

## 已知遗留

- `npm run lint` 仍有大量历史 lint 问题，主要集中在旧页面的 `any`、React 纯函数规则、未使用变量等。本轮构建通过，未将全站 lint 债务纳入修复范围。
- 文献审核的积分发放仍不是数据库事务函数。现在已经避免“未检查错误”，但未来最好做成 Supabase RPC 事务，让“积分流水、用户余额、文献状态”三者原子提交。

## 下一步建议

继续按顺序巡检后台基础操作剩余栏目：

- 代理商管理
- 订单管理
- 用户管理
- 运维中心
- 每日知识生成
- Agent 中台
