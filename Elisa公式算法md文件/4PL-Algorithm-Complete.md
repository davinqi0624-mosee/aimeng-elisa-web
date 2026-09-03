# 4PL 标准曲线拟合算法（对齐 ELISACalc 软件逻辑）

## 一、数学模型

### 1. 四参数 Logistic（4PL）公式

ELISACalc 软件使用的标准 4PL 模型：

```
Y = D + (A - D) / (1 + (X / C)^B)
```

或等价形式：

```
Y = (A - D) / (1 + (X / C)^B) + D
```

其中：

| 参数 | 名称 | 生物学意义 |
|------|------|-----------|
| **A** | Bottom / 下渐近线 | 空白对照的 OD 值（X→0 时的 Y 极限值） |
| **B** | Hill 斜率 | 曲线的陡峭程度，反映抗原-抗体结合亲和力 |
| **C** | EC50 / 拐点浓度 | 半数最大结合时的浓度，曲线拐点处 |
| **D** | Top / 上渐近线 | 饱和状态下的最大 OD 值（X→∞ 时的 Y 极限值） |

### 2. 参数命名对照

你的代码命名（A=Bottom, D=Top）与常规 4PL 命名相反，**这是正常的**——不同软件对 A/D 的定义可能互换：

- **你的代码**: `Y = D + (A-D)/(1+(X/C)^B)` 其中 A=Bottom(小), D=Top(大)
- **ELISACalc**: 相同公式，A=最小 OD, D=最大 OD
- **GraphPad**: `Y = Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))`

**核心一致**：都是 Sigmoidal 曲线，只是参数命名差异。

---

## 二、数据准备（对齐 ELISACalc 输入格式）

### 1. 标准品数据

| 浓度 X (pg/mL) | OD 值 Y |
|----------------|---------|
| 0 (Blank)      | 0.0323  |
| 156            | 0.1004  |
| 312            | 0.2003  |
| 625            | 0.3464  |
| 1250           | 0.5472  |
| 2500           | 0.8945  |
| 5000           | 1.3647  |
| 10000          | 1.9448  |

**关键规则**：
- 浓度列必须包含 **0 点（Blank）**，用于确定 A（Bottom）参数
- 浓度点数量 **≥ 4 个**（4PL 有 4 个参数需要拟合）
- 浓度通常按 **2 倍梯度稀释**（如 10000, 5000, 2500, 1250, 625, 312, 156, 0）

### 2. 未知样本数据

只需要 OD 值（Y），通过 4PL 反函数计算浓度（X）。

---

## 三、4PL 反函数（由 Y 计算 X）

ELISACalc 的核心功能"由 Y 计算 X"的数学原理：

```
给定 Y（样本 OD 值），求解 X（浓度）：

Y = D + (A - D) / (1 + (X / C)^B)

推导过程：
(Y - D) / (A - D) = 1 / (1 + (X / C)^B)
1 + (X / C)^B = (A - D) / (Y - D)
(X / C)^B = (A - D) / (Y - D) - 1
X = C * [((A - D) / (Y - D)) - 1]^(1/B)
```

### 代码实现

```typescript
function fourPLInverse(y: number, A: number, B: number, C: number, D: number): number {
  // Y 超出渐近线范围的边界处理
  if (y >= D) return Infinity      // 超出上限，无法计算
  if (y <= A) return 0             // 低于下限，浓度为 0

  const ratio = (A - D) / (y - D) - 1
  if (ratio <= 0) return 0         // 数值保护

  return C * Math.pow(ratio, 1.0 / B)
}
```

---

## 四、Levenberg-Marquardt 参数拟合算法

### 1. 目标

找到最优参数 (A, B, C, D)，使得 4PL 曲线与标准品数据点的残差平方和（RSS）最小。

### 2. 残差平方和（RSS）

```
RSS = Σ[Y_i_observed - Y_i_predicted]²
    = Σ[Y_i - fourPL(X_i, A, B, C, D)]²
```

### 3. 初始参数估计

拟合开始前需要合理的初始值：

```typescript
// A0 = Bottom（最小渐近线）
// 取 OD 值的最小值，适当缩小（留有余量）
A0 = Math.min(...yData) * 0.8

// D0 = Top（最大渐近线）
// 取 OD 值的最大值，适当放大（留有余量）
D0 = Math.max(...yData) * 1.1

// C0 = EC50（拐点浓度）
// 找最接近 (A0+D0)/2 中点对应的浓度
midY = (A0 + D0) / 2
C0 = 与 midY 最接近的标准品浓度

// B0 = Hill 斜率初始值
B0 = 1.0  // 通常从 1 开始
```

### 4. LM 迭代过程

```
while (未收敛 && 迭代次数 < maxIter):
  1. 计算当前 RSS
  2. 计算数值梯度（Jacobian 矩阵）
  3. 计算 JTJ 矩阵（Hessian 近似）
  4. 加阻尼项：(JTJ + λ·I)·Δ = J^T·r
  5. 解线性方程组得到参数修正量 Δ
  6. 试探新参数：params_new = params + Δ
  7. 约束检查（参数不能越界）
  8. 如果 RSS 减小：接受新参数，λ *= 0.1（减小阻尼）
     如果 RSS 增大：拒绝新参数，λ *= 10（增大阻尼）
  9. 检查收敛条件（修正量足够小）
```

### 5. 参数约束（防止拟合发散）

