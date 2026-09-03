# 2026-07-16 13:14 产品文档未匹配文件可视化与重复记录清理

## 背景

后台产品文档批次显示“10 个文件需要检查货号”，但页面没有直接列出是哪 10 个文件。

## 核查结果

最新批次：

- 批次 ID：`ea9286e3-8889-4356-bf62-2d02fb5344be`
- 标题：说明书批量上传 110 个文件
- 实际进入后台：109 个

这 10 个所谓“需要检查货号”的文件并不是缺少说明书，而是重复上传：

- `LV70342-Porcine Mesothelin Elisa Kit.pdf`
- `LV70343-Porcine MFGE8 Lactadherin Elisa Kit.pdf`
- `LV70344-Porcine MIA Elisa Kit.pdf`
- `LV70345-Porcine MICA Elisa Kit.pdf`
- `LV70346-Porcine MICB Elisa Kit.pdf`
- `LV70347-Porcine Midkine Elisa Kit.pdf`
- `LV70348-Porcine MIF Elisa Kit.pdf`
- `LV70349-Porcine MIG CXCL9 Elisa Kit.pdf`
- `LV70350-Porcine MIP-1α Elisa Kit.pdf`
- `LV70351-Porcine MIP-1β CCL4 Elisa Kit.pdf`

这些货号已经在上一批次中有 active 说明书。重复记录已归档。

另外发现 1 条错误相似匹配：

- `LV70440-Porcine sICAM-1Elisa Kit.pdf` 曾被错误匹配到 `LV70597`
- 已取消错误匹配
- 当前原因：产品库没有 `LV70440` 对应 active 产品

## 本次调整

- 后台状态筛选新增“需检查货号”。
- 批次中心“X 个文件需要检查货号”可以点击，直接筛出具体文件。
- 自动匹配接口修正统计逻辑：只有数据库更新成功的记录才计入 matched。
- 对重复上传导致唯一键冲突的文档，自动归档并返回 `duplicateArchived` 数量。
- 上传完成和手动自动匹配后的提示增加重复归档/失败数量。

## 当前线上状态

- 最新批次总记录：109
- 已上架：98
- 重复上传已归档：10
- 仍需检查货号：1
- 需检查文件：`LV70440-Porcine sICAM-1Elisa Kit.pdf`

## 验证

- `npm run build` 通过。
- `npm run deploy:aliyun` 已部署到 `http://106.14.215.238`。
- 健康检查通过。
