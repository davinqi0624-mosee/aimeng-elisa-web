# 2026-07-21 实验工具顶部栏与实验方案图标调整

## 背景

用户截图反馈：

- 实验工具页顶部公共栏左侧 `AIMENG UNING` 品牌入口重复且占空间，需要去掉。
- 实验方案生成器标题左侧的深蓝烧瓶图标不够符合年轻学生用户审美，希望替换成用户提供的 AI 女客服图片。

## 改动

- 更新 `app/lab/layout.tsx`
  - 移除顶部栏左侧 `AIMENG UNING` 首页入口。
  - 保留右侧实验工具导航：酶标板计算器、方案生成、数据分析。
- 更新 `app/lab/experiment/page.tsx`
  - 标题左侧烧瓶图标卡替换为图片头像卡。
  - 图片读取路径为 `/brand/experiment-ai-assistant.png`。
  - 图片缺失时显示 `AI` 兜底，不出现破图。

## 注意

当前本机尚未拿到用户截图中那张 AI 女客服原图文件。需要将图片放入：

`public/brand/experiment-ai-assistant.png`

后重新部署即可显示原图。

## 验证

- `npx eslint app/lab/layout.tsx app/lab/experiment/page.tsx`
- `npm run build`

均通过。
