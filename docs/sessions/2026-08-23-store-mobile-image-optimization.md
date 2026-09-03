# 积分商城手机图片加载优化

日期：2026-08-23

## 问题

- 积分商城商品图片多数为 PNG，单张约 300KB-1.2MB。
- 后台虽然调用了图片压缩，但 PNG 仍按无损 PNG 输出，实际压缩收益很低。
- 商城列表直接加载完整原图，手机首次打开时需要下载较多数据。

## 实施内容

- 后台商城图片上传统一转换为 WebP。
- 新图最长边限制为 1000px，目标体积不超过约 460KB，并在后台显示压缩前后体积。
- Storage 图片使用一年缓存；文件路径带时间戳，不会因长缓存显示旧图。
- 商城列表使用 Supabase 图片转换接口并启用懒加载，卡片图片最大请求宽度限制为 640px。
- 点击商品图后才加载最高 1200px 的详情预览图。
- 增加 `scripts/optimize-shop-images.mjs`，默认仅预览，使用 `--apply` 才会上传 WebP 并更新数据库。

## 数据迁移结果

- 商城图片：61 张。
- 成功转换：61 张。
- 失败：0 张。
- 原体积：29.52MB。
- 优化后体积：2.25MB。
- 减少：27.27MB，约 92%。
- 数据库中的 61 个 `shop_items.image_url` 已全部切换到 `/shop/optimized/.../*.webp`。
- 原始图片暂时保留在 Storage 中，便于需要时回退；本次没有删除原图。

## 验证

- 目标文件 ESLint：0 errors，仅后台既有 `<img>` 警告。
- `npm run build`：通过。
- `npm run deploy:aliyun`：部署成功。
- 线上健康检查：23 个页面、4 个 API 全部通过。
- `https://animaluni.com/store`：HTTP 200，页面响应约 0.05 秒。
- `https://animaluni.com/api/shop/items`：61/61 张图片均为优化后的 WebP。
- 640px 手机尺寸 CDN 预热：61/61 成功。

## 后续操作

后台以后重新上传商城图片时会自动生成 WebP，不需要管理员手工压缩。若需要再次扫描历史图片：

```bash
npm run optimize:shop-images
npm run optimize:shop-images -- --apply
```
