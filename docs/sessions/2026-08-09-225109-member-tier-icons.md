# 会员等级图标替换

## 背景

用户提供 4 张本地图片，希望分别作为青铜、白银、黄金、铂金会员图标。

## 本次修改

- 将桌面图片复制到网站静态资源目录：
  - `/brand/member-tiers/bronze.png`
  - `/brand/member-tiers/silver.png`
  - `/brand/member-tiers/gold.png`
  - `/brand/member-tiers/platinum.png`
- 更新 `app/(user)/member/page.tsx`：
  - 当前会员等级使用较大图片徽章。
  - 四个等级权益卡使用对应小图片徽章。
  - 保留原等级颜色用于进度条展示。

## 验证

- `npm run lint -- 'app/(user)/member/page.tsx'`
  - 通过。
- `npm run build`
  - 通过。
