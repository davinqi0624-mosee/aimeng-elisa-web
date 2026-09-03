# 产品详情保存信息与试剂盒组成调整

日期：2026-07-03

## 本次目标

- 产品详情中的“试剂盒组成”里，去掉“标准品”后方括号说明。
- 产品详情中增加产品保存信息：
  - 有效期：6个月
  - 保存温度：2-8℃

## 已完成

- 修改 `components/product/ProductAccordion.tsx`。
- `标准品（冻干粉，7 点 + Blank）` 已改为 `标准品`。
- 产品详情信息网格新增 `有效期` 和 `保存温度` 两项。

## 验证

- `npm run lint -- components/product/ProductAccordion.tsx` 通过。
- `npm run build` 通过。
