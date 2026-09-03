# 2026-07-20 其他生化检测试剂页人工客服按钮去重

## 背景

用户截图标注“联系客服确认”按钮重复。页面顶部已有“咨询人工客服”，搜索卡片右上角已有“转人工客服”，底部空状态再出现一次按钮会显得过多。

## 改动

- 移除 `app/(shop)/products/biochemical-reagents/BiochemicalProductSearch.tsx` 底部空状态中的“联系客服确认”按钮。
- 保留提示文字，并改为引导用户通过上方人工客服入口提交产品方向、检测指标、样本类型和实验用途。

## 验证

- `npx eslint app/'(shop)'/products/biochemical-reagents/BiochemicalProductSearch.tsx app/'(shop)'/products/biochemical-reagents/page.tsx`
- `npm run build`
- `npm run deploy:aliyun`
- 线上健康检查通过。
