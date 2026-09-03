# 2026-07-22 官方文献 Excel 导入

## 来源文件

- `/Users/moses/Desktop/爱萌文章信息登记.xlsx`
- 导入 Sheet：`2022年AU发文奖励客户统计`

## 导入结果

- 解析有效文献：16 篇
- 新增导入：16 篇
- 跳过重复：0 篇
- 导入状态：`official_import` / `verified` / `is_displayed = true`
- 积分：`0`，不触发客户奖励

## 归纳统计

### 按发表年份

- 2022：3 篇
- 2023：2 篇
- 2024：4 篇
- 2025：6 篇
- 2026：1 篇

### 按单位

- 苏州大学：9 篇
- 山西大学：2 篇
- 陆军军医大学：1 篇
- 上海市肿瘤研究所：1 篇
- 四川大学：1 篇
- 中科院物质研究院：1 篇
- 苏州大学苏州医学院公共卫生学院：1 篇

### 期刊和 IF

- IF >= 10：9 篇
- 最高 IF：Advanced Materials，26.8
- 重点期刊包括：Advanced Materials、Journal of Thrombosis and Haemostasis、Acta Pharmaceutica Sinica B、biomaterials、SCIENCE ADVANCES、Journal for ImmunoTherapy of Cancer、Journal of controlled release、ACS Appl. Mater. Interfaces 等。

### 产品关联

- 涉及去规格化产品货号：33 个
- 导入时将 `LVxxxxM/LVxxxxS` 自动归一为 `LVxxxx`，原始货号保留在 `extraction_result.original_catalog_numbers` 中。

## 程序调整

- 新增脚本：`scripts/import-official-citations-from-excel.mjs`
  - 支持从 Excel 读取官方文献清单
  - 自动清洗标题/链接/DOI/年份/IF
  - 自动纠正标题和网址填反的记录
  - 自动去重，避免重复导入
  - 多货号写入 `detected_products`
- 修改产品详情页：
  - 产品文献不只按 `product_cat_no` 查，也会按 `detected_products` 查。
  - 一个文献涉及多个货号时，对应产品页都能看到该文献。
- 修改文献大厅：
  - 没有 DOI 但有文章链接的文献，前台显示“原文链接”。

## 验证

- 数据库核对：`official_import_count = 16`
- 最高 IF 前 5 条已读取确认。
