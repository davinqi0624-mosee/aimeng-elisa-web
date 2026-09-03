# 2026-06-27 Product Document Review Workflow

## 背景

用户提出：PDF 批量上传后，如何确认文件是否对应正确；如果对应错误，是否有机制提醒管理员修改，而不是一个个打开商品前台页面检查。

## 处理原则

自动匹配只应该给出候选结果，不能直接发布到客户前台。管理员需要在后台复核文件、候选商品和匹配原因，确认后才生效。

## 已完成

- `app/api/admin/products/documents/bind/route.ts`
  - 自动匹配从“直接 active 生效”改为“保持 pending 待确认”。
  - 匹配原因中标记“待管理员确认后生效”。
  - 前台商品详情只读取 `active` 文件，因此待确认文件不会被客户看到。

- `app/api/admin/product-documents/route.ts`
  - GET 列表自动附带候选商品摘要：
    - 商品名称
    - 靶标
    - 货号
  - 新增 PATCH 操作：
    - `confirm`：确认生效。
    - `reset`：撤回匹配，清空候选商品和匹配分。
    - `archive`：归档错误或废弃文件。
  - 确认说明书生效时，会把同一商品旧的 active 说明书归档。
  - 确认 COA 生效时，会把同一商品同一批次旧的 active COA 归档。

- `app/admin/product-documents/page.tsx`
  - 待处理列表展示“待匹配 / 待确认 / 已生效 / 已归档”状态。
  - 展示候选商品，不再只显示 product_id。
  - 增加操作按钮：
    - 查看文件
    - 确认生效
    - 撤回匹配
    - 归档
  - 页面提示：自动匹配只是候选结果，必须确认后客户前台才会看到。

## 验证

- 局部 lint 通过：
  - `app/api/admin/product-documents/route.ts`
  - `app/api/admin/products/documents/bind/route.ts`
  - `app/admin/product-documents/page.tsx`
- `npm run build` 通过。

## 当前机制

管理员无需逐个打开商品前台页面检查。推荐审核路径：

1. 上传 PDF。
2. 点击自动匹配。
3. 在产品文档管理页查看候选商品、文件名、货号、批次号、匹配理由。
4. 点“查看文件”确认内容。
5. 正确则点“确认生效”。
6. 错误则点“撤回匹配”或“归档”。

## 下一步

继续升级为批次中心：

- 每次上传生成批次号。
- 展示本批次成功、失败、待匹配、待确认、已生效数量。
- 支持批量确认“货号精确匹配”的文件。
- 对低分匹配、无货号、重复冲突文件单独列为异常。
