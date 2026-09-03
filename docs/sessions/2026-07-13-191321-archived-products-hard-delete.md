# 2026-07-13 归档产品物理删除

## 背景

用户要求把后台商品管理中仍显示的 13,475 条归档旧产品记录也清理掉，准备重新上传产品目录。

## 执行前状态

- `products status=archived`: 13,475
- `products status=active`: 0
- `product_images`: 53,272
- `product_species`: 506
- `product_aliases`: 546
- `product_documents`: 0

## 备份

删除前已导出本地 JSON 备份：

`reports/backups/archived-products-before-delete-2026-07-13T11-13-21.json`

备份大小约 16MB，包含 13,475 条归档产品完整记录。

## 执行方式

- 使用 Supabase service role 分批读取 `products.status = archived` 的产品 ID。
- 每批 200 条执行物理删除。
- 依赖数据库外键级联清理：
  - `product_images.product_id REFERENCES products(id) ON DELETE CASCADE`
  - `product_species.product_id REFERENCES products(id) ON DELETE CASCADE`
  - `product_aliases.product_id REFERENCES products(id) ON DELETE CASCADE`
  - `product_documents.product_id REFERENCES products(id) ON DELETE CASCADE`

## 执行结果

- 已删除归档产品：13,475
- 删除失败：0

## 执行后验证

- `products`: 0
- `products status=active`: 0
- `products status=archived`: 0
- `product_images`: 0
- `product_species`: 0
- `product_aliases`: 0
- `product_documents`: 0
- `/api/search?q=LV210002` 返回 0 个产品。

## 注意

本次删除的是数据库产品记录及级联绑定记录。Storage 中历史图片/PDF实体文件未直接删除；如需清理文件层面空间，应在新产品上传稳定后再通过后台“运维中心”进行未引用文件扫描和人工确认清理。
