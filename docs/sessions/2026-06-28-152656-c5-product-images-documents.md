# C5 产品图片与资料下载闭环巡检

时间：2026-06-28 15:26

## 背景

按产品板块巡检顺序进入 C5，重点看产品图片、说明书、COA、产品文档批次中心是否存在“后台/数据库有资料，但客户前台看不到或查不到”的问题。

## 发现

- 历史迁移 `018_create_product_images.sql` 创建了 `product_images` 关联表，并为商品生成默认多图。
- 普通 ELISA 商品详情页虽然查询了 `product_images`，但实际展示只使用 `products` 表里的 `product_image`、`standard_curve_image`、`validation_image`、`additional_image` 四个字段。
- 这会造成历史多图表里有图片，前台详情页却不展示。
- 图库组件没有坏图兜底，远程图片失效时客户会看到破图。
- COA 查询、产品文档批次中心、上传/匹配/确认/归档链路 scoped lint 当前保持通过。

## 修改

- `app/(shop)/products/[slug]/page.tsx`
  - 新增商品图片合并逻辑。
  - 优先展示 `products` 表 4 个图片字段。
  - 再补充 `product_images` 关联表图片。
  - 按 `display_order` 排序并按 URL 去重。

- `components/product/ProductImageGallery.tsx`
  - 图片加载失败后自动标记并从可展示列表中剔除。
  - 没有可用图片时显示本地 ELISA 原理兜底图。
  - 避免在 effect 内同步 setState，保持 Hook lint 干净。

## 验证

- scoped lint 通过。
- `npm run build` 通过。

## 迁移

本轮不需要新增迁移；`product_images` 已由历史迁移 `018_create_product_images.sql` 创建。
