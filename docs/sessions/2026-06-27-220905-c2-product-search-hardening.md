# C2 产品搜索巡检

时间：2026-06-27 22:09

## 背景

继续按 lint 分区清单巡检产品前台，重点检查产品搜索 API 和前台搜索页对特殊字符、希腊字母、货号精准匹配的处理。

## 发现

- `/api/search`、`/api/products/match`、前台搜索页各自处理搜索词，规则容易不一致。
- `TNF-alpha`、`TNF-α`、`IFN gamma`、`IL-1beta` 这类写法需要统一转换，否则客户可能搜不到目标。
- 货号搜索需要兼容空格、横杠等输入习惯，例如 `LV-10011`。
- `AdvancedSearch` 在 effect 中同步初始化 state，触发 Hook lint。
- `availableSpecies` 参数未实际使用。

## 修改

- 新增 `lib/products/search.ts`
  - `normalizeSearchTerm`
  - `compactSearchTerm`
  - `buildSearchTermVariants`
  - `buildProductSearchOrConditions`

- `app/api/search/route.ts`
  - 支持 `query` 和 `q` 参数。
  - 搜索名称、靶标、货号、别名时使用统一变体规则。

- `app/api/products/match/route.ts`
  - 增加 `status = active` 过滤。
  - 兼容 `catalog_number` 和 `cat_no`。
  - 使用统一变体规则匹配希腊字母和货号。

- `app/(shop)/search/page.tsx`
  - 与 API 使用同一套搜索条件生成逻辑。

- `components/search/AdvancedSearch.tsx`
  - URL 参数初始化移入 `useState` initializer，修复 Hook lint。
  - `availableSpecies` 开始控制展示种属。

## 验证

- scoped lint 通过。
- `npm run build` 通过。
- 已部署到阿里云。
- 云端健康检查通过。

云端 smoke test：

- `/api/search?query=TNF-alpha`：返回 21 条。
- `/api/search?query=TNF-α`：返回 21 条。
- `/api/search?query=IFN gamma`：返回 19 条。
- `/api/search?query=IL-1beta`：返回 22 条。
- `/api/search?query=LV-10011`：返回 1 条。
- `/api/products/match` 同样通过以上关键词测试。

## 后续

建议继续 C3：商品详情编辑字段与前台展示字段逐项对照。
