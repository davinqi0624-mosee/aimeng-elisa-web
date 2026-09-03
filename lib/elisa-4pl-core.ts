/**
 * ============================================================================
 * ELISA 四参数 Logistic (4PL) 拟合核心算法
 * ============================================================================
 * 文件：将此文件复制到您项目的 src/core/ 或 src/utils/ 目录下
 * 引用 ELISA Calc 软件计算逻辑
 * ============================================================================
 */

export interface Fit4PLResult {
  A: number; // 最小渐近线
  B: number; // Hill 斜率
  C: number; // EC50
  D: number; // 最大渐近线
  r2: number; // R²
  yPredicted: number[];
  params: number[];
}

export interface SampleResult {
  name: string;
  od: number;
  concentration: number;
  status: string;
  statusClass: 'ok' | 'warn' | 'error';
}

// 4PL公式: Y = D + (A-D) / (1 + (X/C)^B)
export function fourPL(x: number, A: number, B: number, C: number, D: number): number {
  const xSafe = Math.max(x, 1e-10);
  return D + (A - D) / (1.0 + Math.pow(xSafe / C, B));
}

// 4PL反函数
export function fourPLInverse(y: number, A: number, B: number, C: number, D: number): number {
  if (y >= D) return Infinity;
  if (y <= A) return 0;
  const ratio = (A - D) / (y - D) - 1;
  if (ratio <= 0) return 0;
  return C * Math.pow(ratio, 1.0 / B);
}

function computeRSS(params: number[], xData: number[], yData: number[], weights: number[]): number {
  const [A, B, C, D] = params;
  let rss = 0;
  for (let i = 0; i < xData.length; i++) {
    const residual = yData[i] - fourPL(xData[i], A, B, C, D);
    rss += weights[i] * residual * residual;
  }
  return rss;
}

