# 积分商城商品分类筛选

日期：2026-08-28

## 需求

- 在商城顶部按商品类别筛选，减少客户浏览大量商品的时间。
- 后台新增或编辑商品时必须选择分类。
- 为已有积分商城商品按名称和描述自动归类。

## 分类

已建立固定分类代码和中文名称：数码通信、电脑配件、文具办公、运动户外、生活用品、食品饮料、个护美妆、家居家电、旅行用品、一次性用品、实验科研、礼品卡券、服饰配件、其他。

## 代码改动

- `lib/shop/categories.ts`：统一分类常量、类型、校验和显示名称。
- `app/api/admin/shop/route.ts`：新增商品校验分类；编辑未分类历史商品时要求先选择分类；记录分类审计信息。
- `app/admin/shop/page.tsx`：新增/编辑表单增加必选分类，后台列表展示分类。
- `app/(shop)/store/page.tsx`：新增“全部商品”和分类筛选，移动端分类栏横向滚动，商品卡片显示分类标签。
- `scripts/classify-shop-items.mjs`：已有商品分类预览和安全写入脚本，默认只预览，使用 `--apply` 才写入。
- `package.json`：新增 `npm run classify:shop-items`。

## 数据库状态

新增 `supabase/migrations/066_shop_item_categories.sql`，包含：

1. 创建 `shop_items.category` 字段和合法分类约束。
2. 按商品名称/描述自动为历史商品归类。
3. 建立分类索引。
4. 将分类字段设为必填。

本次尝试通过项目已有的 `exec_sql` RPC 执行时，线上返回 `Could not find the function public.exec_sql(sql)`，因此迁移尚未写入 Supabase。应用代码已部署，但线上接口当前仍返回 69 个无分类字段的商品。

需要在 Supabase Dashboard 的 SQL Editor 中执行完整文件 `supabase/migrations/066_shop_item_categories.sql`。执行完成后，运行：

```bash
npm run classify:shop-items
```

确认结果无误后无需再执行 `--apply`，因为迁移文件已包含历史数据归类；若后续手动新增了未分类数据，再使用：

```bash
npm run classify:shop-items -- --apply
```

## 验证

- `npm run build`：通过。
- 目标 ESLint：无错误；后台页面保留 2 个既有 `<img>` 性能警告。
- 生产部署：已完成，`https://animaluni.com` 服务运行正常。
- 健康检查：23 个页面和 4 个 API 全部通过。
- 线上 `/store`：HTTP 200。
- 线上 `/api/shop/items`：HTTP 200，返回 69 个 active 商品；分类字段需执行迁移后生效。
