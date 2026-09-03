# 其他生化检测试剂页面新增产品搜索位置

## 背景

用户希望“其他生化检测试剂”页面也预留产品搜索位置，因为后续后台会上传该品类的产品信息和产品说明书。

## 调整

- 新增客户端搜索组件：
  - `app/(shop)/products/biochemical-reagents/BiochemicalProductSearch.tsx`
- 在页面首屏介绍和三张品类卡片之间插入产品搜索区域。
- 搜索区域包含：
  - 分类筛选：全部 / WB 试剂 / IHC 试剂 / 生化检测
  - 关键词输入：产品名称、货号、指标或用途
  - 结果区域
  - 暂无公开目录时引导联系人工客服确认
- 当前不接入 ELISA/血清现有产品库，避免污染 ELISA 搜索、说明书匹配和血清 COA 逻辑。

## 后续建议

如果要让后台上传的产品和说明书真正进入这个搜索区域，需要下一阶段补：

- 独立的其他试剂产品数据表
- 后台产品信息维护/批量上传
- 说明书上传与货号匹配
- 前台搜索 API 和产品详情页

## 验证

- `npx eslint app/(shop)/products/biochemical-reagents/page.tsx app/(shop)/products/biochemical-reagents/BiochemicalProductSearch.tsx`
- `npm run build`

均已通过。
