# Lint 债务分区清单

创建时间：2026-06-26

目标：把全站 lint 债务拆成小范围，逐一处理；不在业务巡检中一次性大范围重构。

## 分区原则

1. 先清会影响运行稳定性的 lint：React 纯函数规则、Hook 依赖、组件渲染时调用随机数/时间。
2. 再清后台基础模块：管理员、商品、代理商、订单、用户、积分商城、文献审核。
3. 再清前台核心访问链路：主页、导航、产品、搜索、积分商城、文献引用。
4. 最后清工具型和历史备份文件：ELISA 分析、旧 `.bak` 页面、实验工具、内部组件。

## 小范围拆分

### A. 后台基础模块

范围：

- `app/admin/**`
- `app/api/admin/**`
- `lib/admin/**`

优先级：

- 高

重点问题：

- `any` 类型逐步替换为明确接口。
- 后台 API 必须使用 `requireAdminOrSuper` 或 `requireSuper`。
- 页面 fetch 失败不能静默。
- 删除、导出、回滚、积分操作必须有明确确认和错误提示。

### B. AI 与知识生成

范围：

- `app/(ai)/**`
- `app/ai-chat/**`
- `app/api/ai/**`
- `app/api/knowledge/**`
- `lib/ai/**`

优先级：

- 高

重点问题：

- 生成类接口必须有权限或 cron secret。
- React 组件中不能在 render 阶段直接 `Date.now()` / `Math.random()`。
- AI API 错误要转成中文可操作提示。

### C. 产品与搜索前台

范围：

- `app/(shop)/**`
- `app/products/**`
- `app/search/**`
- `components/product/**`
- `lib/products/**`

优先级：

- 高

重点问题：

- 图片尺寸与空图兜底。
- 产品详情、搜索、说明书、COA 访问不能因缺字段崩溃。
- `any` 替换为产品数据接口。

### D. 文献引用与积分体系

范围：

- `app/citations/**`
- `app/user/citations/**`
- `app/api/citations/**`
- `app/api/shop/**`
- `app/api/points/**`
- `lib/citations/**`

优先级：

- 高

重点问题：

- 文件上传、AI 识别、审核、积分发放必须有错误闭环。
- 积分流水类型统一处理 `earn` / `spend` / `refund`。
- 重复 DOI、重复文件、无效文献不能重复发积分。

### E. ELISA 实验工具

范围：

- `app/lab/**`
- `app/analysis/**`
- `components/calculator/**`
- `components/analysis/**`
- `lib/elisa-4pl-core.ts`

优先级：

- 中高

重点问题：

- 4PL 算法、孔位解析、截图 OCR、报告生成要单独测试。
- 清理旧算法备份页面前先确认没有路由引用。
- 先补测试，再逐步清 lint。

### F. 首页与公共组件

范围：

- `app/page.tsx`
- `components/home/**`
- `components/ui/**`
- `components/Navbar.tsx`
- `components/AppChrome.tsx`

优先级：

- 中

重点问题：

- 首页动画/轮播不要在 render 阶段生成随机值。
- 导航链接、移动端菜单、图片资源要稳定。

### G. 历史备份和废弃文件

范围：

- `*.backup`
- `*.bak.*`
- 未引用旧页面

优先级：

- 中

重点问题：

- 先用 `rg` 确认无引用，再移动到归档目录或删除。
- 不和功能修复混在一个提交/一轮巡检里。

## 建议执行顺序

1. A1：`app/api/admin/**` 鉴权、错误提示、`any` 收窄。
2. A2：`app/admin/**` 后台页面静默失败和 Hook lint。
3. D1：文献审核/积分商城/积分余额所有积分计算统一。
4. B1：AI/知识生成接口权限与错误提示。
5. C1：产品与搜索前台的空字段、图片和类型。
6. E1：ELISA 4PL 算法测试与 lint。
7. F1：首页和公共组件 React 纯函数规则。
8. G1：历史备份文件归档。

## 当前备注

- `npm run build` 比 lint 更接近当前上线门槛，必须保持通过。
- `npm run lint` 当前失败是历史债务，不应阻止单个功能修复部署；但每一轮巡检应至少减少一个小分区的问题。

## 2026-06-28 E1 ELISA 实验工具进展

