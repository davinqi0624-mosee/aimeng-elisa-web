# C3 商品详情字段闭环巡检

时间：2026-06-28 07:30

## 背景

继续产品与搜索前台 C3 巡检，重点检查普通 ELISA 商品后台编辑字段、批量导入字段、API 保存字段和前台详情页展示字段是否一致。

## 发现

- 商品详情页展示依赖 `description`、`detection_method`、`sample_types` / `sample_type` 等字段，但后台普通商品编辑和批量导入没有稳定维护这些字段。
- 管理员即使在表格里整理了产品介绍、检测方法、样本类型，也可能出现保存后前台不展示的隐形问题。
- 旧数据里的样本类型可能是文本、数组或 JSON 数组字符串，前台直接传递有展示异常风险。

## 修改

- 新增 `supabase/migrations/044_product_frontend_detail_fields.sql`
  - 确保 `products.description`
  - 确保 `products.detection_method`
  - 确保 `products.sample_types_text`
  - 为检测方法补默认值。

- `app/admin/products/page.tsx`
  - 商品编辑弹窗增加“检测方法 / 样本类型 / 产品介绍”。
  - 创建商品时提供更贴近 ELISA 的默认检测方法和样本类型。
  - Excel / CSV 批量导入支持以上字段和中文表头别名。

- `app/api/admin/products/route.ts`
  - 创建和更新商品时保存以上字段。
  - 数据库迁移未执行时保留 fallback，避免线上 API 因缺列直接崩溃。

- `app/api/admin/products/bulk-import/route.ts`
  - 批量导入保存以上字段。
  - 收窄导入行类型并整理字段剥离重试逻辑。

- `app/(shop)/products/[slug]/page.tsx`
  - 前台详情页把检测方法、样本类型传给信息卡和产品详情折叠区。
  - 增加样本类型规范化，兼容文本、数组和 JSON 数组字符串。

## 验证

- scoped lint 通过。
- `npm run build` 通过。

## 待执行

需要在 Supabase SQL Editor 执行：

`supabase/migrations/044_product_frontend_detail_fields.sql`

执行前代码不会崩溃，但“产品介绍 / 检测方法 / 样本类型”无法真正保存到生产数据库。
