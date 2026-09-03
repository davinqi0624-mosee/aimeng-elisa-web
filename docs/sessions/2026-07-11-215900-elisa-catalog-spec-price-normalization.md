# ELISA 货号、规格、价格和批量导入规则调整

时间：2026-07-11 21:59 CST

## 用户要求

- 同一 ELISA 货号不应因 48T/96T 两个规格在搜索结果中出现两张产品卡。
- 历史货号尾部 `M/S` 分别代表 96T/48T，但产品资料、说明书和批量上传应按基础货号处理。
- 批量上传模板不再维护规格和价格。
- 搜索结果卡片不显示价格；详情页规格选择中固定显示：
  - 48T：1800 元
  - 96T：2400 元

## 实现

- 新增 `lib/products/catalog.ts`
  - `normalizeElisaCatalogNumber`：将 `LV30100M` / `LV30100S` 归一为 `LV30100`。
  - `catalogNumberVariants`：重复检查时同时匹配基础货号、M、S 历史后缀。
  - `getCatalogDisplayNumber`：前台展示基础货号。

- 搜索结果
  - `app/(shop)/search/page.tsx`：按基础货号去重，优先展示基础货号产品，其次展示 96T/M 历史记录作为入口。
  - `app/api/search/route.ts`：API 层同步去重，返回 `count` 为去重后数量，`rawCount` 为数据库原始命中数量。
  - `components/product/ProductCard.tsx`：不再显示价格，只显示基础货号、检测范围和“48T / 96T 可选”。

- 详情页
  - `components/product/OrderPanel.tsx`：规格价格固定为 48T=1800、96T=2400；详情页货号展示基础货号。

- 批量导入
  - `app/api/admin/products/bulk-import/route.ts`：导入时自动去掉 M/S 后缀，按基础货号查重；价格固定写入 48T=1800、96T=2400。
  - `app/admin/products/page.tsx`：后台解析 Excel 时自动规范化货号，忽略规格/价格列。
  - `lib/xlsx-images.ts`：下载模板去掉 `size`、`price`、`price_48t`、`price_96t`，并把图片/说明书列提示改为“可留空；如填写需为 https:// 直链”。

## 验证

- `npm run build` 通过。
- 本地 `/api/search?q=lv30100`：原始命中 2 条，去重返回 1 条。
- 已部署到 `http://106.14.215.238`。
- 线上健康检查通过。
- 线上 `/api/search?q=lv30100`：原始命中 2 条，去重返回 1 条。

## 后续

- 用户提供新版 Excel 模板文件后，可继续替换为静态模板下载，或把其字段映射同步到当前生成模板。
