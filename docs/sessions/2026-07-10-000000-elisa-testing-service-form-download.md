# ELISA 代测申请表通用下载入口

时间：2026-07-10

本轮处理：

- 新增通用下载配置：
  - `lib/downloads/service-forms.ts`
  - 统一维护 ELISA 代测申请表标题、文件名和下载路径

- 新增占位表单文件：
  - `public/downloads/AIMENG-UNING-ELISA-testing-service-form.csv`
  - Excel 可直接打开
  - 后续可替换为正式固定表单，同名文件路径不变即可

- 搜索页增加入口：
  - `app/(shop)/search/page.tsx`
  - 在 ELISA 搜索结果页顶部增加“需要 ELISA 代测服务？”提示和下载按钮

- 产品详情页增加入口：
  - `components/product/OrderPanel.tsx`
  - 右侧下单/咨询卡片增加“下载代测申请表”
  - `components/product/ProductAccordion.tsx`
  - “产品资料下载”里增加通用代测文件

验证：

- `npm exec eslint -- app/(shop)/search/page.tsx components/product/OrderPanel.tsx components/product/ProductAccordion.tsx lib/downloads/service-forms.ts`
- `npm run build`

说明：

当前文件为通用占位模板。等正式代测表确定后，替换 `public/downloads/AIMENG-UNING-ELISA-testing-service-form.csv` 或改成正式文件路径即可。
