# 生化法试剂盒兼容读取与部署记录

日期：2026-09-03

## 本次处理

- 核对生产 Supabase：`biochemical_products` 已存在，但仍是旧结构，字段为 `specification`、`price`。
- 修正前台和后台 API 的错误判断：旧字段结构按兼容模式读取，不再误报“数据库尚未创建”。
- 旧结构下前台继续显示原有产品；后台允许查看，但不会把双规格价格静默降级保存，新增和编辑会提示先执行 070 迁移。
- 后台和前台增加兼容状态提示，明确说明升级后支持 `96T / 48T` 双规格和对应手动价格。
- 生产部署到 `https://animaluni.com`，systemd 服务正常，健康检查 23 个页面和 4 个接口全部通过。

## 当前数据库状态

生产接口复测结果：

```json
{"products":[],"needsSetup":false,"needsMigration":true}
```

这表示表存在但尚未升级，不是网站故障。

## 下一步

在 Supabase SQL Editor 执行完整文件：

```text
supabase/migrations/070_biochemical_product_specifications.sql
```

执行成功后刷新后台 `/admin/biochemical-products`，即可录入：货号、指标名称、96T/48T 规格、各规格手动价格和操作波长。生化产品前台地址为 `/products/biochemical-reagents`，ELISA 搜索仍独立排除生化产品。