范围：

- `app/lab/analysis/page.tsx`
- `app/api/lab/analysis/ocr/route.ts`
- `app/api/reports/route.ts`
- `app/api/analyze/route.ts`
- `lib/elisa-4pl-core.ts`

结果：

- scoped lint：0 errors，0 warnings。
- `node scripts/verify-elisa-4pl.mjs` 通过，Human LRP1/截图标准曲线数据 R² 保持在 0.9998 级别。
- `npm run build` 通过。
- 样本结果拆分为“反算浓度 / 最终浓度 / 判定”，避免低于量程、高于量程、无法反算和正常浓度混在一起。
- 报告页和 TXT 导出增加 96 孔位结果矩阵，便于按 A01-H12 回查。
- `/api/reports` 兼容旧版 `/api/analyze` 结果和当前 `/lab/analysis` 的 `fitResult` 结构，避免未来重新接入时报表崩溃。
- OCR 错误处理和分析/报告 API catch 类型已收窄，减少中转平台异常响应导致的前端不明错误。

E1 后续小范围建议：

1. E1-report-excel：按 `Human LRP1.xlsx` 样式生成 Excel 报告，包含原始数据、整理后数据、报告 3 个工作表。已完成第一版。
2. E1-blank-rule：增加“空白扣除”开关，并明确默认是否把 0 浓度点参与拟合。已完成第一版，默认保留空白。
3. E1-editing：允许用户在识别后手动修改样本名称、孔位类型、稀释倍数，并重新生成终浓度。样本名称/稀释倍数编辑已完成第一版。
4. E1-chart-embed：将标准曲线图嵌入 Excel/PDF 报告。
5. E1-legacy-cleanup：确认 `app/lab/analysis/pl4-fitting.tsx` 和 `app/lab/analysis/page.tsx.backup` 无路由引用后再归档。

## 2026-06-28 E1-report-excel 进展

范围：

- `app/lab/analysis/page.tsx`

结果：

- 报告页新增“导出 Excel 报告”按钮。
- Excel 报告包含 3 个工作表：
  - `原始数据`：实验概要、96 孔板 OD 矩阵、标准品浓度与 OD、原始粘贴/识别文本。
  - `整理后数据`：孔位、样本名称、类型、原始 OD、已知浓度、反算浓度、稀释度、终浓度、CV%、状态。
  - `报告`：拟合信息、参数、方程、标准品拟合详情、未知样本结果、质控提示。
- scoped lint：0 errors，0 warnings。
- `node scripts/verify-elisa-4pl.mjs` 通过。
- `npm run build` 通过。

## 2026-06-28 E1-blank-rule 进展

范围：

- `app/lab/analysis/page.tsx`

结果：

- 拟合设置新增“空白处理”：
  - `保留空白`：默认选项，不改变原始 OD。
  - `扣除 Blank`：所有标准品和样本 OD 扣除 0 浓度标准品平均 OD。
- 启用扣除 Blank 但未识别到 0 浓度标准品时，会阻止拟合并显示明确错误。
- 启用扣除后，标准品、样本、曲线、反算浓度、最终浓度均基于校正 OD。
- 报告页、TXT 报告、Excel 报告均标注空白处理规则和 Blank 平均 OD。
- Excel `原始数据` 工作表保留原始 OD，同时 `整理后数据` 增加原始 OD / 校正 OD 对照。
- 默认仍然是“保留空白”，因此历史计算结果不变。
- scoped lint：0 errors，0 warnings。
- `node scripts/verify-elisa-4pl.mjs` 通过。
- `npm run build` 通过。

## 2026-06-28 E1-editing 进展

范围：

- `app/lab/analysis/page.tsx`

结果：

- 未知样本结果表支持直接修改样本名称。
- 未知样本结果表支持直接修改稀释倍数。
- 修改稀释倍数后，最终浓度会基于原始反算浓度同步更新。
- TXT 报告、Excel 报告、报告页、96 孔位矩阵都会使用修改后的样本名称和稀释倍数。
- 上传/识别新数据时会清空上一批数据的人工修改，避免串数据。
- scoped lint：0 errors，0 warnings。
- `node scripts/verify-elisa-4pl.mjs` 通过。
- `npm run build` 通过。

