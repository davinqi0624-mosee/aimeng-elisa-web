# 官方客服设置入口部署记录

时间：2026-06-27 21:15

## 问题

用户在云端后台 `http://106.14.215.238/admin/settings` 没有看到“官方客服二维码”上传入口。

## 判断

本地代码已经包含官方客服配置模块，但云服务器仍运行旧版本，因此后台设置页没有显示新入口。

## 处理

- 执行 `npm run deploy:aliyun`
- 本地生产构建通过
- 已同步 `.next/standalone`、`.next/static`、`public` 到阿里云 ECS
- 已重启 `aimeng-elisa-web` systemd 服务
- 健康检查通过

## 验证

- `http://106.14.215.238/admin/settings` 返回 200
- `http://106.14.215.238/api/customer-service` 返回官方客服默认配置

## 后续提醒

如果后台保存官方客服配置时报数据库表缺失，需要先在 Supabase SQL Editor 执行：

- `supabase/migrations/043_customer_service_settings.sql`
