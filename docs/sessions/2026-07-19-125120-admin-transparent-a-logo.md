# 后台透明 A 标识调整

## 背景

用户希望后台左上角不要显示完整品牌 logo，只保留 A 标识，并且适配深色背景。用户提供桌面图片 `A-logo大图.png`。

## 处理

- 检查桌面图片后发现原图为 RGB，没有透明通道。
- 原图中的白色 A 与白色背景颜色相同，直接去白底会把 A 一起抠除。
- 新增后台专用透明 SVG：`public/brand/admin-a-logo.svg`。
  - 透明背景；
  - 保留彩色叠片；
  - 重新绘制白色 A，适合深色后台背景。
- 更新 `app/admin/layout.tsx`：
  - 桌面端后台侧边栏左上角使用 `/brand/admin-a-logo.svg`；
  - 移动端后台顶部栏同步使用 `/brand/admin-a-logo.svg`。

## 验证

- `npx eslint app/admin/layout.tsx`
- `npm run build`

均已通过。
