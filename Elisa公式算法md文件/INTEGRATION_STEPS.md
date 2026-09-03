# 在原网站集成修复后的4PL算法 - 操作步骤

## 您的原网站结构（我之前查看过的）

```
/user/moses/aimeng-elisa-web/
├── src/
│   ├── App.tsx                    ← 路由配置
│   ├── components/                ← 共享组件
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   ├── pages/                     ← 页面
│   │   ├── Home.tsx
│   │   ├── Search.tsx
│   │   ├── Chat.tsx
│   │   ├── Knowledge.tsx
│   │   ├── Citations.tsx
│   │   ├── Store.tsx
│   │   ├── Contact.tsx
│   │   ├── Auth/
│   │   │   ├── Login.tsx
│   │   │   └── Register.tsx
│   │   └── Lab/                   ← 实验室模块
│   │       ├── Calculator.tsx
│   │       ├── Experiment.tsx
│   │       └── Analysis.tsx       ← ← ← 需要修改的文件
│   └── ...
├── package.json
└── vite.config.ts / next.config.js
```

---

## 第一步：复制核心算法文件

将 `elisa-4pl-core.ts` 复制到您项目的 `src/` 目录下：

```bash
# 在项目根目录执行
cp /mnt/agents/output/fix-package/elisa-4pl-core.ts src/
# 或者手动复制到 src/elisa-4pl-core.ts
```

---

## 第二步：修改 Lab/Analysis.tsx

### 2.1 在文件顶部添加导入

在您的 `src/pages/Lab/Analysis.tsx` 文件的最顶部，添加以下导入：

```typescript
import {
  fit4PL, calculateSamples, generateCurve, formatEquation, getFitQuality,
  type Fit4PLResult, type SampleResult
} from '../../elisa-4pl-core';  // 根据实际路径调整
```

### 2.2 找到并删除原有的4PL拟合函数

在您的 Analysis.tsx 中，找到类似下面的**旧4PL代码**并**全部删除**：

```typescript
// ❌ 删除这些旧代码：
function fit4PL(xData, yData) { ... }           // 旧拟合函数
function computeR2(yData, yPred) { ... }        // 旧R2计算
const fourPL = (x, A, B, C, D) => { ... }       // 旧4PL公式
// ... 等等所有与4PL计算相关的旧函数
```

### 2.3 替换拟合调用代码

找到您原有的"开始拟合"按钮点击处理函数，替换为：

```typescript
// ✅ 新的拟合调用（替换原有逻辑）
const handleFit = () => {
  // 1. 解析数据（保持您原有的解析逻辑）
  const concentrations = [...];  // 您原有解析的浓度数组
  const odValues = [...];        // 您原有解析的OD值数组
  const samples = [...];         // 您原有解析的样本数组

  // 2. 执行4PL拟合（新API）
  const result: Fit4PLResult = fit4PL(concentrations, odValues);

  // 3. 计算样本浓度（新API）
  const sampleResults: SampleResult[] = calculateSamples(samples, result, concentrations);

  // 4. 生成曲线数据给Chart.js（新API）
  const curveData = generateCurve(result, 0.1, Math.max(...concentrations) * 1.5, 200);

  // 5. 保存结果到state（保持您原有的setState逻辑）
  setFitResult(result);
  setSampleResults(sampleResults);
  setCurveData(curveData);
};
```

### 2.4 替换参数显示

如果您原有显示拟合参数的代码类似：

```typescript
// ❌ 旧代码
<p>A: {oldParams.a}</p>
<p>B: {oldParams.b}</p>
```

替换为：

```typescript
// ✅ 新代码
<p>A (Min Asymptote): {fitResult.A.toFixed(4)}</p>
<p>B (Hill Slope): {fitResult.B.toFixed(4)}</p>
<p>C (EC50): {fitResult.C.toFixed(2)} pg/mL</p>
<p>D (Max Asymptote): {fitResult.D.toFixed(4)}</p>
<p>R²: {fitResult.r2.toFixed(6)}</p>
<p>拟合质量: {getFitQuality(fitResult.r2)}</p>
<p>方程: {formatEquation(fitResult)}</p>
```

### 2.5 替换图表数据生成

找到给 Chart.js 提供曲线数据的代码，替换为：

```typescript
// ✅ 使用新的generateCurve生成平滑曲线数据
const curvePoints = generateCurve(fitResult, minX, maxX, 200);
// curvePoints = [{x: 浓度, y: OD值}, ...]
// 直接传给Chart.js的dataset
```

---

## 第三步：处理TypeScript类型（如果您用TS）

如果您的项目使用TypeScript，确保导入类型：

```typescript
import type { Fit4PLResult, SampleResult } from '../../elisa-4pl-core';
```

如果是JavaScript项目，去掉类型注解即可：

```javascript
import { fit4PL, calculateSamples, generateCurve, formatEquation, getFitQuality } from '../../elisa-4pl-core';
```

---

## 第四步：测试验证

```bash
# 启动开发服务器
npm run dev

# 打开 http://localhost:3000
# 导航到 数据分析 页面
# 输入示例数据，点击"开始4PL拟合"
```

**验证标准：**
- 标准曲线应该是 **S型**（不是直线！）
- R² 应该 **> 0.99**（用示例数据应该得到 0.999844）
- 样本浓度应该合理（示例数据中Sample-1 OD=0.892 → 约86 pg/mL）

---

## 示例数据用于测试

```
标准品:
500 2.845
250 1.923
125 1.156
62.5 0.687
31.25 0.412
15.625 0.251
7.812 0.148
0 0.052

样本:
Sample-1 0.892
Sample-2 1.234
Sample-3 1.450
```

**预期结果：**
| 样本 | OD | 浓度 | 状态 |
|------|-----|------|------|
| Sample-1 | 0.892 | 86.33 pg/mL | 正常 |
| Sample-2 | 1.234 | 133.32 pg/mL | 正常 |
| Sample-3 | 1.450 | 167.00 pg/mL | 正常 |

---

## 常见问题

**Q: 我找不到 Analysis.tsx 中的旧4PL代码在哪里？**
A: 搜索文件中的关键词：`fit`、`4pl`、`fourPL`、`logistic`、`curve_fit`，找到相关函数后删除。

**Q: 导入路径不对怎么办？**
A: 根据您的实际目录结构调整。如果 Analysis.tsx 在 `src/pages/Lab/Analysis.tsx`，核心文件在 `src/elisa-4pl-core.ts`，则路径是 `../../elisa-4pl-core`。

**Q: 需要安装新依赖吗？**
A: **不需要！** 这个核心算法是纯TypeScript/JavaScript，不依赖任何外部库。

**Q: 我的图表用的是ECharts不是Chart.js？**
A: `generateCurve()` 返回的是 `{x, y}` 对象数组，可以适配任何图表库。ECharts用：`data: curvePoints.map(p => [p.x, p.y])`。