## 2026-06-28 F1 首页和公共导航进展

范围：

- `components/ui/Navbar.tsx`
- `app/contact/page.tsx`
- `app/page.tsx`

结果：

- 公共导航“联系我们”改为直达 `/contact#contact-info`。
- 公共导航“全国代理商”改为直达 `/contact#agents`，不再和联系方式混在同一个落点。
- 联系我们页面补充 `contact-info` / `agents` 锚点，并添加 `scroll-mt-24`，避免被顶部导航遮挡。
- 移动端菜单补充 `aria-label`、`aria-expanded`、`aria-controls`，并增加最大高度和内部滚动，避免长菜单在手机上超出屏幕。
- 代理商接口加载失败时显示可理解提示，不再静默变成“暂无代理商数据”。
- 代理商弹窗关闭按钮补充无障碍标签，代理商二维码 alt 改为包含公司名。
- 首页页脚原有 `#` 空链接改为官方联系方式、代理商分布和邮件地址；资源区补充代理商分布入口。
- scoped lint：`components/ui/Navbar.tsx`、`app/contact/page.tsx` 0 errors，1 warning（代理商二维码保留原生 `<img>`，避免外部/Supabase 图片域名未配置导致二维码不显示）。
- `npm run build` 通过。

F1 后续小范围建议：

1. F1-home-lint：单独整理 `app/page.tsx` 的历史 `any`、未使用组件和旧首页代码，不和公共入口修复混在一起。
2. F1-legacy-navbar：确认 `components/Navbar.tsx` 仍仅作为兼容空壳使用后，逐步清理旧页面中的重复导入。
3. F1-contact-data：把联系方式从硬编码逐步迁移到后台设置，方便管理员维护电话、邮箱、地址。

## 2026-06-28 F1-首页内容精简和小蜜蜂调整

范围：

- `app/page.tsx`
- `components/AppChrome.tsx`
- `components/product/AiChatBot.tsx`
- `components/product/AiChatBot.css`

结果：

- 首页从“多区块完整展开”改为“窗口型首页”：
  - 保留顶部轮播。
  - 新增核心服务入口：产品中心、ELISA 数据分析、AI 实验助手、文献积分。
  - 新增产品中心简洁引导：ELISA、胎牛血清、动物血制品、COA 查询。
  - 新增资料/选型/实验支持入口条。
- 暂时不再在首页完整展开流程、视频、方法学、每日知识、社区、积分商城等长内容，减少重复和滚动负担。
- `/chat` 和 `/ai-chat` 页面隐藏悬浮小蜜蜂，避免手机端挡住输入框和发送按钮。
- 移动端悬浮小蜜蜂缩小为 `h-16 w-16`，位置上移到 `bottom-20 right-3`。
- 小蜜蜂飞行动效幅度收小、速度放慢，保留企业 IP 的存在感但不打扰操作。
- `components/AppChrome.tsx`、`components/product/AiChatBot.tsx` scoped lint 通过。
- `app/page.tsx` 仍有历史 `any`、旧首页组件未使用等 lint 债务，本轮未扩大清理。
- `npm run build` 通过。

后续建议：

1. F1-home-lint：正式删除或归档首页旧区块函数，顺手清理旧 `any` 和未使用导入。
2. F1-home-copy：等你确认首页新版方向后，再精修首页文案和视觉节奏。

## 2026-06-28 F1-home-lint 首页历史代码清理

范围：

- `app/page.tsx`

结果：

- 删除首页旧版编辑模式、canvas hero、统计条、8 卡功能区、数据分析展示区、积分生态、智能产品搜索、流程、视频教程、方法学、每日知识、社区等不再渲染的旧函数。
- `app/page.tsx` 从 1000+ 行压缩到当前首页实际需要的结构，减少维护噪音。
- 删除未使用图标导入和旧 `Navbar` 导入。
- 删除未使用的 `saveToLocal`。
- `supabase` 从 `any` 收窄为 `SupabaseClient | null`。
- 首页内容对象收窄为 `HomepageContent`，当前只保留页脚版权字段。
- `Footer` props 去掉 `any`，改为明确类型。
- scoped lint：`npm run lint -- app/page.tsx` 通过，0 errors。
- `npm run build` 通过。

