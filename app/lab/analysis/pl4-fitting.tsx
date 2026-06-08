'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { LineChart, TrendingUp, Calculator, Download, Trash2, Upload } from 'lucide-react';

// ═══════════════════════════════════════════
// 4PL (Four-Parameter Logistic) Curve Fitting
// y = (A - D) / (1 + (x/C)^B) + D
// ═══════════════════════════════════════════

interface DataPoint {
  x: number;  // concentration
  y: number;  // OD/signal
}

interface PL4Params {
  A: number;  // Upper asymptote (max signal)
  B: number;  // Hill slope (steepness)
  C: number;  // EC50 (midpoint concentration)
  D: number;  // Lower asymptote (min signal/blank)
}

// Default 7-point standard curve data
const DEFAULT_STANDARDS: DataPoint[] = [
  { x: 500, y: 2.845 },
  { x: 250, y: 1.923 },
  { x: 125, y: 1.156 },
  { x: 62.5, y: 0.687 },
  { x: 31.25, y: 0.412 },
  { x: 15.625, y: 0.251 },
  { x: 7.812, y: 0.148 },
  { x: 0, y: 0.052 },
];

const DEFAULT_SAMPLES: DataPoint[] = [
  { x: NaN, y: 0.892 },
  { x: NaN, y: 1.234 },
  { x: NaN, y: 1.450 },
];

// ── 4PL Function: y = (A-D)/(1+(x/C)^B) + D ──
function pl4(x: number, p: PL4Params): number {
  if (x <= 0) return p.D;
  return (p.A - p.D) / (1 + Math.pow(x / p.C, p.B)) + p.D;
}

// ── Inverse 4PL: x = C * ((A-D)/(y-D) - 1)^(1/B) ──
function pl4Inverse(y: number, p: PL4Params): number {
  if (y >= p.A) return Infinity;
  if (y <= p.D) return 0;
  return p.C * Math.pow((p.A - p.D) / (y - p.D) - 1, 1 / p.B);
}

// ── Residuals ──
function residuals(data: DataPoint[], p: PL4Params): number[] {
  return data.map(pt => pt.y - pl4(pt.x, p));
}

// ── Sum of Squared Errors ──unction sse(data: DataPoint[], p: PL4Params): number {
  return residuals(data, p).reduce((sum, r) => sum + r * r, 0);
}

// ── Jacobian Matrix (partial derivatives) ──
function jacobian(data: DataPoint[], p: PL4Params): number[][] {
  return data.map(pt => {
    const { x, y: _y } = pt;
    if (x <= 0) return [1, 0, 0, 1]; // at x=0, only A and D matter
    const xc = Math.pow(x / p.C, p.B);
    const denom = 1 + xc;
    const yPred = (p.A - p.D) / denom + p.D;
    
    // ∂y/∂A = 1/(1+(x/C)^B)
    const dA = 1 / denom;
    
    // ∂y/∂B = -(A-D) * (x/C)^B * ln(x/C) / (1+(x/C)^B)^2
    const dB = -(p.A - p.D) * xc * Math.log(x / p.C) / (denom * denom);
    
    // ∂y/∂C = (A-D) * B * (x/C)^B / (C * (1+(x/C)^B)^2)
    const dC = (p.A - p.D) * p.B * xc / (p.C * denom * denom);
    
    // ∂y/∂D = 1 - 1/(1+(x/C)^B) = (x/C)^B / (1+(x/C)^B)
    const dD = xc / denom;
    
    return [dA, dB, dC, dD];
  });
}

