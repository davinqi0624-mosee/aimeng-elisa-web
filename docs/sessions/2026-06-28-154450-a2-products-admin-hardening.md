# A2-products 普通 ELISA 商品后台深层巡检

时间：2026-06-28

## 巡检范围

- `app/admin/products/page.tsx`
- `app/api/admin/products/route.ts`
- `app/api/admin/products/bulk-import/route.ts`
- `app/api/admin/upload/route.ts`

## 主要修复

- 商品后台列表加载失败从静默清空改为页面红色错误提示。
- 新建商品未保存前禁止上传产品图片和说明书 PDF，避免文件进入 `products/draft/` 或临时目录后难以追溯。
- 手动创建和批量导入都要求填写货号；货号用于说明书、COA、批量文件匹配和后续追溯。
- 批量导入拦截本地图片/PDF 路径，且图片/PDF 链接必须以 `http://` 或 `https://` 开头。
- 保存动作增加网络异常提示；价格变动超过 20% 时先弹出确认，API 仍限制非 super 管理员直接保存大幅调价。
- 删除商品确认信息补充商品名称、货号和影响说明；服务端删除前确认商品存在。
- 上传 API 增加存储桶和路径前缀白名单，避免后台误传文件到非预期目录。
- 上传 API 统一使用 `createAdminClient()` 并清理 catch 的 `any`。

## 验证

- `npm exec eslint -- app/admin/products/page.tsx app/api/admin/products/route.ts app/api/admin/products/bulk-import/route.ts app/api/admin/upload/route.ts`
- `npm run build`

两项均通过。

## 后续建议

- 用测试商品做一次完整手工验收：新增 -> 保存 -> 上传 4 张图和说明书 -> 改价 -> 删除。
- 未来将普通商品页的说明书管理逐步接入 `product_documents` 的批次确认/撤回/归档流程。
- 价格大幅调整后续可以升级为“审批记录”，保留修改原因和审核人。
