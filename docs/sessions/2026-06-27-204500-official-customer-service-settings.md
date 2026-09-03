# 2026-06-27 Official Customer Service Settings

## 背景

用户明确指出：官方客服二维码和代理商二维码用途不同。

- 官方客服二维码：只用于商品详情页“联系客服咨询”弹窗。
- 代理商二维码：只用于“联系我们 / 代理商分布”，供不同地区客户查找当地代理商。

## 已完成

- 新增数据库迁移：
  - `supabase/migrations/043_customer_service_settings.sql`
  - 新增 `customer_service_settings` 单例配置表。
  - 字段包括：
    - `service_name`
    - `phone`
    - `email`
    - `wechat_id`
    - `wechat_qr_url`
    - `work_hours`
    - `note`
    - `is_active`

- 新增前台 API：
  - `app/api/customer-service/route.ts`
  - 商品详情页公开读取官方客服配置。
  - 未执行迁移时提供默认兜底配置。

- 新增后台 API：
  - `app/api/admin/customer-service/route.ts`
  - 超级管理员可读取和保存官方客服配置。

- 更新商品详情订购卡：
  - `components/product/OrderPanel.tsx`
  - “联系客服咨询”弹窗只读取 `/api/customer-service`。
  - 已移除从 `/api/agents` 获取代理商二维码的逻辑。
  - 弹窗展示官方客服二维码、电话、邮箱、微信号、工作时间和说明。

- 更新后台系统设置：
  - `app/admin/settings/page.tsx`
  - 新增“官方客服配置”模块。
  - 可上传官方客服二维码到 `page-assets/customer-service/...`。
  - 可编辑客服电话、邮箱、微信号、工作时间和弹窗说明。

- 更新存储清理保护：
  - `app/api/admin/storage-cleanup/route.ts`
  - 官方客服二维码加入引用保护，避免清理工具误删。

## 验证

- 局部 lint 通过：
  - `components/product/OrderPanel.tsx`
  - `app/admin/settings/page.tsx`
  - `app/api/customer-service/route.ts`
  - `app/api/admin/customer-service/route.ts`
  - `app/api/admin/storage-cleanup/route.ts`
- `npm run build` 通过。

## 待执行

需要在 Supabase SQL Editor 执行：

```text
supabase/migrations/043_customer_service_settings.sql
```

执行后，在后台 `/admin/settings` 上传官方客服二维码并保存。
