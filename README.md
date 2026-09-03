# 上海爱萌优宁生物技术有限公司官网

这是上海爱萌优宁生物技术有限公司的 Next.js 企业官网项目。网站定位不是传统产品检索站，而是围绕 ELISA 产品、AI 科研助手、实验数据分析、文献积分、客户账户、代理商和后台运营形成的功能型平台。

## 技术基线

- Next.js `16.2.4`
- React `19.2.4`
- TypeScript
- Supabase
- Tailwind CSS 4
- ECharts / Recharts
- OpenAI SDK

本项目遵循 `AGENTS.md` 的要求：修改 Next.js 相关代码前，先阅读 `node_modules/next/dist/docs/` 中对应的本地文档。当前已按 Next 16 文档把请求拦截入口迁移到 `proxy.ts`，并显式设置 `turbopack.root`，避免多 lockfile 环境下根目录误判。

## 当前模块

- 企业首页与动态内容编辑
- 产品搜索、产品详情、种属和关键字筛选
- AI 客服、文档、历史记录、AI 仪表盘
- 实验方案生成
- 4PL 拟合、OD 值计算、标准曲线和报告生成
- 文献上传、引用统计、排行榜和知识库
- 积分商城、积分兑换和订单管理
- 会员注册、登录、退出和会员中心
- 后台管理：产品、用户、订单、文献、页面、知识候选、代理商、商城
- 全国代理商展示

## 接手后的优先级

1. 统一全站信息架构和导航入口，避免首页、商城、实验室和后台之间出现重复入口或路径不一致。
2. 清理 lint 错误，优先处理应用代码中的 React 19 纯渲染规则、`any` 类型和未使用代码。
3. 稳定核心闭环：注册登录、产品检索、AI 咨询、实验分析、报告生成、积分发放、商城兑换、后台审核。
4. 完善数据库迁移和环境变量说明，让本地、Vercel、Supabase 三套环境可复现。
5. 提升首页和核心工作台体验，突出“AI + ELISA 科研服务平台”的差异化定位。

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npm run health
npm run doctor
```

## 自动体检

- `npm run health`：访问关键前台页面和接口，检查页面是否可打开、导航是否统一、前台是否暴露后台文字、每日知识当月是否缺失。
- `npm run doctor`：先执行生产构建，再执行网页体检，并生成 `reports/site-doctor-latest.md` 报告。
- 本地体检前需要先运行 `npm run dev`，默认检查 `http://localhost:3000`。检查线上测试站时可使用 `HEALTH_BASE_URL=https://你的测试域名 npm run health`。

自动修复原则：只让脚本自动做低风险兜底，例如每日知识当月缺失时返回系统备用内容；涉及数据库写入、生产环境代码修改、用户数据变更的修复，必须经过人工确认或管理员密钥授权。

## 当前验证状态

- `npm run build`：通过
- `npm run health`：通过
- `npm run doctor`：通过，报告位于 `reports/site-doctor-latest.md`
- `npm run lint`：仍有应用代码 lint 错误，需要分模块逐步清理
