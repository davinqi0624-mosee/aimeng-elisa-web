# ELISA 数据分析模板替换

## 背景

用户希望替换“ELISA 实验数据分析工作台”中“下载 Excel 模板”按钮下载的模板文件。新模板位于：

```text
/Users/AM/AM-ELISA数据分析模板.xlsx
```

## 调整

- 将新模板复制到公开下载目录：
  - `public/downloads/AM-ELISA数据分析模板.xlsx`
- 修改 `app/lab/analysis/page.tsx`：
  - 原逻辑是在浏览器中动态生成 Excel 模板；
  - 现改为直接下载固定模板 `/downloads/AM-ELISA数据分析模板.xlsx`。
- 已校验源文件和公开下载文件 SHA-256 一致。

## 验证

- `npx eslint app/lab/analysis/page.tsx`
- `npm run build`
- 使用 `xlsx` 读取公开下载模板，工作表为 `ELISA数据模板`。

均已通过。
