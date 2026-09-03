# 2026-07-20 21:50 常用下载文件后台管理

## 背景

用户提出系统设置中的“ELISA 数据分析模板”上传区域可以扩展成模板文件上传入口，目前前台主要下载文件包括：

- 《ELISA 数据分析模板》
- 《代测申请表》

## 本次改动

- 将后台系统设置页的“ELISA 数据分析模板”卡片升级为“常用下载文件”。
- 后台新增两个固定文件位：
  - ELISA 数据分析模板：支持 `.xlsx/.xls`
  - ELISA 代测申请表：支持 `.docx/.doc/.pdf`
- 上传接口 `/api/admin/upload` 增加 Word 文件类型支持，并增加后缀兜底校验，避免不同浏览器 MIME 识别差异导致误拦截。
- `site_settings.lab_assets` 扩展默认配置：
  - `elisa_analysis_template_url/name`
  - `elisa_testing_service_form_url/name`
- 新增公开接口 `/api/downloads/service-forms`，前台代测申请表入口可读取后台最新版文件。
- 产品详情页的资料下载区、订购面板、搜索页“下载代测申请表”入口均改为优先读取后台配置，失败时使用默认静态文件。
- 存储清理工具增加 `lab_assets.elisa_testing_service_form_url` 引用保护，避免新版代测申请表被误清理。

## 验证

- `npx eslint` 通过相关文件检查。
- `npm run build` 通过。
- `npm run deploy:aliyun` 已部署到 `http://106.14.215.238`。
- 线上健康检查通过。
- 线上接口验证：
  - `/api/lab/analysis/template`
  - `/api/downloads/service-forms`
- 默认文件下载验证：
  - `/downloads/AM-ELISA数据分析模板.xlsx` 返回 200
  - `/downloads/AMUN-ELISA-testing-service-form.docx` 返回 200

## 注意

如果某个线上环境还没有执行 `supabase/migrations/052_lab_template_settings.sql`，后台上传保存会提示配置未初始化；前台仍会使用默认静态文件兜底。
