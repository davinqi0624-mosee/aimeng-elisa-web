# 2026-06-27 Product Document Naming Rules

## 背景

用户明确了三类商品资料的核心对应关系：

- ELISA 试剂盒：每个商品有唯一货号，说明书按货号对应商品。
- 胎牛血清：每个商品有唯一货号，COA 按货号 + 批次号对应具体批次。
- 动物血制品：每个商品有唯一货号，COA 按货号 + 批次号对应具体批次。

结论：货号是商品身份；批次号是 COA 身份。文件名必须服务于后续追溯。

## 本轮完成

- 新增文件名解析工具：
  - `lib/products/document-naming.ts`
  - 说明书规则：`货号.pdf`
  - COA 规则：`货号_批次号_COA.pdf`
  - 解析后生成：
    - `catalogNumber`
    - `batchNumber`
    - `documentKey`

- 新增数据库迁移：
  - `supabase/migrations/041_product_document_naming_rules.sql`
  - 给 `product_documents` 增加：
    - `catalog_number`
    - `batch_number`
    - `normalized_file_key`
  - 增加索引和唯一约束：
    - 同一商品只允许一份 active 说明书。
    - 同一商品同一批次只允许一份 active COA。

- 更新产品文档上传接口：
  - `app/api/admin/product-documents/route.ts`
  - 上传时解析文件名。
  - 说明书必须能解析出货号。
  - COA 必须能解析出货号和批次号。
  - 已做新旧数据库字段兼容；迁移未执行时仍可兜底旧字段。

- 更新自动匹配接口：
  - `app/api/admin/products/documents/bind/route.ts`
  - 自动匹配改为货号优先。
  - 先按 `catalog_number/cat_no` 精确匹配商品。
  - 只有货号未命中时才使用文件名相似度匹配。
  - 商品读取上限从 500 提升为默认 5000，最高 20000，适配未来数千商品。

- 更新后台页面：
  - `app/admin/product-documents/page.tsx`
  - 页面显示文件命名规则。
  - 上传入口支持一次选择多个 PDF。
  - 列表显示解析出的货号和批次号。

## 验证

- 局部 lint 通过：
  - `lib/products/document-naming.ts`
  - `app/api/admin/product-documents/route.ts`
  - `app/api/admin/products/documents/bind/route.ts`
  - `app/admin/product-documents/page.tsx`
- `npm run build` 通过。

## 下一步

真正的大批量上传还需要继续升级为“批次导入中心”：

- 建立上传批次记录。
- 每个文件记录上传状态、匹配状态、失败原因。
- 支持 ZIP 或多文件分批上传。
- 精确匹配可以批量确认，非精确匹配必须人工复核。
- 对胎牛血清/动物血制品 COA，需要把 `serum_coa_documents` 与这套文件名规则统一起来。
