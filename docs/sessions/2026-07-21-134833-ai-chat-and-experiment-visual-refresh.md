# 2026-07-21 AI 客服与实验方案页面视觉更新

## 背景

用户希望：

- AI 客服页面整体后方增加 AI 大脑科技图，透明度约 50%。
- AI 客服回答时，左侧蓝色圆形 AI 图标替换为二次元女客服透明图，并有轻微说话动效。
- 实验方案页面顶部工具条增加淡黄色半透明背景。
- 实验方案页面标题文字整体向右移动，左侧图片改成二次元客服图。

## 图片资源

从本地目录复制到网站公开资源：

- `/users/AM/爱萌广告图片/ai_brain_tech.png`
  - 复制为 `public/brand/ai-chat-brain-bg.png`
- `/users/AM/爱萌广告图片/anime_ai_customer_service_transparent.png`
  - 复制为 `public/brand/ai-chat-agent.png`
- `/users/AM/爱萌广告图片/anime_ai_customer_service.png`
  - 复制为 `public/brand/experiment-ai-assistant.png`

## 改动

- `app/(ai)/chat/page.tsx`
  - 整个聊天页增加固定背景图层，图片透明度 50%。
  - 加白色半透明覆盖层，保证文字仍清楚。
  - 助手头像改为二次元女客服透明图。
  - AI 正在回答时，头像轻微浮动，并显示嘴巴脉冲动效。

- `app/lab/layout.tsx`
  - 实验工具顶部导航条改为淡黄色半透明背景。

- `app/lab/experiment/page.tsx`
  - 顶部图标位改为二次元客服图。
  - 标题文字区域向右增加间距。

## 验证

- `npx eslint app/(ai)/chat/page.tsx app/lab/layout.tsx app/lab/experiment/page.tsx`
- `npm run build`

均已通过。
