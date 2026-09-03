# 2026-07-14 Species Filter Normalization

## Context

前台产品种属筛选出现混查：

- 绵羊筛选会带出山羊 `Capra-hircus` 产品。
- 斑马鱼筛选会带出山羊 `Capra-hircus` 产品。
- 种属显示需要统一为 `中文 / English`，并将“狗”改为“犬”。

## Root Cause

搜索页和 `/api/search` 的种属筛选使用了产品名称模糊匹配，例如旧规则中 Sheep 包含通用关键词“羊”，导致绵羊筛选同时命中山羊产品名称。

## Changes

- 将种属标签、别名、规范化逻辑集中到 `lib/products/species.ts`。
- 前台筛选按钮、已选标签、产品卡片、产品详情信息卡、下单面板统一使用规范化后的双语种属标签。
- 搜索页和 `/api/search` 的种属筛选改为精确匹配 `products.species` 与 `product_species.species`，不再通过产品名称猜种属。
- 详情页面包屑种属链接使用规范种属参数。
- 批量导入推断规则移除 Sheep 的泛化“羊”匹配，并支持 `Capra-hircus` 归一为 Goat、`狗` 归一为 Canine。

## Verification

- `npm run build` 通过。
- 本地生产模式验证：
  - `/products/elisa?species=Sheep` 中 `Capra-hircus`、`LV220001`、`LV220002` 计数均为 0。
  - `/products/elisa?species=Zebrafish` 中 `Capra-hircus`、`LV220001`、`LV220002` 计数均为 0。
  - `/products/elisa?species=Goat` 正常显示山羊产品。
  - `/api/search?species=Sheep`、`/api/search?species=Zebrafish`、`/api/search?species=Goat` 返回结果符合对应种属。
