# 存储空间清理安全改造

时间：2026-07-10

背景：

后台“存储空间清理”原先点击后直接删除数据库中未引用的 Storage 文件，确认提示为“此操作不可撤销”。管理员很难判断孤儿文件是否真的可删，存在误删风险和心理负担。

本轮处理：

- `app/api/admin/storage-cleanup/route.ts`
  - 默认改为预览模式：`confirmDelete: false` 时只扫描，不删除
  - 只有传入 `confirmDelete: true` 才会执行删除
  - 删除范围默认限定为 `deleteScope: recommended`，只删除系统判断为低风险、建议删除的文件
  - 返回疑似未引用文件列表，包含：
    - bucket
    - path
    - publicUrl
    - fileName
    - riskLevel
    - recommendation
    - confidence
    - actionLabel
    - reason
  - 返回本次已检查的数据表字段来源
  - 对产品文档目录文件标记为“需确认”，提醒可能是尚未绑定的说明书/COA
  - 扩大引用识别范围，新增检查：
    - `product_images.image_url`
    - `purchase_point_claim_photos.file_url`
    - `purchase_point_claim_photos.file_path`
  - 引用匹配同时支持完整 URL、编码 URL、bucket/path、相对 path，降低误判概率

- `app/admin/dashboard/page.tsx`
  - 按钮从“开始清理”改为“扫描可清理文件”
  - 扫描结果展示疑似未引用文件路径、风险提示、判定原因
  - 扫描结果拆分为“系统建议删除”和“人工确认”
  - 每个文件显示处理建议和系统置信度，减少维护人员凭经验判断的压力
  - 增加“本次已检查的引用来源”展开项
  - 固定显示“扫描后的操作”区域，避免扫描结果为 0 时管理员看不到下一步
  - “删除系统建议文件”按钮始终可见；没有可删除文件时置灰并说明原因
  - “查看人工确认文件”按钮始终可见；没有待确认文件时置灰并说明原因
  - 文件预览支持“全部 / 建议删除 / 人工确认”筛选
  - 文件预览增加“打开文件”入口，便于管理员人工判断文件内容
  - 删除按钮不会删除“人工确认”文件
  - 二次确认文案明确提醒：人工确认文件会保留，手工写死链接、外部页面、富文本内容、新功能字段可能无法自动识别

验证：

- `npm exec eslint -- app/api/admin/storage-cleanup/route.ts app/admin/dashboard/page.tsx`
- `npm run build`

结论：

存储清理已从高风险的一步删除，改为“扫描预览 -> 人工判断 -> 二次确认删除”的安全流程。
