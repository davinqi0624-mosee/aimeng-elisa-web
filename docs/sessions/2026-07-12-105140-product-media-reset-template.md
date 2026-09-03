# 2026-07-12 产品固定图、旧目录归档和模板拆分

## 背景

用户反馈：

- 后台“产品图片”已有标准曲线图、第 4 图片位、第 5 预留图片位，但第 1 图片位和第 3 图片位是固定图，需要知道从哪里上传。
- 旧产品信息会与新批量上传内容重合，需要可控地全部撤下来。
- 产品文字批量上传模板不应再包含图片字段，图片和说明书应走独立后台模块。

## 本轮完成

- “产品图片”页面新增“固定图片位”：
  - 第 1 图片位：产品展示图。
  - 第 3 图片位：检测方法图。
  - 支持上传图片或直接填写 URL。
  - 上传后点击“保存固定图配置”才正式生效。
- 产品详情页读取 `site_settings.product_media`，使用后台保存的固定图配置。
- 新增 `049_product_media_settings_and_catalog_reset.sql`：
  - 初始化 `site_settings.product_media`。
  - 保留已有 `homepage_content`。
- “商品管理”新增“归档旧目录”入口：
  - 先预检当前上架产品、已归档产品、图片绑定、产品文档数量。
  - 需要输入确认文字“归档旧产品目录”。
  - 执行后把当前 active 产品改为 archived，并给旧 `slug/catalog_number/cat_no` 加归档后缀，释放旧货号，便于重新批量导入。
  - 不删除客户、订单、积分、商城，也不删除图片/PDF文件。
- 产品 Excel 模板去掉图片和 PDF 字段，仅保留产品文字信息。
- 产品批量导入接口忽略图片/PDF字段，固定 48T/96T 价格仍由系统写入。
- 存储空间清理加入 `site_settings.product_media` 引用扫描，避免固定图被误判为未引用文件。

## 验证

- `npm run build` 通过。
- 新增 API：
  - `/api/admin/product-media-settings`
  - `/api/admin/products/catalog-reset`

## 上线后操作

需要在 Supabase SQL Editor 执行：

`supabase/migrations/049_product_media_settings_and_catalog_reset.sql`
