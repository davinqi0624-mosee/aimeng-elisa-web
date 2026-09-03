# Product Image Upload Compression

## 时间
2026-07-19 09:49 CST

## 问题
后台“产品图片”上传 1.8MB 图片体感很慢。当前链路为浏览器上传到网站服务器，服务器读取整图、计算哈希，再上传到 Supabase Storage。图片虽然不大，但如果原图是 PNG 或像素尺寸较大，服务器中转和后续存储仍会拖慢体验。

## 处理
- `lib/image-compress.ts`
  - 图片压缩工具新增 `outputType` 参数，支持指定输出 WebP。
- `app/admin/product-assets/page.tsx`
  - 产品图片批量上传前先在浏览器端压缩。
  - 默认转为 WebP，最长边 1800px，目标约 0.9MB。
  - 如果压缩后反而更大，则保留原图。
  - 上传提示增加“处理中/上传中”和压缩前后大小。
  - 固定图片位上传也使用同一压缩逻辑。
- `lib/products/asset-naming.ts`
  - 文件名解析补充 `.webp` 后缀识别，避免压缩后影响自动匹配。

## 验证
- `npx eslint app/admin/product-assets/page.tsx lib/image-compress.ts lib/products/asset-naming.ts` 通过。
- `npm run build` 通过。
