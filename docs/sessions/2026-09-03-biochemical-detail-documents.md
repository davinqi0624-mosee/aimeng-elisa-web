# 生化产品详情页与操作说明书

日期：2026-09-03

## 需求

- 生化产品指标卡片可点击进入独立详情页。
- 生化产品使用独立于 ELISA 的产品详情布局。
- 后台产品编辑页支持手动上传、替换、删除单个 PDF 操作说明书。
- 前台支持在线预览与下载说明书。
- 说明书上传不做批量流程，产品保存后再上传。

## 已完成

- 新增迁移 `supabase/migrations/071_biochemical_product_documents.sql`。
- 新增生化说明书表 `biochemical_product_documents`，每个产品最多一份有效说明书。
- 新增后台接口：`/api/admin/biochemical-products/[id]/document`。
- 新增前台详情接口：`/api/biochemical-products/[id]`。
- 新增页面：`/products/biochemical-reagents/[id]`。
- 修改生化产品卡片，增加“查看产品详情与操作说明书”入口。
- 上传文件继续保存到现有 Supabase Storage `product-assets`，路径为 `biochemical-documents/{productId}/...`。
- 新增产品时不显示可用上传控件，必须先保存资料，再点击编辑进入上传状态；说明书不会和新增产品请求同时提交。
- 后台说明书区域支持点击选择 PDF，也支持拖拽 PDF 到上传区域。
- 替换说明书时先上传新文件；如果数据库写入失败，会删除新文件并恢复旧说明书记录。
- 删除说明书时同步删除 Storage 文件并归档数据库记录。
- 修复 Storage 对中文、空格、括号文件名的 `Invalid key` 拒绝：原文件名只保存为展示名称，Storage 路径改为 UUID `.pdf`。

## 验证

- `npx tsc --noEmit` 通过。
- 本次涉及文件定向 ESLint 通过。
- `npm run build` 通过。
- 已部署到 `https://animaluni.com`。
- 线上页面和接口健康检查通过。
- 线上生化产品详情接口返回现有产品；当前说明书为空，因为 071 尚未执行且该产品还没有上传 PDF。

## 后续调整

- 本次没有新增迁移文件；数据库仍使用 `supabase/migrations/071_biochemical_product_documents.sql`。

## 上线操作

在生产 Supabase SQL Editor 中按顺序确认已执行 069、070，然后执行：

```text
supabase/migrations/071_biochemical_product_documents.sql
```

执行后进入后台“生化法试剂盒”，点击产品编辑，在“操作说明书 PDF”区域上传文件。前台详情页会自动显示在线预览和下载按钮。