```typescript
// A（Bottom）约束：必须为正且不超过最小 OD 的 1.5 倍
A = Math.max(0.0001, Math.min(A, Math.min(...yData) * 1.5))

// B（Hill斜率）约束：典型范围 0.1 ~ 5
B = Math.max(0.1, Math.min(B, 5))

// C（EC50）约束：必须在浓度范围内
C = Math.max(0.1, Math.min(C, 10000))

// D（Top）约束：必须大于最大 OD 的 0.8 倍
D = Math.max(Math.max(...yData) * 0.8, Math.min(D, Math.max(...yData) * 3))
```

---

## 五、拟合质量评估

### 1. 决定系数 R²

```
R² = 1 - (SS_res / SS_tot)

其中：
SS_res = Σ(Y_i_observed - Y_i_predicted)²  （残差平方和）
SS_tot = Σ(Y_i_observed - Y_mean)²         （总平方和）
```

### 2. ELISACalc 质量标准

| R² 范围 | 拟合质量 | 说明 |
|---------|---------|------|
| ≥ 0.999 | 优秀 ✓✓✓ | 理想状态，可放心使用 |
| ≥ 0.995 | 良好 ✓✓ | 可以接受 |
| ≥ 0.99  | 可接受 ✓ | 基本可用 |
| < 0.99  | 需检查 ⚠ | 建议检查数据或更换模型 |

**ELISACalc 建议**："曲线应为平滑上升趋势，r² 值越接近 1 拟合度越好。如果四参数模型不理想可以换成其他的模型。"

---

## 六、完整计算流程（对齐 ELISACalc 操作步骤）

```
Step 1: 数据输入
        ↓ 复制标准品浓度和 OD 值

Step 2: 初始参数估计
        A0 = min(OD) * 0.8
        D0 = max(OD) * 1.1
        C0 = EC50 初始估计
        B0 = 1.0
        ↓

Step 3: Levenberg-Marquardt 迭代拟合
        ↓ 迭代直到收敛

Step 4: 获得拟合参数 (A, B, C, D)
        输出回归方程
        计算 R²
        ↓

Step 5: 绘制标准曲线
        X轴：浓度（对数刻度）
        Y轴：OD 值
        曲线：4PL 拟合曲线（500 点平滑绘制）
        ↓

Step 6: "由 Y 计算 X"（样本浓度计算）
        输入：样本 OD 值
        公式：X = C * [((A-D)/(Y-D)) - 1]^(1/B)
        输出：样本浓度
        ↓

Step 7: 最终浓度
        样本浓度 × 稀释倍数 = 最终浓度
```

---

## 七、曲线绘制要点（已修复的关键问题）

### 1. X 轴必须使用对数刻度

ELISA 浓度跨度通常为 1 ~ 10000 pg/mL，**必须使用对数坐标**才能显示 S 型：

```typescript
const xScale = (x: number) => {
  return pad.left + ((Math.log10(x) - Math.log10(xMin)) /
                     (Math.log10(xMax) - Math.log10(xMin))) * plotWidth
}
```

### 2. Y 轴范围必须基于 4PL 渐近线（关键修复！）

```typescript
// ❌ 错误：只基于原始数据点
const yMin = 0
const yMax = Math.max(...standards.map(s => s.od)) * 1.1

// ✅ 正确：基于 4PL 渐近线（A=Bottom, D=Top）
const yMin = Math.max(0, fitResult.A * 0.5)  // 下渐近线
const yMax = fitResult.D * 1.2               // 上渐近线
```

### 3. 曲线点密度

```typescript
// 至少 500 个点才能画出平滑的 S 型
const STEPS = 500
for (let i = 0; i <= STEPS; i++) {
  const logX = logXmin + (i / STEPS) * (logXmax - logXmin)
  const x = Math.pow(10, logX)
  const y = fourPLFormula(x, A, B, C, D)
  // 绘制点...
}
```

### 4. 曲线应为平滑上升趋势

ELISACalc 要求："曲线应为平滑上升趋势"——即：
- 从 Blank（低 OD）开始
- 随浓度增加逐渐上升
- 在高浓度区域趋于饱和（平台期）
- 整体呈 S 型（Sigmoid）

---

## 八、稀释倍数处理

ELISACalc 的最后一步："整理数据，再乘以稀释倍数，得到对应样本蛋白最终浓度值。"

```typescript
// 从 4PL 反函数得到的浓度是原始浓度
const rawConcentration = fourPLInverse(sampleOD, A, B, C, D)

// 乘以稀释倍数得到最终浓度
const finalConcentration = rawConcentration * dilutionFactor
```

---

## 九、与 ELISACalc 软件功能对照

| ELISACalc 功能 | 你的代码实现 | 状态 |
|---------------|------------|------|
| 粘贴标准品数据 | `rawInput` textarea + `parseData()` | ✅ |
| 选择四参数拟合 | `handle4PL()` 调用 `fit4PLCore()` | ✅ |
| 回归/拟合计算 | Levenberg-Marquardt 算法 | ✅ |
| 查看回归方程 | `formatEquation()` | ✅ |
| 复制方程 | 导出报告功能 | ✅ |
| 由 Y 计算 X | `fourPLInverse()` | ✅ |
| 计算样本浓度 | 未知样本 OD → 浓度计算 | ✅ |
| 导出结果 | `exportReport()` 导出 txt | ✅ |
| 稀释倍数 | 用户手动乘以 | 需添加输入框 |

---

## 十、建议新增功能

基于 ELISACalc 的使用流程，建议在你的页面上添加：

1. **稀释倍数输入框**：每个样本可单独设置稀释倍数
2. **曲线模型切换**：4PL 不理想时可切换到 Linear/Log-Log
3. **数据表格化显示**：类似 Excel 的表格输入界面
4. **批量样本计算**：同时计算多个未知样本的浓度
