# ELISA 检测报告标准品命名与 OD 列调整

日期：2026-07-03

## 本次目标

- 检测报告中的标准品名称不再显示为 `Std + 浓度`。
- 标准品按顺序显示为：`Blank、S1、S2、S3、S4、S5、S6、S7`。
- 去掉报告中的 `校正OD` / `校正均值OD` 列。

## 已完成

- 修改 `app/lab/analysis/page.tsx`。
- 新增标准品显示名称规则：0 浓度显示 `Blank`，其余非零标准品按当前标准曲线顺序显示 `S1-S7`。
- Excel `整理后数据` 中标准品名称改为 `Blank/S1-S7`。
- Excel `整理后数据` 去掉 `校正OD` 列。
- Excel `原始数据` 中标准品表去掉 `校正均值OD` 列。
- TXT 报告、Excel 报告详情、网页报告预览、96 孔位矩阵同步使用 `Blank/S1-S7`。

## 验证

- `npm run lint -- app/lab/analysis/page.tsx` 通过。
- `npm run build` 通过。
