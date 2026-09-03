# 2026-07-22 客户端 randomUUID 上传兼容修复

## 问题

后台「官方客服配置」上传人工客服二维码时，部分浏览器报错：

`crypto.randomUUID is not a function. (In 'crypto.randomUUID()', 'crypto.randomUUID' is undefined)`

## 原因判断

这是前端客户端浏览器兼容性问题，不是图片文件本身的问题。部分浏览器或内嵌 WebView 不支持 `crypto.randomUUID()`，导致上传前生成文件名时中断。

## 修复

- `app/admin/settings/page.tsx`：二维码上传文件名 ID 改为时间戳 + 随机数，不再调用 `crypto.randomUUID()`。
- `app/admin/agents/page.tsx`：代理商导入批次 ID 同步改为客户端兼容生成方式。
- `app/(ai)/chat/page.tsx`：AI 客服会话 ID 同步改为客户端兼容生成方式。

服务器端 API 中的 `crypto.randomUUID()` 保持不变，服务器运行环境支持该能力，不属于本次浏览器报错范围。

## 验证

- `npx eslint app/admin/settings/page.tsx app/admin/agents/page.tsx app/'(ai)'/chat/page.tsx`：0 个错误，2 个既有 `<img>` 警告。
- `npm run build`：通过。
- `.next/static/chunks` 本地检查：无 `randomUUID`。
- `npm run deploy:aliyun`：部署成功。
- 线上 `/admin/settings` 页面引用的 11 个前端 JS chunk 检查：无 `randomUUID`。
- 线上健康检查通过：`http://106.14.215.238`。