// ── Levenberg-Marquardt Algorithm ──
function fitPL4(data: DataPoint[]): PL4Params {
  // Exclude x=0 point for fitting (blank), use it only for D estimation
  const fitData = data.filter(pt => pt.x > 0);
  
  if (fitData.length < 4) {
    throw new Error('Need at least 4 non-zero standard points for 4PL fitting');
  }
  
  // Initial parameter estimates
  const yValues = data.map(pt => pt.y);
  const A_init = Math.max(...yValues);
  const D_init = Math.min(...yValues);
  const sortedByX = [...fitData].sort((a, b) => a.x - b.x);
  
  // Estimate C (EC50) - concentration at midpoint
  const midY = (A_init + D_init) / 2;
  let C_init = sortedByX[Math.floor(sortedByX.length / 2)].x;
  for (let i = 0; i < sortedByX.length - 1; i++) {
    if ((sortedByX[i].y - midY) * (sortedByX[i + 1].y - midY) <= 0) {
      C_init = sortedByX[i].x;
      break;
    }
  }
  
  // Estimate B (slope) from linear region
  const B_init = 1.0;
  
  let params: PL4Params = { A: A_init, B: B_init, C: C_init, D: D_init };
  
  // LM parameters
  let lambda = 0.01;
  const maxIter = 100;
  const tol = 1e-8;
  
  let prevSSE = sse(fitData, params);
  
  for (let iter = 0; iter < maxIter; iter++) {
    const J = jacobian(fitData, params);
    const r = residuals(fitData, params);
    
    // J^T * J (Hessian approximation)
    const JTJ = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < J.length; k++) {
          JTJ[i][j] += J[k][i] * J[k][j];
        }
      }
    }
    
    // J^T * r (gradient)
    const JTr = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < J.length; k++) {
        JTr[i] += J[k][i] * r[k];
      }
    }
    
    // Add damping
    for (let i = 0; i < 4; i++) {
      JTJ[i][i] += lambda * JTJ[i][i];
    }
    
    // Solve (JTJ) * delta = JTr using Gaussian elimination
    const delta = solveLinear(JTJ, JTr);
    
    // Trial step
    const trial: PL4Params = {
      A: params.A + delta[0],
      B: params.B + delta[1],
      C: Math.max(0.001, params.C + delta[2]), // keep positive
      D: params.D + delta[3],
    };
    
    const trialSSE = sse(fitData, trial);
    
    if (trialSSE < prevSSE) {
      params = trial;
      lambda *= 0.1;
      prevSSE = trialSSE;
    } else {
      lambda *= 10;
    }
    
    // Check convergence
    const deltaNorm = Math.sqrt(delta.reduce((s, d) => s + d * d, 0));
    if (deltaNorm < tol) break;
  }
  
  return params;
}

// ── Simple Gaussian Elimination (4x4) ──
function solveLinear(A: number[][], b: number[]): number[] {
  const n = 4;
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);
  
  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Partial pivoting
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    
    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-15) continue;
    
    for (let j = i; j <= n; j++) M[i][j] /= pivot;
    
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = M[k][i];
      for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
    }
  }
  
  return M.map(row => row[n]);
}

// ── R² Calculation ──
function rSquared(data: DataPoint[], params: PL4Params): number {
  const yMean = data.reduce((s, pt) => s + pt.y, 0) / data.length;
  const ssTot = data.reduce((s, pt) => s + Math.pow(pt.y - yMean, 2), 0);
  const ssRes = sse(data, params);
  return 1 - ssRes / ssTot;
}