后续建议：

1. F1-home-copy：继续精修首页文案和视觉节奏。
2. F1-footer-settings：页脚电话、邮箱、地址后续接入后台设置，避免硬编码。

## 2026-06-26 A2 进展

已清理 A2-core 后台基础壳层页面：

- `app/admin/layout.tsx`
- `app/admin/login/page.tsx`
- `app/admin/admins/page.tsx`
- `app/admin/bulk-imports/page.tsx`
- `app/admin/dashboard/page.tsx`
- `app/admin/maintenance/page.tsx`
- `app/admin/home-banners/page.tsx`
- `app/admin/knowledge/candidates/page.tsx`
- `app/admin/knowledge/generate/page.tsx`
- `app/admin/ai-agents/page.tsx`
- `app/admin/change-password/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/page.tsx`

当前 scoped lint 结果：0 errors，剩余 2 个 `home-banners` 图片 `<img>` warning。

A2 后续小范围建议：

1. A2-citations：`app/admin/citations/page.tsx`，处理 `any`、Hook lint、审核失败提示。已完成。
2. A2-shop：`app/admin/shop/page.tsx`，处理积分商城后台 `any`、Hook lint、上传/保存失败提示。已完成。
3. A2-serum-products-light：`app/admin/serum-products/page.tsx` 和 `app/api/admin/serum-products/route.ts`，只做 lint 与错误提示；深度产品逻辑留给产品专项巡检。已完成。
4. A2-products-light：`app/admin/products/page.tsx` 和 `app/api/admin/products/route.ts`，普通 ELISA 商品后台错误较多，建议单独一轮处理。
5. A2-pages：`app/admin/pages/**`，内页编辑功能如果未来不用，应考虑删除后台入口或归档旧代码。

## 2026-06-26 A2-citations / A2-shop 进展

### A2-citations 已完成

范围：

- `app/admin/citations/page.tsx`
- `app/api/admin/citations/route.ts`
- `app/api/papers/verify/route.ts`

结果：

- scoped lint：0 errors。
- 文献审核页加载失败和审核失败不再静默。
- `extraction_result`、多文件证据、重复文件 hash 等逻辑已补明确类型。
- build 通过并已部署。

### A2-shop 已完成

范围：

- `app/admin/shop/page.tsx`
- `app/api/admin/shop/route.ts`
- `app/api/shop/items/route.ts`
- `app/api/shop/redeem/route.ts`

结果：

- scoped lint：0 errors，剩余 2 个商品图片 `<img>` warning。
- 积分商城后台加载/删除失败不再静默。
- 上传/保存/兑换接口的 `any` 已收窄。
- build 通过并已部署。

### A2-serum-products-light 已完成

范围：

- `app/admin/serum-products/page.tsx`
- `app/api/admin/serum-products/route.ts`

结果：

- scoped lint：0 errors，剩余 1 个血清产品图片 `<img>` warning。
- 血清产品后台加载/上传/保存错误类型已收窄。
- API 的 `quality_items`、`comparison_points`、`status`、catch 错误处理已收窄。

## 2026-06-28 A2-products 深层后台巡检进展

范围：

- `app/admin/products/page.tsx`
- `app/api/admin/products/route.ts`
- `app/api/admin/products/bulk-import/route.ts`
- `app/api/admin/upload/route.ts`

结果：

- scoped lint：0 errors。
- `npm run build`：通过。
- 新建 ELISA 商品时，未保存前不再允许上传图片/PDF，避免文件进入临时目录后归错商品。
- 手动创建和批量导入都要求填写货号；货号作为说明书、COA、批量文件匹配和后续追溯的核心字段。
- 批量导入会拦截本地图片/PDF 路径和非 `http://` / `https://` 链接，避免导入后客户打不开资料。
- 商品列表加载失败不再静默清空，会在页面显示红色错误提示。
- 保存网络失败、API 错误、价格变动超过 20% 都有更明确的中文提示；非 super 管理员仍由 API 阻止大幅调价。
- 删除商品前提示商品名/货号和删除影响，API 删除前会确认商品仍存在。
- 管理员上传接口增加存储桶与路径前缀白名单，并复用 `createAdminClient()`，减少误传到非预期目录的风险。

A2-products 后续建议：

