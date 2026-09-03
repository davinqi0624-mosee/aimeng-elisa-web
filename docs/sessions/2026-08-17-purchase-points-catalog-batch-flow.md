# 2026-08-17 购买积分申请改为货号批号凭证

## 背景

客户侧“积分码”规则增加了操作负担。新的购买积分申请流程改为以产品货号、批号和商品照片作为主凭证，后台人工审核后发放积分。

## 本次调整

- 前台 `/member/purchase-points` 移除客户填写积分码入口。
- 前台申请改为必填产品货号、批号，并上传 1-3 张商品照片。
- 申请接口 `/api/purchase-points/claims` 不再校验 `purchase_point_codes`。
- 新申请会生成内部 `CATBATCH:{货号}:{批号}` 凭证，继续写入旧 `point_code` 字段用于唯一性和兼容历史数据。
- 后台 `/admin/purchase-points` 审核主流程改为查看货号、批号、照片和重复风险。
- 后台审核接口允许 `point_code_id = null` 的新流程申请通过；历史积分码申请仍保持原锁码逻辑。
- 增加迁移 `064_purchase_point_claims_catalog_batch_credentials.sql`，更新数据库注释并为货号/批号查询增加索引。

## 验证

- `npm run lint -- app/api/purchase-points/claims/route.ts app/api/admin/purchase-points/claims/route.ts app/'(user)'/member/purchase-points/page.tsx app/admin/purchase-points/page.tsx`
- `npm run build`
- `npm run deploy:aliyun`
- 线上健康检查通过：`https://animaluni.com`
- `https://animaluni.com/member/purchase-points` 返回 200。
- 未登录请求 `https://animaluni.com/api/purchase-points/claims` 返回 401。
- `https://animaluni.com/admin/purchase-points` 未登录时跳转后台登录页。

## 待执行数据库 SQL

当前没有数据库直连串，迁移文件已加入代码库，但尚未直接推送到 Supabase。该迁移只包含索引和注释，不影响新流程运行。
