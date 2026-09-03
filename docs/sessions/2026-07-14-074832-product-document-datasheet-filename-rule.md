# Product Document Datasheet Filename Rule

## 时间
2026-07-14 07:48 CST

## 背景
产品说明书已经批量生成，实际文件名格式为：

`LV190001-zebrafish aqp1 Elisa Kit.pdf`

后台“产品文档管理”原提示仍写着“说明书命名：货号.pdf”，并且旧解析逻辑可能把 `LV190001-zebrafish` 当成货号，影响自动匹配。

## 本次处理
- 将后台提示改为：`说明书命名：货号-Product name.pdf`。
- 将说明书示例改为：`LV10001-zebrafish aqp1 Elisa Kit.pdf`。
- 修改说明书文件名解析逻辑：
  - 支持 `货号.pdf`。
  - 支持 `货号-Product name.pdf`。
  - 自动匹配时只提取文件名前缀货号，例如从 `LV190001-zebrafish aqp1 Elisa Kit.pdf` 提取 `LV190001`。
  - Product name 只作为文件说明，不参与说明书唯一匹配。
- COA 规则保持不变：`货号_批次号_COA.pdf`。

## 验证
- `npm run build` 通过。
- 已部署到 `http://106.14.215.238`。
- 部署健康检查通过。
- `http://106.14.215.238/admin/product-documents` 返回 200。

## 操作说明
说明书可以按当前文件名上传，例如：

`LV190001-zebrafish aqp1 Elisa Kit.pdf`

上传后点击“自动匹配”，系统会按 `LV190001` 匹配商品；匹配结果仍需要管理员点击“确认生效”后前台可见。
