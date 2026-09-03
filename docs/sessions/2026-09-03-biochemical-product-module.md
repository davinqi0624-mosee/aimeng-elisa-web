# 2026-09-03 生化法试剂盒独立产品模块

## 需求

生化法试剂盒与 ELISA 试剂盒字段和价格规则不同，生化产品主要维护：

- 货号
- 指标名称
- 规格（固定 96T）
- 检测波长
- 单盒价格

## 已完成

- 新增独立迁移 `supabase/migrations/069_biochemical_products.sql`，创建 `biochemical_products` 表。
- 新增公开接口 `app/api/biochemical-products/route.ts`，前台只读取 `active` 产品。
- 新增管理员接口 `app/api/admin/biochemical-products/route.ts`，支持新增、编辑、发布/草稿、归档和重复货号保护。
- 新增后台页面 `/admin/biochemical-products`，侧边栏已加入“生化法试剂盒”。
- 更新前台 `/products/biochemical-reagents` 的检索窗口，按货号、指标名称和波长搜索，显示 96T 与生化产品价格。
- 价格录入使用预设下拉菜单，并保留自定义价格选项。
- 生化表单不再出现 ELISA 的 48T、灵敏度、检测范围等字段。

## 验证

- ESLint 通过。
- `tsc --noEmit` 通过。
- `npm run build` 通过，已生成后台新路由与 API 路由。
- 已部署到 `https://animaluni.com`。
- 线上健康检查通过。
- 线上公开接口当前返回 `needsSetup: true`，说明代码已生效，但生产 Supabase 尚未执行 069 迁移。

## 需要管理员执行

如果之前还没有执行过 069，在 Supabase SQL Editor 执行：

`supabase/migrations/069_biochemical_products.sql`

如果之前已经执行过旧版 069，再继续执行：

`supabase/migrations/070_biochemical_product_specifications.sql`

执行成功后：

1. 打开 `https://animaluni.com/admin/biochemical-products`。
2. 点击“新增生化产品”。
3. 逐个填写货号、指标名称、波长和 96T 价格。
4. 状态选择“发布”后，产品会出现在 `https://animaluni.com/products/biochemical-reagents` 的前台检索窗口。

## 设计边界

本版本暂不把说明书、图片和 ELISA 产品字段复制到生化表中，避免再次发生产品类型混用。后续如果生化产品需要独立说明书或图片，可在该独立表上增加对应关联，不影响现有 ELISA 数据。
