# 英文说明书模板硬编码修复

日期：2026-07-03

## 背景

后台“说明书生成”导出的英文版说明书中，Human IL-8 产品仍出现模板残留：

- `Reactivity: Mouse`
- `Specificity: it can detect Mouse ...`
- `Introduction` 段仍为 IL-1beta 的旧模板内容

原因确认：`AIMENG_ELISA_datasheet_template_v1.0.docx` 英文页中存在硬编码内容，并非管理员输入错误。

## 本次处理

- 新增 `lib/datasheet/english.ts`，统一生成英文说明书字段：
  - `reactivity_en`
  - `specificity_en`
  - `application_en`
  - `target_intro_en`
- 在 `app/api/datasheet/generate/route.ts` 保存说明书时同步写入英文字段，便于后续模板占位符升级。
- 在 `lib/datasheet/docx.ts` 增加 DOCX 渲染兜底：
  - 常规占位符正常替换。
  - 如果模板英文页仍残留 `Mouse`、旧特异性、旧用途、IL-1beta 简介，会在导出前重写对应段落。
  - 避免以后模板漏放占位符时继续生成错误英文内容。

## 验证

- `npm run lint -- lib/datasheet/docx.ts lib/datasheet/english.ts app/api/datasheet/generate/route.ts`
- 使用 Human IL-8 测试数据实际渲染 DOCX 并解包检查：
  - `Reactivity: Mouse`：false
  - `Mouse IL-8`：false
  - `IL-1beta / Interleukin-1beta`：false
  - 英文 `Reactivity / Specificity / Application / Introduction` 均替换为 Human IL-8 对应内容。
- `npm run build` 通过。

## 后续建议

后续最好把 Word 模板英文页也正式改成 `{{reactivity_en}}`、`{{specificity_en}}`、`{{application_en}}`、`{{target_intro_en}}` 占位符。当前代码兜底已经可以防止错误导出，但模板源文件规范化后更便于长期维护。
