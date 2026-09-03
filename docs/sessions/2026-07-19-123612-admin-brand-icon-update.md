# 后台左上角品牌图标替换

## 背景

用户希望将后台管理左上角的蓝色盾牌图标替换为爱萌优宁 A 标识。

## 调整

- 修改 `app/admin/layout.tsx`。
- 使用 `next/image` 引入 `public/brand/AU-logo.ai.png`。
- 替换桌面端侧边栏左上角图标。
- 替换移动端后台顶部栏图标。
- 保留文字 `AIMENG UNING` 和 `管理后台`。

## 验证

- `npx eslint app/admin/layout.tsx`
- `npm run build`

均已通过。
