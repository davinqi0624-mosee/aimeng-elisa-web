# Product Document Exact Match Repair

## 时间
2026-07-14 08:03 CST

## 问题
后台“产品文档管理”上传 2 个说明书 PDF 后，文件一直停留在“待匹配”，自动匹配没有把文件绑定到产品；前台产品页显示“说明书暂缺”。

涉及文件：
- `LV220001-Capra hircus LPS Elisa Kit.pdf`
- `LV220002-Capra hircus DAO Elisa Kit.pdf`

## 排查结果
- 两个 PDF 已成功上传到 `product_documents`。
- 文件名中的货号解析正确：
  - `LV220001`
  - `LV220002`
- 产品表中对应货号也存在：
  - `LV220001` -> `Capra-hircus LPS ELISA Kit`
  - `LV220002` -> `Capra-hircus DAOLPS ELISA Kit`
- 问题出在自动匹配接口：原逻辑先加载产品列表再逐个匹配，精确匹配路径不够直接，容易导致后台匹配流程卡住或没有及时落库。

## 本次处理
- 优化 `/api/admin/products/documents/bind`：
  - 先读取待匹配文档。
  - 从文件名或文档记录中提取货号。
  - 优先按货号直接查询产品并精确绑定。
  - 只有货号无法命中时，才进入文件名相似度兜底匹配。
- 修复已上传的两个文件：
  - 绑定到对应产品。
  - `match_method` 设置为 `exact_catalog`。
  - `match_score` 设置为 `120`。
  - `status` 设置为 `active`。
  - 同步写入产品 `datasheet_pdf` 字段，保留兼容。

## 验证
- `npm run build` 通过。
- 已部署到 `http://106.14.215.238`。
- 部署健康检查通过。
- 数据库确认两份说明书均为 `active`。
- 前台确认：
  - `/products/lps-lv220001-2ba04284` 显示“下载说明书”。
  - `/products/daolps-lv220002-3180095a` 显示“下载说明书”。

## 后续操作
以后上传同类说明书后，点击“自动匹配”应优先按货号快速匹配。若匹配结果为待确认，仍需点击“确认生效”或“批量确认精确匹配”后前台才会显示。