1. 做一轮实际后台手工验收：新增商品 -> 保存 -> 上传 4 张图和说明书 -> 编辑价格 -> 删除测试商品。
2. 后续产品文档中心上线后，把“说明书上传”逐步迁移到 `product_documents` 批次确认流程，普通商品编辑页只保留查看/替换入口。
3. 价格变更可以进一步做成独立审批单，而不是只依赖 super 账号即时保存。

## 2026-06-28 D1 文献引用 + 积分体系闭环巡检

范围：

- `app/api/admin/citations/route.ts`
- `app/admin/citations/page.tsx`
- `app/api/citations/submit/route.ts`
- `app/api/citations/upload/route.ts`
- `app/api/citations/extract/route.ts`
- `app/api/user/citations/route.ts`
- `app/user/citations/page.tsx`
- `app/user/citations/submit/page.tsx`
- `app/api/user/points/route.ts`
- `app/api/points/award/route.ts`
- `app/api/shop/redeem/route.ts`
- `app/api/admin/orders/route.ts`
- `lib/points/ledger.ts`

结果：

- scoped lint：0 errors。
- `npm run build`：通过。
- 新增 `lib/points/ledger.ts`，统一按积分流水计算 `available_points` 和 `total_points`。
- 文献审核通过发分改为幂等：同一篇文献已有奖励流水时不重复插入，可在部分失败后重试补齐 profile 余额和文献状态。
- 文献审核通过时如果已有奖励流水金额和当前 IF 对应积分不一致，会阻止继续操作并要求人工核对。
- 管理员手动发分、商城兑换、订单取消退款均接入按流水重算 profile 余额。
- 商城兑换增加失败补偿：扣分流水写入后，如果订单创建或库存扣减失败，会自动写退款流水并同步余额。
- 订单取消退款增加重复退款检查：同一订单已有退款流水时不再重复退分。
- 用户“我的文献投稿”加载失败不再静默，会显示明确错误。
- 文献提交、上传、识别 API 的错误处理和入参类型收窄，减少异常结构导致的服务端崩溃。

D1 后续建议：

1. 后续可新增数据库唯一索引，限制同一兑换订单只能有一条退款流水，进一步抵御极端并发。
2. 商城兑换/退款最终可升级为数据库 RPC 事务，把扣积分、建订单、扣库存合并为真正原子操作。
3. 可增加后台“积分流水对账”页面，批量扫描 `profiles` 与流水计算结果不一致的用户并一键修复。
- build 通过并已部署。

### A2-products-light 待处理

普通 ELISA 商品后台暂未处理，原因是错误集中在动态图片字段、保存 payload、批量导入展示等多个区域，适合单独一轮处理，避免和血清产品轻量修复混在一起。

## 2026-06-27 产品文档批次闭环巡检

范围：

- `app/admin/product-documents/page.tsx`
- `app/api/admin/product-documents/route.ts`
- `app/api/admin/product-documents/batches/route.ts`
- `app/api/admin/products/documents/bind/route.ts`

结果：

- scoped lint：0 errors。
- build 通过。
- 产品文档 API 权限与后台入口对齐：`admin` 和 `super` 均可使用产品文档批次中心。

## 2026-06-28 C3 商品详情字段闭环巡检

范围：

- `app/admin/products/page.tsx`
- `app/api/admin/products/route.ts`
- `app/api/admin/products/bulk-import/route.ts`
- `app/(shop)/products/[slug]/page.tsx`
- `supabase/migrations/044_product_frontend_detail_fields.sql`

结果：

- scoped lint：0 errors。
- `npm run build` 通过。
- 后台商品编辑新增并保存“产品介绍 / 检测方法 / 样本类型”。
- Excel / CSV 批量导入支持以上字段及中文表头别名。
- 前台商品详情页稳定展示检测方法、样本类型、产品介绍。
- 样本类型增加兼容处理，支持文本、数组和 JSON 数组字符串，避免旧数据展示异常。
- 新增迁移 `044_product_frontend_detail_fields.sql`，需在 Supabase SQL Editor 执行后字段才能持久保存。

## 2026-06-28 C4 商品详情深层字段矩阵巡检

范围：

