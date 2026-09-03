# 公司地址后台配置

## 目标

将“联系我们”页面的公司地址从前端写死文本改为后台可维护配置。

## 已实现

- `customer_service_settings` 新增 `address` 字段。
- 后台 `/admin/settings` 的“官方客服配置”增加“公司地址”输入框。
- 前台 `/contact` 从 `/api/customer-service` 读取地址。
- 后台保存接口支持读写地址。
- 数据库字段未初始化时，前台继续展示旧地址作为兼容默认值。

## 数据库迁移

需要在 Supabase SQL Editor 执行：

- `supabase/migrations/060_customer_service_address.sql`

迁移会：

- 新增 `address` 字段。
- 将现有默认地址初始化为“上海市浦东新区张江高科技园区科苑路88号”。
- 刷新 PostgREST schema。

## 操作路径

1. 执行 `060_customer_service_address.sql`。
2. 后台登录后打开“系统设置”。
3. 在“官方客服配置”修改“公司地址”。
4. 点击“保存官方客服配置”。
5. 刷新“联系我们”页面确认。

## 验证

- 修改相关 lint 无错误，仅保留一个既有二维码 `<img>` 性能提示。
- `npm run build` 通过。
- 已部署到线上。
- 线上健康检查：23 个页面、4 个 API 全部通过。