// ═══════════════════════════════════════════
// CANVAS CURVE DRAWER
// ═══════════════════════════════════════════
function drawCurve(
  canvas: HTMLCanvasElement,
  standards: DataPoint[],
  samples: DataPoint[],
  params: PL4Params | null
) {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const W = rect.width;
  const H = rect.height;
  const pad = { top: 40, right: 40, bottom: 60, left: 70 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  
  // Clear
  ctx.clearRect(0, 0, W, H);
  
  if (!params) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('请输入标准品数据并点击"拟合曲线"', W / 2, H / 2);
    return;
  }
  
  // Scales (log x)
  const xMin = Math.log10(Math.max(0.1, Math.min(...standards.filter(s => s.x > 0).map(s => s.x))));
  const xMax = Math.log10(Math.max(...standards.map(s => s.x)) * 1.5);
  const yMin = params.D * 0.8;
  const yMax = params.A * 1.05;
  
  const toX = (x: number) => pad.left + (Math.log10(Math.max(0.1, x)) - xMin) / (xMax - xMin) * plotW;
  const toY = (y: number) => pad.top + plotH - (y - yMin) / (yMax - yMin) * plotH;
  
  // Grid
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.5;
  const xTicks = [0.1, 1, 10, 100, 1000];
  for (const xt of xTicks) {
    const px = toX(xt);
    if (px >= pad.left && px <= W - pad.right) {
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, H - pad.bottom);
      ctx.stroke();
    }
  }
  const yTicks = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  for (const yt of yTicks) {
    if (yt >= yMin && yt <= yMax) {
      const py = toY(yt);
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(W - pad.right, py);
      ctx.stroke();
    }
  }
  
  // Axes
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, H - pad.bottom);
  ctx.lineTo(W - pad.right, H - pad.bottom);
  ctx.stroke();
  
  // X labels
  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  for (const xt of xTicks) {
    const px = toX(xt);
    if (px >= pad.left && px <= W - pad.right) {
      ctx.fillText(xt >= 1000 ? '1k' : String(xt), px, H - pad.bottom + 20);
    }
  }
  ctx.fillText('浓度 (pg/mL) — 对数刻度', W / 2, H - 10);
  
  // Y labels
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  for (const yt of yTicks) {
    if (yt >= yMin && yt <= yMax) {
      ctx.fillText(yt.toFixed(1), pad.left - 10, toY(yt) + 4);
    }
  }
  
  // Y axis label
  ctx.save();
  ctx.translate(15, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('OD450', 0, 0);
  ctx.restore();
  
  // Fitted curve
  if (params) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let px = pad.left; px <= W - pad.right; px += 1) {
      const logX = xMin + (px - pad.left) / plotW * (xMax - xMin);
      const x = Math.pow(10, logX);
      const y = pl4(x, params);
      const py = toY(y);
      if (px === pad.left) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  
  // Standard points
  for (const pt of standards) {
    const px = pt.x > 0 ? toX(pt.x) : pad.left;
    const py = toY(pt.y);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(pt.x), px, py - 12);
  }
  
  // Sample points (with calculated concentrations)
  for (const pt of samples) {
    if (isNaN(pt.y)) continue;
    const conc = pl4Inverse(pt.y, params);
    const px = conc > 0 ? toX(conc) : pad.left;
    const py = toY(pt.y);
    
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function PL4Fitting() {
  const [standards, setStandards] = useState<DataPoint[]>(DEFAULT_STANDARDS);
  const [samples, setSamples] = useState<DataPoint[]>(DEFAULT_SAMPLES);
  const [params, setParams] = useState<PL4Params | null>(null);
  const [r2, setR2] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Fit curve
  const handleFit = useCallback(() => {
    try {
      const fitted = fitPL4(standards);
      setParams(fitted);
      setR2(rSquared(standards, fitted));
      
      // Calculate sample concentrations
      const newSamples = samples.map(s => ({
        ...s,
        x: pl4Inverse(s.y, fitted)
      }));
      setSamples(newSamples);
    } catch (err: any) {
      alert('拟合失败: ' + err.message);
    }
  }, [standards, samples]);
  
  // Draw on canvas
  useEffect(() => {
    if (canvasRef.current && params) {
      drawCurve(canvasRef.current, standards, samples, params);
    }
  }, [params, standards, samples]);
  
  // Update standard point
  const updateStandard = (idx: number, field: 'x' | 'y', val: string) => {
    const num = parseFloat(val);
    const newData = [...standards];
    newData[idx] = { ...newData[idx], [field]: isNaN(num) ? 0 : num };
    setStandards(newData);
    setParams(null); // invalidate fit
  };
  
  // Update sample OD
  const updateSample = (idx: number, val: string) => {
    const num = parseFloat(val);
    const newData = [...samples];
    newData[idx] = { ...newData[idx], y: isNaN(num) ? 0 : num };
    setSamples(newData);
    setParams(null);
  };
  
  // CSV import
  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const newStandards: DataPoint[] = [];
      const newSamples: DataPoint[] = [];
      let inSamples = false;
      for (const line of lines) {
        if (line.toLowerCase().includes('sample') || line.toLowerCase().includes('未知')) {
          inSamples = true;
          continue;
        }
        const parts = line.split(/[,\t]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        if (parts.length >= 2) {
          if (inSamples) newSamples.push({ x: NaN, y: parts[1] });
          else newStandards.push({ x: parts[0], y: parts[1] });
        }
      }
      if (newStandards.length >= 4) {
        setStandards(newStandards);
        setSamples(newSamples);
        setParams(null);
      }
    };
    reader.readAsText(file);
  };
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            4PL 标准曲线拟合
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            四参数Logistic回归 — ELISA法定拟合模型
          </p>
        </div>
        <div className="flex gap-2">
          <label className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" />
            导入CSV
            <input type="file" accept=".csv" onChange={handleCSV} className="hidden" />
          </label>
          <button onClick={() => { setStandards(DEFAULT_STANDARDS); setSamples(DEFAULT_SAMPLES); setParams(null); }}
            className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm">
            <Trash2 className="w-4 h-4" />
            清空
          </button>
        </div>
      </div>
      
      {/* Formula display */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <p className="text-blue-800 text-sm font-medium mb-2">4PL 标准数学表达式</p>
        <p className="text-blue-900 text-lg font-mono">
          y = (A - D) / (1 + (x/C)<sup>B</sup>) + D
        </p>
        <div className="grid grid-cols-4 gap-4 mt-3 text-xs text-blue-700">
          <div><span className="font-bold">A</span> = 上渐近线（最大信号）</div>
          <div><span className="font-bold">B</span> = Hill系数（陡度）</div>
          <div><span className="font-bold">C</span> = EC50（半数浓度）</div>
          <div><span className="font-bold">D</span> = 下渐近线（本底信号）</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Data input */}
        <div className="lg:col-span-2 space-y-4">
          {/* Standards */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <LineChart className="w-5 h-5 text-blue-500" />
              标准品数据
            </h3>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-slate-500 mb-1">
              <span>浓度 (pg/mL)</span>
              <span>OD450</span>
              <span></span>
            </div>
            {standards.map((pt, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-1">
                <input
                  type="number"
                  value={pt.x}
                  onChange={e => updateStandard(i, 'x', e.target.value)}
                  className="px-2 py-1 rounded border border-slate-200 text-sm focus:border-blue-400 focus:outline-none"
                  step="any"
                />
                <input
                  type="number"
                  value={pt.y}
                  onChange={e => updateStandard(i, 'y', e.target.value)}
                  className="px-2 py-1 rounded border border-slate-200 text-sm focus:border-blue-400 focus:outline-none"
                  step="any"
                />
                <span className="text-xs text-slate-400 self-center">S{i + 1}</span>
              </div>
            ))}
          </div>
          
          {/* Samples */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-red-500" />
              未知样本 OD
            </h3>
            {samples.map((pt, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr] gap-2 mb-1">
                <span className="text-sm text-slate-500 self-center">Sample-{i + 1}</span>
                <input
                  type="number"
                  value={pt.y}
                  onChange={e => updateSample(i, e.target.value)}
                  className="px-2 py-1 rounded border border-slate-200 text-sm focus:border-blue-400 focus:outline-none"
                  step="any"
                />
              </div>
            ))}
          </div>
          
          {/* Fit button */}
          <button
            onClick={handleFit}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <TrendingUp className="w-5 h-5" />
            拟合4PL曲线
          </button>
        </div>
        
        {/* Right: Curve + Results */}
        <div className="lg:col-span-3 space-y-4">
          {/* Canvas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-900">标准曲线</h3>
              <div className="flex gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span>标准品</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span>未知样本</span>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: '360px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            />
          </div>
          
          {/* Parameters */}
          {params && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-3">拟合参数</h3>
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">A (上渐近线)</p>
                  <p className="text-lg font-bold text-blue-900">{params.A.toFixed(4)}</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">B (Hill系数)</p>
                  <p className="text-lg font-bold text-blue-900">{params.B.toFixed(4)}</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">C (EC50)</p>
                  <p className="text-lg font-bold text-blue-900">{params.C.toFixed(4)}</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">D (下渐近线)</p>
                  <p className="text-lg font-bold text-blue-900">{params.D.toFixed(4)}</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-emerald-600">R²</p>
                  <p className="text-lg font-bold text-emerald-900">{r2.toFixed(4)}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Sample results */}
          {params && samples.some(s => !isNaN(s.x)) && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-900 mb-3">样本浓度计算结果</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-500">样本</th>
                    <th className="text-right py-2 text-slate-500">OD450</th>
                    <th className="text-right py-2 text-slate-500">浓度 (pg/mL)</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-2 font-medium">Sample-{i + 1}</td>
                      <td className="text-right py-2">{s.y.toFixed(3)}</td>
                      <td className="text-right py-2 font-bold text-blue-600">
                        {isNaN(s.x) ? '—' : s.x.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