- `app/admin/products/page.tsx`
- `app/api/admin/products/route.ts`
- `app/api/admin/products/bulk-import/route.ts`
- `app/(shop)/products/[slug]/page.tsx`
- `components/product/ProductAccordion.tsx`
- `lib/xlsx-images.ts`

结果：

- scoped lint：0 errors。
- `npm run build` 通过。
- 历史字段 `products.assay_time`、`products.platform` 接入后台编辑、商品保存 API、批量导入 API 和前台详情页。
- 前台商品详情页“产品详情”区展示检测平台和检测时间，旧数据默认显示 `ELISA` / `4h 30m`。
- Excel 导入模板补齐 C3/C4 字段：产品介绍、检测方法、检测平台、检测时间、样本类型、48T/96T 价格、说明书链接。
- `lib/xlsx-images.ts` 清理 2 个 `any` 类型。

备注：

- 本轮不需要新增 Supabase 迁移；`assay_time` 和 `platform` 已由历史迁移 `017_add_product_detail_fields.sql` 创建。

## 2026-06-28 C5 产品图片与资料下载闭环巡检

范围：

- `app/(shop)/products/[slug]/page.tsx`
- `components/product/ProductImageGallery.tsx`
- `components/product/ProductAccordion.tsx`
- `app/api/products/coa/route.ts`
- `app/(shop)/products/coa/**`
- `app/admin/product-documents/**`
- `app/api/admin/product-documents/**`
- `lib/products/document-naming.ts`

结果：

- scoped lint：0 errors。
- `npm run build` 通过。
- 商品详情页图片来源从单一 `products` 表 4 个图片字段，扩展为合并历史 `product_images` 关联表，避免数据库已有图片但前台不展示。
- 图片按 `product_images.display_order` 排序，并按 URL 去重。
- `ProductImageGallery` 增加坏图处理：图片加载失败后自动剔除并显示可用图片或兜底图。
- COA 查询、产品文档批次中心、文档上传/确认/归档相关 scoped lint 保持通过。

备注：

- 本轮不需要新增 Supabase 迁移；`product_images` 已由历史迁移 `018_create_product_images.sql` 创建。
- 批量上传创建批次、上传文件、进入复核状态均有明确失败提示，不再静默中断。
- “归档整个批次”已成为真实批次级撤回能力：归档批次时会同步归档该批次下所有未归档文件，避免误上传或误确认文件继续在前台生效。
- 单个文件确认时，如果旧说明书/旧 COA 归档失败，会阻止确认并返回错误，避免同一商品出现多个生效文档。
- 批量确认“货号精确匹配”时会检查每个确认步骤的数据库错误，失败会中断并反馈原因。

批量上传当前状态：

- 商品表格批量导入和产品 PDF 文档批次上传已经具备基础闭环。
- 后续仍建议继续做一轮产品前台资料展示巡检，确认说明书/COA 在商品详情页、COA 查询页、产品文档页的读取逻辑一致。

## 2026-06-27 B1 AI/知识生成接口巡检

范围：

- `app/api/ai/chat/route.ts`
- `app/api/ai/test/route.ts`
- `app/api/knowledge/generate/route.ts`
- `app/api/knowledge/save/route.ts`
- `app/api/knowledge/evolve/route.ts`
- `app/api/admin/knowledge/evolve/route.ts`
- `app/api/admin/knowledge/seed-missing/route.ts`
- `app/admin/knowledge/generate/page.tsx`
- `app/admin/knowledge/candidates/page.tsx`
- `lib/ai/llm.ts`

结果：

- scoped lint：0 errors。
- build 通过。
- 公开的 `POST /api/knowledge/evolve` 已加管理员或 `CRON_SECRET` 保护，避免外部随意触发 AI 审稿/改写消耗 token。
- AI 客服聊天接口补充产品引用、知识引用、流式来源的明确类型，清理历史 `any`。
- DeepSeek 调用错误翻译、AI 测试接口、知识保存接口、知识进化接口均改为 `unknown` 错误收窄，避免异常对象格式不一致导致二次报错。
- B1 第一阶段完成；后续可继续查 `app/api/knowledge/auto-generate`、`backfill-current-month`、`extract` 等更偏批处理的知识接口。

## 2026-06-27 C1 产品前台资料展示巡检

范围：

