# 说明书正式 PDF 下载与英文简介保守修复

日期：2026-07-04

## 背景

后台“说明书生成”的“打印 / 存PDF”原本调用浏览器 `window.print()`，实际打印的是后台网页预览，包含左侧后台导航和部分网页内容，不是最终正式说明书文件，因此保存 PDF 没有业务意义。

同时，英文说明书页存在两个问题：

- 智能检索生成的中文指标简介被带入英文页，导致英文 Introduction 混中文。
- 英文 Application 的样本类型也可能混入中文。

## 本次处理

### 正式 PDF

- 新增 `app/api/datasheet/pdf/route.ts`。
- PDF 不再来自后台网页打印，而是先生成正式 DOCX，再由服务器 LibreOffice 转为 PDF。
- 后台按钮调整：
  - “下载当前 Word 模板”
  - “下载正式 PDF”
  - “下载正式 Word”
- 未生成正式说明书前，PDF 按钮显示为不可用，避免误点。

### 英文页内容

- 修改 `lib/datasheet/english.ts`：
  - 如果简介素材是中文，不再自动编造英文简介。
  - 英文 Introduction 留空，供管理员下载后人工翻译填写。
  - 英文 Application 中的样本类型强制使用英文默认表达，避免混中文。
- 修改 `lib/datasheet/docx.ts`：
  - 旧草稿里即使已经存了混中文的 `application_en` 或 `target_intro_en`，导出时也会兜底清洗。
  - 继续防止模板残留 `Mouse`、`IL-1beta` 等旧内容。

## 服务器配置

已在阿里云服务器安装：

- `libreoffice-writer`
- `fonts-noto-cjk`

并通过 `soffice --headless --convert-to pdf` 冒烟测试，确认 Word 到 PDF 转换可用。

## 验证

- `npm run lint -- app/admin/datasheet/page.tsx app/api/datasheet/pdf/route.ts lib/datasheet/docx.ts lib/datasheet/english.ts app/api/datasheet/docx/route.ts`
- Human il-8 测试 DOCX 解包检查：
  - 英文封面不含中文
  - 不含 `IL-1beta / Interleukin-1beta`
  - Application 使用英文样本类型
  - Introduction 不再填入错误英文或中文简介
- `npm run build`
- 云端部署健康检查通过。
- 服务器 Word 转 PDF 冒烟测试通过。
