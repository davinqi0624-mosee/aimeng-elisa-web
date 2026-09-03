# 新增产品品类：其他生化检测试剂

## 背景

用户希望在产品中心新增一个产品品类：其他生化检测试剂。

## 调整

- 在顶部导航“产品中心”下拉菜单中新增：
  - `其他生化检测试剂`
  - 路径：`/products/biochemical-reagents`
- 新增前台品类页面：
  - `app/(shop)/products/biochemical-reagents/page.tsx`
  - 覆盖酶法检测试剂、比色法检测试剂、小分子指标检测等方向。
  - 页面引导客户提供检测指标、样本类型、方法学、仪器条件和是否需要代测。
  - 目前先作为正式品类入口，不接入 ELISA 批量上传和说明书匹配链路，避免污染现有数据结构。
- 更新 AI 客服产品范围：
  - 将“其他生化检测试剂”加入服务范围。
  - 明确没有正式产品库数据时不得虚构货号、价格和库存，应建议人工确认。
- 更新健康检查：
  - 将 `/products/biochemical-reagents` 加入 `scripts/health-check.mjs`。

## 验证

- `npx eslint components/ui/Navbar.tsx app/(shop)/products/biochemical-reagents/page.tsx app/api/ai/chat/route.ts`
- `npm run build`

均已通过。
