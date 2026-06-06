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
function fourPL(x: number, A: number, B: number, C: number, D: number): number {
  const xSafe = Math.max(x, 1e-10);
  return D + (A - D) / (1.0 + Math.pow(xSafe / C, B));
}

// 4PL反函数
function fourPLInverse(y: number, A: number, B: number, C: number, D: number): number {
  if (y >= D) return Infinity;
  if (y <= A) return 0;
  const ratio = (A - D) / (y - D) - 1;
  if (ratio <= 0) return 0;
  return C * Math.pow(ratio, 1.0 / B);
}

function computeRSS(params: number[], xData: number[], yData: number[]): number {
  const [A, B, C, D] = params;
  let rss = 0;
  for (let i = 0; i < xData.length; i++) {
    const residual = yData[i] - fourPL(xData[i], A, B, C, D);
    rss += residual * residual;
  }
  return rss;
}

function computeGradient(params: number[], xData: number[], yData: number[], h = 1e-6): number[] {
  const grad = new Array(4).fill(0);
  for (let i = 0; i < 4; i++) {
    const pp = [...params], pm = [...params];
    pp[i] += h; pm[i] -= h;
    grad[i] = (computeRSS(pp, xData, yData) - computeRSS(pm, xData, yData)) / (2 * h);
  }
  return grad;
}

function computeJTJ(params: number[], xData: number[], _yData: number[], h = 1e-6): number[][] {
  const n = xData.length;
  const J: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(4).fill(0);
    for (let j = 0; j < 4; j++) {
      const pp = [...params]; pp[j] += h;
      row[j] = (fourPL(xData[i], ...(pp as [number,number,number,number])) - fourPL(xData[i], ...(params as [number,number,number,number]))) / h;
    }
    J.push(row);
  }
  const jtj = Array.from({ length: 4 }, () => new Array(4).fill(0));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < n; k++) jtj[i][j] += J[k][i] * J[k][j];
  return jtj;
}

function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i, maxVal = Math.abs(aug[i][i]);
    for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > maxVal) { maxVal = Math.abs(aug[k][i]); maxRow = k; }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-14) continue;
    for (let k = i + 1; k < n; k++) { const factor = aug[k][i] / aug[i][i]; for (let j = i; j <= n; j++) aug[k][j] -= factor * aug[i][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-14) { x[i] = 0; continue; }
    let sum = aug[i][n]; for (let j = i + 1; j < n; j++) sum -= aug[i][j] * x[j];
    x[i] = sum / aug[i][i];
  }
  return x;
}

/** Levenberg-Marquardt 4PL拟合 - 参考ELISA Calc */
export function fit4PL(xData: number[], yData: number[]): Fit4PLResult {
  if (xData.length < 4 || yData.length < 4) throw new Error('至少需要4个数据点');
  if (xData.length !== yData.length) throw new Error('浓度和OD值数量不匹配');

  const A0 = Math.min(...yData) * 0.8;
  const D0 = Math.max(...yData) * 1.1;
  const midY = (A0 + D0) / 2;
  let closestIdx = 0, minDiff = Infinity;
  for (let i = 0; i < yData.length; i++) { const diff = Math.abs(yData[i] - midY); if (diff < minDiff) { minDiff = diff; closestIdx = i; } }
  const C0 = xData[closestIdx] || 50;
  const B0 = 1.0;

  let params = [Math.max(A0, 0.001), B0, C0, D0];
  let lambda = 0.01;
  const maxIter = 500, tol = 1e-10;
  let prevRSS = computeRSS(params, xData, yData);

  for (let iter = 0; iter < maxIter; iter++) {
    const grad = computeGradient(params, xData, yData);
    const jtj = computeJTJ(params, xData, yData);
    const augmented = jtj.map((row, i) => { const newRow = [...row]; newRow[i] += lambda; return newRow; });
    const delta = solveLinear(augmented, grad.map(g => -g));
    const newParams = params.map((p, i) => p + delta[i]);

    newParams[0] = Math.max(0.0001, Math.min(newParams[0], Math.min(...yData) * 1.5));
    newParams[1] = Math.max(0.1, Math.min(newParams[1], 5));
    newParams[2] = Math.max(0.1, Math.min(newParams[2], 10000));
    newParams[3] = Math.max(Math.max(...yData) * 0.8, Math.min(newParams[3], Math.max(...yData) * 3));

    const newRSS = computeRSS(newParams, xData, yData);
    if (newRSS < prevRSS) { params = newParams; lambda *= 0.1; prevRSS = newRSS; } else { lambda *= 10; }
    if (delta.reduce((sum, d) => sum + d * d, 0) < tol) break;
  }

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
