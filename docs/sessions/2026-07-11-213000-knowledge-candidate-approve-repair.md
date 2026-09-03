# 知识候选审核收录修复

时间：2026-07-11 21:30 CST

## 问题

- 后台“知识候选审核”中点击“一键发布”提示操作失败。
- 管理员不清楚“一键发布”到底发布到哪里，是否会进入 AI 客服知识库。
- 待审核知识会越来越多，需要有清理路径。

## 根因

- 原“一键发布”写入 `daily_knowledge`。
- `daily_knowledge.date` 有唯一约束，同一天只能有一条每日知识；多个候选都用当天日期写入，第二条开始会触发 `daily_knowledge_date_unique` 冲突。
- AI 客服当前检索主逻辑优先走 `match_knowledge`，失败后 fallback 到 `knowledge_base` 关键词检索；因此客服候选更应该进入 `knowledge_base`，而不是挤占每日知识文章表。

## 修复

- `app/api/admin/knowledge/candidates/route.ts`
  - 审核通过不再写入 `daily_knowledge`。
  - 改为写入 `knowledge_base`，作为 AI 客服可检索知识库内容。
  - 候选状态改为 `approved`，备注中记录 `knowledge_base_id`。
  - 增加 `delete` 动作，用于清理已收录/已拒绝的候选记录。

- `app/admin/knowledge/candidates/page.tsx`
  - 按钮文案从“一键发布”改为“收录到 AI 知识库”。
  - “已通过”标签改为“已收录”。
  - 移除暂未实现的“编辑后发布”“合并到现有”按钮，避免误操作。
  - 已收录/已拒绝记录显示“删除记录”按钮。

## 验证

- `npm run build` 通过。
- 已部署到 `http://106.14.215.238`。
- 线上健康检查通过。