/** Levenberg-Marquardt 4PL拟合 - 参考ELISA Calc */
export function fit4PL(xData: number[], yData: number[]): Fit4PLResult {
  if (xData.length < 4 || yData.length < 4) throw new Error('至少需要4个数据点');
  if (xData.length !== yData.length) throw new Error('浓度和OD值数量不匹配');
  if (!xData.every(Number.isFinite) || !yData.every(Number.isFinite)) {
    throw new Error('浓度或OD值包含无效数字，请检查空白单元格、文本或格式错误');
  }
  if (xData.some(x => x < 0)) throw new Error('标准品浓度不能为负数');

  const positiveX = xData.filter(x => x > 0);
  if (positiveX.length < 3) throw new Error('至少需要3个非零浓度点');

  const minX = Math.min(...positiveX);
  const maxX = Math.max(...positiveX);
  const minY = Math.min(...yData);
  const maxY = Math.max(...yData);
  const weights = yData.map(() => 1);

  const fromTransformed = (p: number[]) => {
    const A = p[0];
    const B = Math.exp(p[1]);
    const C = Math.exp(p[2]);
    const D = A + Math.exp(p[3]);
    return [A, B, C, D];
  };

  const rssTransformed = (p: number[]) => computeRSS(fromTransformed(p), xData, yData, weights);

  const nelderMead = (start: number[]) => {
    const n = start.length;
    let simplex = [start];
    const steps = [Math.max(0.02, Math.abs(maxY - minY) * 0.05), 0.35, 0.6, 0.6];
    for (let i = 0; i < n; i++) {
      const point = [...start];
      point[i] += steps[i];
      simplex.push(point);
    }
    let values = simplex.map(rssTransformed);

    for (let iter = 0; iter < 2500; iter++) {
      const order = values
        .map((value, index) => ({ value, index }))
        .sort((a, b) => a.value - b.value)
        .map(item => item.index);
      simplex = order.map(i => simplex[i]);
      values = order.map(i => values[i]);

      const centroid = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;

      const reflected = centroid.map((c, j) => c + (c - simplex[n][j]));
      const reflectedValue = rssTransformed(reflected);

      if (reflectedValue < values[0]) {
        const expanded = centroid.map((c, j) => c + 2 * (c - simplex[n][j]));
        const expandedValue = rssTransformed(expanded);
        simplex[n] = expandedValue < reflectedValue ? expanded : reflected;
        values[n] = Math.min(expandedValue, reflectedValue);
      } else if (reflectedValue < values[n - 1]) {
        simplex[n] = reflected;
        values[n] = reflectedValue;
      } else {
        const contracted = centroid.map((c, j) => c + 0.5 * (simplex[n][j] - c));
        const contractedValue = rssTransformed(contracted);
        if (contractedValue < values[n]) {
          simplex[n] = contracted;
          values[n] = contractedValue;
        } else {
          for (let i = 1; i <= n; i++) {
            simplex[i] = simplex[0].map((best, j) => best + 0.5 * (simplex[i][j] - best));
            values[i] = rssTransformed(simplex[i]);
          }
        }
      }

      if (Math.max(...values) - Math.min(...values) < 1e-14) break;
    }

    const bestIndex = values.indexOf(Math.min(...values));
    return { transformed: simplex[bestIndex], rss: values[bestIndex] };
  };

  const cSeeds = [Math.sqrt(minX * maxX), maxX / 2, maxX, maxX * 2, ...positiveX].filter(v => v > 0 && isFinite(v));
  const aSeeds = [
    Math.max(0, minY * 0.5),
    Math.max(0, minY * 0.8),
    Math.max(0, minY),
    Math.max(0, minY - Math.abs(maxY - minY) * 0.05),
  ];
  const dSeeds = [maxY * 1.02, maxY * 1.2, maxY * 1.8, maxY * 3];
  const bSeeds = [0.45, 0.65, 0.85, 1, 1.4, 2, 3];

  let best: { transformed: number[]; rss: number } | null = null;
  for (const A of aSeeds) {
    for (const D of dSeeds) {
      if (D <= A) continue;
      for (const B of bSeeds) {
        for (const C of cSeeds) {
          const result = nelderMead([A, Math.log(B), Math.log(C), Math.log(D - A)]);
          if (!best || result.rss < best.rss) best = result;
        }
      }
    }
  }

  if (!best) throw new Error('4PL拟合失败');
  const params = fromTransformed(best.transformed);
  const [A, B, C, D] = params;
  const yPredicted = xData.map(c => fourPL(c, A, B, C, D));
  const mean = yData.reduce((s, y) => s + y, 0) / yData.length;
  const ssTot = yData.reduce((s, y) => s + (y - mean) ** 2, 0);
  const ssRes = yData.reduce((s, y, i) => s + (y - yPredicted[i]) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  return { A, B, C, D, r2, yPredicted, params };
}

/** 批量计算样本浓度 */
export function calculateSamples(samples: { name: string; od: number }[], result: Fit4PLResult, concentrations: number[]): SampleResult[] {
  const minConc = Math.min(...concentrations.filter(c => c > 0));
  const maxConc = Math.max(...concentrations);
  return samples.map(s => {
    const conc = fourPLInverse(s.od, result.A, result.B, result.C, result.D);
    let status: string, statusClass: 'ok' | 'warn' | 'error';
    if (conc === Infinity || conc > maxConc * 1.2) { status = '超出量程(高)'; statusClass = 'error'; }
    else if (conc < minConc * 0.8) { status = '超出量程(低)'; statusClass = 'error'; }
    else if (conc < minConc || conc > maxConc) { status = '⚠ 边缘'; statusClass = 'warn'; }
    else { status = '✓ 正常'; statusClass = 'ok'; }
    return { ...s, concentration: conc, status, statusClass };
  });
}

/** 生成曲线数据（Chart.js用） */
export function generateCurve(result: Fit4PLResult, minX: number, maxX: number, numPoints = 200): { x: number; y: number }[] {
  const { A, B, C, D } = result;
  const curve: { x: number; y: number }[] = [];
  const logMinX = Math.log10(Math.max(minX, 0.1));
  const logMaxX = Math.log10(maxX);
  for (let i = 0; i < numPoints; i++) {
    const logX = logMinX + (logMaxX - logMinX) * i / (numPoints - 1);
    const x = Math.pow(10, logX);
    const y = fourPL(x, A, B, C, D);
    if (y >= A * 0.5 && y <= D * 1.1) curve.push({ x, y });
  }
  return curve;
}

export function formatEquation(result: Fit4PLResult): string {
  const { A, B, C, D } = result;
  return `Y = ${D.toFixed(4)} + (${A.toFixed(4)} - ${D.toFixed(4)}) / (1 + (X / ${C.toFixed(4)}) ^ ${B.toFixed(4)})`;
}

export function getFitQuality(r2: number): string {
  if (r2 >= 0.999) return '优秀 ✓✓✓';
  if (r2 >= 0.995) return '良好 ✓✓';
  if (r2 >= 0.99) return '可接受 ✓';
  return '需检查 ⚠';
}
