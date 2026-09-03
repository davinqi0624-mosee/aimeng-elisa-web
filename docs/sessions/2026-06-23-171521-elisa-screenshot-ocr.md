# ELISA 截图识别修复记录

## 背景

用户在 `/lab/analysis` 页面把检测结果截图粘贴到数据输入框，页面没有反应。检查后确认原页面中的“截图识别”只是提示文案，没有实际 OCR 接口，也没有绑定粘贴、拖拽或图片上传事件。

## 修改内容

- 新增 `app/api/lab/analysis/ocr/route.ts`
  - 接收 PNG/JPG/WebP 图片。
  - 限制图片大小为 8MB。
  - 通过 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_VISION_MODEL` 调用 OpenAI 兼容视觉模型。
  - 要求模型输出可被现有 ELISA 解析器读取的纯文本表格。
  - 对额度不足、密钥错误、模型不支持视觉、图片过大等情况返回中文错误提示。

- 修改 `app/lab/analysis/page.tsx`
  - 增加“上传截图识别”按钮。
  - 数据输入框支持直接粘贴截图。
  - 数据输入框支持拖入截图。
  - 识别成功后自动把表格文本填入原数据框，继续使用现有 4PL/5PL/线性拟合流程。
  - 修复宽表解析中“标准品复孔列”可能被误判为样本列的问题。

## 验证

- `npm run build` 通过。
- `node scripts/verify-elisa-4pl.mjs` 通过，R² 约为 `0.9998715`。
- 已部署到阿里云服务器 `106.14.215.238`。
- 云端 `HEALTH_BASE_URL=http://106.14.215.238 npm run health` 通过，22 个页面和 4 个 API 全部正常。
- 云端 `/lab/analysis` 返回 `200 OK`。

## 云端部署备注

- 线上应用目录：`/opt/aimeng-elisa-web/app`
- 服务管理：`systemd` 的 `aimeng-elisa-web.service`
- 本次发现 PM2 中残留了旧的 `aimeng-elisa-web` 进程，占用 `127.0.0.1:3000`，导致 systemd 服务无法启动。
- 已删除 PM2 旧进程、保存空 PM2 列表，并禁用 `pm2-root` 开机自启。
- 当前云端只保留 systemd 管理 Next.js 服务，避免以后两个进程抢 3000 端口。
- 发布前的旧版本已备份为 `/opt/aimeng-elisa-web/app.prev.20260623172428`。

## 使用方式

1. 打开 `/lab/analysis`。
2. 点击“上传截图识别”，或点击数据输入框后直接粘贴截图。
3. 识别出的表格会自动填入数据框。
4. 核对数字后点击“开始 4PL 拟合”。
