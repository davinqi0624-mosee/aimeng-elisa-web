# 2026-07-22 实验方案生成器点击无反应修复

## 问题

用户反馈 `/lab/experiment` 页面点击「生成实验方案」没有反应。

## 根因

线上 `/api/experiment/generate` 在未登录状态下直接返回 `401 未登录`。实验方案生成器是面向客户的入口，客户未登录时也应该能先生成方案；登录只应该影响是否保存到个人历史记录。

## 修复

- `app/api/experiment/generate/route.ts`
  - 未登录用户不再直接返回 `401`。
  - 访客可以正常生成实验方案。
  - 已登录用户生成后仍尝试写入 `experiments` 表，保存成功后跳转详情页。
  - 未登录或保存失败时，直接把方案内容返回给前端，在当前页面展示。

- `app/lab/experiment/page.tsx`
  - 生成按钮显式设置 `type="button"`。
  - 接口非 2xx、JSON 异常、AI 调用异常时，按钮下方显示明确错误。
  - 生成中在按钮下方显示状态提示，避免用户以为页面无响应。

## 验证

- `npx eslint app/lab/experiment/page.tsx app/api/experiment/generate/route.ts`：通过。
- `npm run build`：通过。
- `npm run deploy:aliyun`：部署成功。
- 线上健康检查通过。
- 未登录请求线上接口测试通过：
  - 请求：细胞实验，HepG2 释放 VEGF 并形成血管相关设计。
  - 返回：`hasProtocol: true`
  - 方案长度：3703 字。
