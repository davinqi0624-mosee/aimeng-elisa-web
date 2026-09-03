# 产品详情信息卡片顺序调整

日期：2026-07-03

## 本次目标

将 ELISA 产品详情页主图下方的产品信息卡片顺序调整为：

1. 反应种属
2. 灵敏度
3. 检测范围
4. 样本类型
5. 检测方法

## 已完成

- 修改 `components/product/ProductInfoCards.tsx` 中的信息卡片数组顺序。
- 不改变字段来源、图标样式和展示内容，仅调整排列顺序。

## 验证

- `npm run lint -- components/product/ProductInfoCards.tsx` 通过。
- `npm run build` 通过。
