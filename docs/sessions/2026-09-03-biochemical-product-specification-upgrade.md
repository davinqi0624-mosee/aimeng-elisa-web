# 2026-09-03 生化法试剂盒规格与价格升级

## 需求

- 后台规格不能固定为 96T。
- 生化产品可能只有 96T，也可能同时有 48T 和 96T。
- 后台价格全部由管理人员手动输入，不使用价格下拉菜单。
- 前台按客户选择的规格显示对应价格。
- 生化产品与 ELISA 产品完全分开，不能出现在 ELISA 搜索中。

## 已完成

- 生化产品表升级为 `specifications`、`price_96t`、`price_48t`。
- 规则为 96T 必选，48T 可选；选择 48T 时必须填写 48T 价格。
- 后台 `/admin/biochemical-products`：
  - 96T 为必选规格。
  - 48T 为可选规格。
  - 96T/48T 价格均为数字手动输入。
  - 支持编辑、发布、草稿、归档、重复货号保护。
- 前台 `/products/biochemical-reagents`：
  - 生化产品独立检索。
  - 展示货号、指标名称、规格、操作波长。
  - 规格使用下拉选择，价格随规格变化。
- ELISA 搜索页面和 `/api/search` 增加早期生化误录产品排除条件，不再把标记为生化的旧产品混入 ELISA 结果。
- 新增兼容迁移 `supabase/migrations/070_biochemical_product_specifications.sql`。
- 已部署到 `https://animaluni.com`，构建、TypeScript、ESLint、健康检查均通过。

## 数据库执行方式

- 尚未执行任何 069：执行新版 `supabase/migrations/069_biochemical_products.sql`。
- 已执行旧版 069：执行 `supabase/migrations/070_biochemical_product_specifications.sql`。
- 如果不确定执行过哪个版本，可以先执行新版 069，再执行 070；迁移均使用 `IF NOT EXISTS`，但生产执行前仍建议在 Supabase SQL Editor 查看表结构。

## 页面地址

- 后台：`https://animaluni.com/admin/biochemical-products`
- 前台：`https://animaluni.com/products/biochemical-reagents`
