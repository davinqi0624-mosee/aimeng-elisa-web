# 2026-06-27 Product Documents Frontend

## 本轮目标

继续梳理 ELISA 商品后台/前台链路，把后台“产品文档”上传与绑定结果接到商品详情页，避免管理员批量上传 PDF 后前台仍只能读取旧字段。

## 已完成

- 商品详情页 `app/(shop)/products/[slug]/page.tsx`
  - 读取 `product_documents` 中已绑定、状态为 `active` 的说明书/COA。
  - 保留旧字段 `products.datasheet_pdf` 作为兜底，迁移未执行或旧商品仍可显示说明书。
  - `OrderPanel` 优先使用绑定的说明书链接。
  - `ProductAccordion` 接收完整文档列表，用于显示多份资料。
  - 清理无效 `aliasRows.map(...)` 和显式 `any`。

- 产品详情组件
  - `components/product/ProductAccordion.tsx`
    - 新增 `documents` 参数。
    - “说明书下载”升级为“产品资料下载”，可同时展示说明书与 COA。
    - 文件名优先使用后台上传文件名，没有文件名时用“货号 + 说明书/COA”兜底。
  - `components/product/OrderPanel.tsx`
    - 右侧订购卡片显示靶标信息。
    - 保持说明书主按钮只指向优先说明书，不混入 COA。

- 商品后台接口构建修复
  - `app/api/admin/products/route.ts`
    - 修复 fallback 创建商品时对 `const data` 重新赋值导致生产构建失败的问题。

## 验证

- 局部 lint 通过：
  - `app/api/admin/products/route.ts`
  - `app/(shop)/products/[slug]/page.tsx`
  - `components/product/ProductAccordion.tsx`
  - `components/product/OrderPanel.tsx`
  - 产品文档后台页面和相关 API
- `npm run build` 通过。

## 注意

- `supabase/migrations/040_product_documents.sql` 需要在 Supabase SQL Editor 执行后，产品文档绑定表才会正式可用。
- 前台代码已做缺表兜底：迁移未执行时不影响旧商品详情页显示。
- 工作区还有大量其他历史改动，本轮没有回滚或清理无关文件。

## 下一步建议

继续做“批量导入可靠性”小切片：检查商品 CSV/XLSX 导入字段映射、错误预览、重复货号处理、导入后可追溯记录，以及与产品文档自动匹配之间的人工复核流程。
