# 2026-07-12 产品批量导入模板改为目录式结构

## 背景

用户上传了 `project-materials/02-product-data/爱萌产品信息目录-兔.xlsx`，希望按该表格结构优化网站产品批量上传模板。

## 表格结构

兔子产品目录包含以下核心字段：

- 货号(CAT_NO.)
- 产品名称(Product_name)
- 种属(species)
- 指标名称(target)
- Product name
- 产品名称
- 灵敏度(Sensitivity)
- 检测范围(Detection_range)
- 样品用量(Sample size)
- 测试方法(test_method)
- 储存温度(Store)
- 检测时间(assay_time)
- 运输(Transport)
- 样本类型(sample_types_text)
- 中文简介
- Introduction
- 库存(Stock status)
- 状态(Status)

## 本轮完成

- 后台商品批量导入解析器支持“中文 + 英文括号”的组合表头。
- 下载的 Excel 模板改成用户目录式结构，不再使用旧的纯英文字段模板。
- 解析规则改为规范化后的精确匹配，避免 `库存(Stock status)` 被误识别成 `状态(Status)`。
- 导入时仍只写入当前产品表已支持的文字字段：
  - 货号、产品名、种属、指标、中文简介、测试方法、检测时间、样本类型、检测范围、灵敏度、库存、状态。
- 图片和说明书继续走独立后台模块，不进入 Excel。

## 验证

- 用 `爱萌产品信息目录-兔.xlsx` 做本地解析验证：
  - 4 条兔子产品均能正确读取核心字段。
  - `库存` 读取为“有货”。
  - `状态` 读取为“上架”。
- `npm run build` 通过。

## 注意

第 5 行 `Rabbit β-NGF` 的英文 Introduction 内容疑似复制成 ACE 介绍，正式批量导入前建议修正。
