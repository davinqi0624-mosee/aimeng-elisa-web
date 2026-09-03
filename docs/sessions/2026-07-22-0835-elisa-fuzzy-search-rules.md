# 2026-07-22 ELISA 产品模糊搜索规则升级

## 背景

客户搜索 ELISA 产品时，输入方式无法统一，例如：

- 英文 / 中文
- 英文大小写
- 中文数字 / 中文大写数字 / 阿拉伯数字
- 希腊字母符号 / 英文拼写
- 英文缩写
- 横线、空格有无

示例：`白介素六`、`白介素陆`、`IL6`、`IL-6`、`il 6` 都应该指向 IL-6。

## 设计原则

种属筛选继续走规范种属精确匹配，避免“羊”同时带出绵羊和山羊。模糊搜索只用于检测指标、产品名称、货号和别名。

## 已实现

修改文件：

- `lib/products/search.ts`

新增能力：

- 全角/半角、大小写、空格、横线统一。
- 希腊字母符号和英文互转，例如 `α / alpha / a`、`β / beta / b`。
- 罗马数字转阿拉伯数字，例如 `IL-II` 可扩展到 `IL-2`。
- 中文数字和大写数字转阿拉伯数字，例如 `六 / 陆` 转 `6`。
- 常见中文靶标名转英文缩写：
  - 白介素 / 白细胞介素 -> `IL`
  - 干扰素 -> `IFN`
  - 肿瘤坏死因子 -> `TNF`
  - 转化生长因子 -> `TGF`
  - 血管内皮生长因子 -> `VEGF`
  - 表皮生长因子 -> `EGF`
  - 成纤维细胞生长因子 -> `FGF`
  - 胰岛素样生长因子 -> `IGF`
  - 基质金属蛋白酶 -> `MMP`
  - SOD、MDA、GSH、GSH-Px、CAT、MPO、NO、NOS 等常见中文名别名

## 验证

- `npx tsc --noEmit --pretty false`：通过。
- `npx eslint lib/products/search.ts app/api/search/route.ts app/'(shop)'/search/page.tsx`：通过。
- `npm run build`：通过。
- `npm run deploy:aliyun`：部署成功。
- 线上健康检查通过。

线上搜索验证：

- `白介素六`：命中 IL-6 产品。
- `白介素陆`：命中 IL-6 产品。
- `IL6`：命中 IL-6 产品。
- `IL-6`：命中 IL-6 产品。
- `il 6`：命中 IL-6 产品。
- `TNFα`：命中 TNF-α 产品。
- `TNF-alpha`：命中 TNF-α 产品。
- `IL-1β`：命中 IL-1β 产品。
- `Guinea Pig + 白介素六`：命中 `LV170001 Guinea-Pig IL-6 ELISA Kit`。

## 遗留说明

全量 lint 仍会在 `components/search/AdvancedSearch.tsx` 报一个既有 `react-hooks/set-state-in-effect` 规则提示，和本次模糊搜索规则无关；本次相关文件 lint 通过，生产构建通过。
