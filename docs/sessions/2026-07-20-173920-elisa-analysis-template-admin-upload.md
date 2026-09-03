# 2026-07-20 17:39 ELISA 数据分析模板后台上传

## 背景

用户希望“ELISA 数据分析模板”不要每次都通过代码替换静态文件，后台最好有一个上传修改窗口，管理员可以直接替换最新版 Excel 模板。

## 本次改动

- 在系统设置页新增“ELISA 数据分析模板”配置卡片：
  - 显示当前模板名称和地址。
  - 支持下载检查。
  - 支持上传 `.xlsx/.xls` 后自动保存生效。
- 新增后台配置接口：`/api/admin/lab-template-settings`。
- 新增前台模板读取接口：`/api/lab/analysis/template`。
- 前台 `/lab/analysis` 的“下载 Excel 模板”改为优先读取后台配置，失败时回退到 `/downloads/AM-ELISA数据分析模板.xlsx`。
- 上传接口 `/api/admin/upload` 放开 Excel 文件类型。
- 存储清理工具增加对 `site_settings.lab_assets.elisa_analysis_template_url` 的引用识别，避免新版模板被误清理。
- 新增迁移：`supabase/migrations/052_lab_template_settings.sql`，为 `site_settings` 增加 `lab_assets` 配置。

## 验证

- `npx eslint app/admin/settings/page.tsx app/api/admin/upload/route.ts app/api/admin/lab-template-settings/route.ts app/api/lab/analysis/template/route.ts app/api/admin/storage-cleanup/route.ts app/lab/analysis/page.tsx`
- `npm run build`
- `npm run deploy:aliyun`
- 线上健康检查通过：`http://106.14.215.238`
- 线上模板接口返回默认模板兜底：`/api/lab/analysis/template`
- 静态默认模板下载返回 `200 OK`。

## 后续

需要在 Supabase SQL Editor 执行 `supabase/migrations/052_lab_template_settings.sql`。执行前前台模板下载不受影响，但后台上传后无法保存到 `lab_assets`；执行后后台模板上传窗口即可正式生效。
