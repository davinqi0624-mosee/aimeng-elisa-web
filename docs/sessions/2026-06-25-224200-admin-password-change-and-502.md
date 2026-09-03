# 管理员改密链路与临时 502 修复

## 问题

用户在后台首次登录后被提示修改密码，点击后出现“无法连接服务器”。随后前台访问云端地址一度出现 `502 Bad Gateway`。

## 处理

- 新增后台改密页 `/admin/change-password`
- 新增改密接口 `/api/admin/change-password`
- 新增标准浏览器入口 `/.well-known/change-password`，重定向到后台改密页
- 云端测试环境保留 `ADMIN_COOKIE_SECURE=false`

## 502 原因

502 发生在云端同步部署时，旧服务被停止、新服务尚未完全切换完成的短暂窗口里。不是页面逻辑永久损坏。

## 结果

- 云端服务已恢复
- `/`、`/admin/login` 均返回 200
- 后台改密链路已可用
