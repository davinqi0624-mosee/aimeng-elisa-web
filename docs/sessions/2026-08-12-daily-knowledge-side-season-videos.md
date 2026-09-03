# 每日知识页季节侧边视频

## 目标

在每日知识日历页面增加两个动态视频氛围位：

- 左侧：春夏交替
- 右侧：秋冬交替

中间日历稍微缩小，给左右视频留出空间；移动端不挤压日历。

## 实现

- 将本地视频复制到 `public/knowledge/`：
  - `spring-summer-transition.mp4`
  - `autumn-winter-transition.mp4`
- 在 `app/knowledge/KnowledgeCalendarClient.tsx` 增加 `SeasonalVideoPanel`。
- 页面主体改为桌面三栏：
  - 左侧视频
  - 中间日历内容
  - 右侧视频
- 视频使用 `autoPlay`、`muted`、`loop`、`playsInline`，用于浏览器静音自动播放。
- `xl` 以下屏幕隐藏侧边视频，手机和平板保持原单栏日历体验。
- 日历格子高度略微收紧，适配中间列宽度。

## 验证

- `npx eslint app/knowledge/KnowledgeCalendarClient.tsx` 通过。
- `npm run build` 通过。
