# 2026-08-14 页脚 Logo、域名后台入口与邮箱方案

## 用户诉求

- 说明网站自己的邮箱如何做，目前页面上的邮箱是假的，只用于接收客户咨询即可。
- 换成真实域名后，确认后台网址如何打开。
- 首页底部品牌区替换成桌面文件 `/Users/moses/Desktop/首页下方logo.png`，去掉图片蓝色背景。
- 页脚下方三个圆形按钮改成 logo 主色调的三种颜色。

## 本次修改

- 新增透明背景页脚 logo：
  - `public/brand/footer-logo-transparent.png`
  - 从桌面原图本地处理，去除大面积青蓝背景，保留 logo 主体和白色描边。
- 修改首页页脚：
  - `app/page.tsx`
  - 删除原来的方块 `A` 和 `AIMENG UNING` 文本组合。
  - 使用 `next/image` 加载 `/brand/footer-logo-transparent.png`。
  - 三个圆形入口分别使用 logo 主色：
    - 青蓝 `#42BDD8`
    - 紫色 `#6B4584`
    - 黄绿 `#E1E600`
  - 页脚邮箱占位改成 `service@animaluni.com`。
- 修复部署脚本健康检查地址：
  - `scripts/deploy-aliyun.mjs`
  - 默认使用 `https://animaluni.com` 做健康检查，不再使用服务器 IP，避免 Nginx 正式域名配置下误报 404。

## 后台入口

- 正式后台入口：
  - `https://animaluni.com/admin`
- 未登录时会跳转：
  - `https://animaluni.com/admin/login?next=%2Fadmin`

## 邮箱建议

- 推荐先启用一个正式收信邮箱：
  - `service@animaluni.com`
- 邮箱服务建议优先选阿里企业邮箱或腾讯企业邮箱。网站已经在阿里云解析，使用阿里企业邮箱配置最顺手。
- 正式启用时需要在域名 DNS 增加或确认：
  - MX 记录
  - SPF TXT
  - DKIM
  - DMARC

## 验证

- `npm exec eslint -- app/page.tsx` 通过。
- `npm run build` 通过。
- 已执行 `npm run deploy:aliyun`，应用服务已重启成功。
- 部署脚本旧健康检查使用 IP 导致误报，改用正式域名后：
  - `HEALTH_BASE_URL=https://animaluni.com node scripts/health-check.mjs` 通过。
  - 检查 23 个页面和 4 个 API，全部通过。
- 线上检查：
  - `https://animaluni.com` 返回 200。
  - `https://animaluni.com/brand/footer-logo-transparent.png` 返回 200。
  - `https://animaluni.com/admin` 返回 307，跳转到后台登录页，符合权限保护预期。
