# 2026-07-20 22:01 其他生化检测试剂页面品牌深蓝调整

## 背景

用户反馈“其他生化检测试剂”页面中“咨询人工客服”按钮和右侧流程说明卡使用黑色不好看，希望改成爱萌优宁 Logo 优宁字体类似的深蓝色。

## 改动

- 将页面首屏“咨询人工客服”按钮从 `bg-slate-900` 调整为品牌深蓝 `#123A63`，hover 色为 `#0E3155`。
- 将右侧“样本 / 方法 / 结果”流程说明卡从黑色改为品牌深蓝 `#123A63`。
- 调整流程卡边框、分隔线和正文颜色，保证深蓝底上的可读性。
- 同步将该页面搜索结果里的“说明书”按钮从黑色改为同一品牌深蓝，保持页面一致。

## 验证

- `npx eslint app/(shop)/products/biochemical-reagents/page.tsx app/(shop)/products/biochemical-reagents/BiochemicalProductSearch.tsx`
- `npm run build`
- `npm run deploy:aliyun`
- 线上健康检查通过：`http://106.14.215.238/products/biochemical-reagents`
