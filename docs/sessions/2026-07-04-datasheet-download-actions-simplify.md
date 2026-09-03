# 说明书生成下载动作精简

日期：2026-07-04

## 背景

“说明书生成”页面底部同时出现：

- 下载当前 Word 模板
- 下载正式 PDF
- 下载正式 Word

这会让管理员产生选择障碍。当前说明书英文简介需要管理员下载 Word 后人工翻译补全，因此 PDF 不是最终完整文件；同时 Word 转 PDF 后版式页数会变化，不适合作为正式出口。

## 本次处理

- 从后台“说明书生成”常用操作区移除“下载正式 PDF”。
- 删除 `/api/datasheet/pdf` 路由，避免隐藏入口继续存在。
- 从后台“说明书生成”常用操作区移除“下载当前 Word 模板”。
- 保留“下载正式 Word”作为该页面唯一正式下载出口。
- 模板下载接口保留，但权限收紧为仅超级管理员可访问；后续可迁移到“模板维护/系统设置”等低频高权限位置。
- 顺手修复模板下载接口中的 `any` lint 问题，改为标准 Web Stream。

## 验证

- `npm run lint -- app/admin/datasheet/page.tsx app/api/datasheet/templates/download/route.ts`
- 确认页面和接口中无 `下载正式 PDF`、`下载当前 Word 模板`、`api/datasheet/pdf` 残留。
- `npm run build` 通过；构建路由列表中已无 `/api/datasheet/pdf`。