- `app/(shop)/products/[slug]/page.tsx`
- `app/(shop)/products/coa/page.tsx`
- `app/(shop)/products/coa/CoaLookupForm.tsx`
- `app/(shop)/products/documents/page.tsx`
- `app/(shop)/products/page.tsx`
- `app/(shop)/products/elisa/page.tsx`
- `app/(shop)/products/serum/page.tsx`
- `app/(shop)/products/fbs/**`
- `app/(shop)/products/animal-serum/**`
- `app/(shop)/search/page.tsx`
- `app/api/products/coa/route.ts`
- `app/api/products/match/route.ts`
- `app/api/search/route.ts`
- `components/product/**` 中产品卡片、资料下载、血清展示相关组件

结果：

- scoped lint：0 errors，0 warnings。
- build 通过。
- 商品详情页已确认读取 `product_documents` 中 active 状态的说明书/COA，并保留旧 `datasheet_pdf` 兼容。
- COA 查询接口改为优先查询新 `product_documents` 表，再回退查询旧 `serum_coa_documents` 表；后台产品文档批次中心确认生效后的 COA 可以被前台 COA 查询页查到。
- 产品卡片和血清图片组件从 `<img>` 改为 `next/image`，保留图片失败兜底，减少列表和产品页图片加载 warning。
- 搜索页清理无用导入。

后续建议：

- 继续做 C2：产品搜索 API 和前台搜索页的特殊字符/希腊字母/货号精准匹配巡检。
- 再做 C3：商品详情编辑字段与前台展示字段逐项对照，确认后台填写的参数都有稳定展示位置。

## 2026-06-27 C2 产品搜索巡检

范围：

- `lib/products/search.ts`
- `app/api/search/route.ts`
- `app/api/products/match/route.ts`
- `app/(shop)/search/page.tsx`
- `components/search/AdvancedSearch.tsx`

结果：

- scoped lint：0 errors。
- build 通过。
- 已部署到阿里云，云端健康检查通过。
- 新增共享搜索工具，统一处理搜索词清洗、货号压缩、希腊字母/英文写法变体。
- `/api/search`、`/api/products/match`、前台搜索页改为使用同一套搜索变体规则。
- `AdvancedSearch` 修复 Hook lint：URL 参数初始化不再在 effect 中同步 setState。
- `availableSpecies` 参数开始真正生效，便于不同产品栏目控制可选种属。

云端 smoke test：

- `TNF-alpha` 与 `TNF-α` 均返回 21 条，首条为 `Human TNF-α ELISA kit（人肿瘤坏死因子-α ）`。
- `IFN gamma` 返回 19 条，首条为 `Mouse IFN-γ ELISA Kit`。
- `IL-1beta` 返回 22 条，首条为 `Human IL-1β ELISA Kit`。
- `LV-10011` 返回 1 条，货号变体可命中。

后续建议：

- C3：商品详情编辑字段与前台展示字段逐项对照。
- C4：搜索排序优化，优先展示货号精确匹配、靶标精确匹配、再展示名称/别名模糊匹配。

## 2026-07-02 G1 历史备份/废弃文件清理巡检

范围：

- `app/**/*.backup`
- `app/**/*.bak.*`
- `components/Navbar.tsx`
- 旧兼容路由：`/analysis`、`/ai-chat`、`/points`

结果：

- 已将 12 个历史页面备份文件归档到 `project-materials/99-archive/legacy-page-backups/2026-07-02-g1/`。
- 已确认业务代码不再引用这些 `.backup` / `.bak.*` 文件；`app` 目录当前未发现残留页面备份文件。
- `components/Navbar.tsx` 只是返回 `null` 的旧空壳组件，已移除；同步清理旧页面中的无效导入和调用。
- 保留 `/analysis`、`/ai-chat`、`/points` 三个兼容跳转入口，分别承接旧链接跳转到 `/lab/analysis`、`/chat`、`/member`，避免外部旧链接失效。
- scoped lint 通过。
- `npm run build` 通过。

备注：

- `app/api/admin/maintenance/backups` 属于真实后台备份功能，不纳入废弃文件清理。
- 本轮只清理确认无引用的历史备份和空壳组件，没有触碰仍承担兼容跳转的旧入口。
