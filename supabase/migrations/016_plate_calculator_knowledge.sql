-- Update/add knowledge article about plate calculator based on product manual
INSERT INTO daily_knowledge (
  date, title, summary, content, category, tags,
  quality_score, source_type, lifecycle_status, expires_at, is_featured
) VALUES
(
  '2026-05-02',
  'ELISA 酶标板孔数精确计算：8 点标准曲线方案',
  '基于 AIMENG UNING 产品说明书，详解 8 点标准曲线（S1-S7 + Blank）的酶标板孔数计算方法，帮助实验人员精准采购。',
  '## AIMENG UNING 产品说明书确认的标准品设计

- **8 个浓度点**：S1、S2、S3、S4、S5、S6、S7 + Blank
- **说明书推荐**：标准品和样本均做双孔检测

## 精确计算公式

```
总需求孔数 = 标准品孔数 + 空白对照孔 + 样本数 × 样本平行次数
```

### 各项参数说明

**标准品孔数**
- 单孔操作：8 孔（S1-S7 各 1 孔 + Blank 1 孔）
- 双孔操作（说明书推荐）：16 孔（S1-S7 各 2 孔 + Blank 2 孔）

**空白对照孔**
- 单孔操作：1 孔
- 双孔操作（说明书推荐）：2 孔

**样本平行次数**
- 不做平行：× 1（单孔）
- 双孔平行：× 2（推荐）
- 三孔平行：× 3（高精度要求）

## 典型计算示例

| 样本数 | 标准品 | 样本平行 | 空白 | 总孔数 | 推荐方案 |
|--------|--------|----------|------|--------|----------|
| 10 | 双孔 | 双孔 | 2 | 38 | 1 块 48T |
| 20 | 双孔 | 双孔 | 2 | 58 | 1 块 96T 或 2 块 48T |
| 30 | 双孔 | 双孔 | 2 | 78 | 1 块 96T |
| 40 | 双孔 | 双孔 | 2 | 98 | 2 块 96T 或 1 块 96T + 1 块 48T |
| 50 | 双孔 | 双孔 | 2 | 118 | 2 块 96T |

## 在线计算器

AIMENG UNING 官网已上线「酶标板孔数计算器」：
- 自动计算标准品、空白、样本所需孔数
- 智能推荐 48T / 96T 购买方案
- 显示余量和分批建议

访问路径：首页 → 实验室工具 → 孔数计算

## 常见误区

1. **忽略 Blank 孔**：Blank 是标准曲线的一部分，不可省略
2. **标准品做单孔**：低浓度点（S6-S7）单孔误差大，强烈建议双孔
3. **不考虑边缘效应**：96T 板边缘孔蒸发快，预留 2-4 孔余量更稳妥
4. **样本与标准品不同步**：标准品和样本应在同一块板上检测，避免板间差异',
  '操作技巧',
  ARRAY['酶标板', '孔数计算', '标准曲线', '48T', '96T'],
  0.88, 'manual', 'active', now() + interval '3 months', true
)
ON CONFLICT (date) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  quality_score = EXCLUDED.quality_score,
  source_type = EXCLUDED.source_type,
  lifecycle_status = EXCLUDED.lifecycle_status,
  expires_at = EXCLUDED.expires_at,
  is_featured = EXCLUDED.is_featured,
  updated_at = now();
