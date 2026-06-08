'use client'

import { useState, useRef, useCallback } from 'react'
import {
  BarChart3, TrendingUp, FileText, Play, Sigma,
  Download, Trash2, Upload, CheckCircle2, AlertCircle,
} from 'lucide-react'

// ============ 内联4PL核心算法（参考ELISA Calc计算逻辑） ============

/**
 * 4PL公式: Y = D + (A-D) / (1 + (X/C)^B)
 * A = Bottom (最小渐近线 / Blank OD)
 * B = Hill斜率
 * C = EC50 (拐点浓度)
 * D = Top (最大渐近线 / 饱和OD)
 */
function fourPLFormula(x: number, A: number, B: number, C: number, D: number): number {
  const xSafe = Math.max(x, 1e-10)
  return D + (A - D) / (1.0 + Math.pow(xSafe / C, B))
}

/** 4PL反函数: 从OD值反算浓度 */
function fourPLInverse(y: number, A: number, B: number, C: number, D: number): number {
  if (y >= D) return Infinity
  if (y <= A) return 0
  const ratio = (A - D) / (y - D) - 1
  if (ratio <= 0) return 0
  return C * Math.pow(ratio, 1.0 / B)
}

/** Levenberg-Marquardt 4PL拟合 */
function fit4PLCore(xData: number[], yData: number[]) {
  if (xData.length < 4 || yData.length < 4) throw new Error('至少需要4个数据点')
  if (xData.length !== yData.length) throw new Error('浓度和OD值数量不匹配')

  // 初始参数估计
  const A0 = Math.min(...yData) * 0.8   // Bottom
  const D0 = Math.max(...yData) * 1.1   // Top
  const midY = (A0 + D0) / 2
  let closestIdx = 0, minDiff = Infinity
  for (let i = 0; i < yData.length; i++) {
    const diff = Math.abs(yData[i] - midY)
    if (diff < minDiff) { minDiff = diff; closestIdx = i }
  }
  const C0 = xData[closestIdx] || 50
  const B0 = 1.0

  let params = [Math.max(A0, 0.001), B0, C0, D0]
  let lambda = 0.01
  const maxIter = 500, tol = 1e-10

  // 残差平方和
  const rss = (p: number[]) => {
    const [A, B, C, D] = p
    let s = 0
    for (let i = 0; i < xData.length; i++) {
      const r = yData[i] - fourPLFormula(xData[i], A, B, C, D)
      s += r * r
    }
    return s
  }

  // 数值梯度
  const grad = (p: number[], h = 1e-6) => {
    const g = [0, 0, 0, 0]
    for (let i = 0; i < 4; i++) {
      const pp = [...p], pm = [...p]
      pp[i] += h; pm[i] -= h
      g[i] = (rss(pp) - rss(pm)) / (2 * h)
    }
    return g
  }

  // JTJ矩阵
  const jtj = (p: number[], h = 1e-6) => {
    const n = xData.length
    const J: number[][] = []
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0]
      for (let j = 0; j < 4; j++) {
        const pp = [...p]; pp[j] += h
        row[j] = (fourPLFormula(xData[i], pp[0], pp[1], pp[2], pp[3]) - fourPLFormula(xData[i], p[0], p[1], p[2], p[3])) / h
      }
      J.push(row)
    }
    const m = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < n; k++) m[i][j] += J[k][i] * J[k][j]
    return m
  }

  // 高斯消元
  const solve = (A: number[][], b: number[]) => {
    const n = 4
    const aug = A.map((row, i) => [...row, b[i]])
    for (let i = 0; i < n; i++) {
      let maxRow = i, maxVal = Math.abs(aug[i][i])
      for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > maxVal) { maxVal = Math.abs(aug[k][i]); maxRow = k }
      ;[aug[i], aug[maxRow]] = [aug[maxRow], aug[i]]
      if (Math.abs(aug[i][i]) < 1e-14) continue
      for (let k = i + 1; k < n; k++) {
        const f = aug[k][i] / aug[i][i]
        for (let j = i; j <= n; j++) aug[k][j] -= f * aug[i][j]
      }
    }
    const x = [0, 0, 0, 0]
    for (let i = n - 1; i >= 0; i--) {
      if (Math.abs(aug[i][i]) < 1e-14) { x[i] = 0; continue }
      let s = aug[i][n]; for (let j = i + 1; j < n; j++) s -= aug[i][j] * x[j]
      x[i] = s / aug[i][i]
    }
    return x
  }

  let prevRSS = rss(params)
  for (let iter = 0; iter < maxIter; iter++) {
    const g = grad(params)
    const J = jtj(params)
    const aug = J.map((row, i) => { const nr = [...row]; nr[i] += lambda; return nr })
    const delta = solve(aug, g.map(v => -v))
    const np = params.map((p, i) => p + delta[i])

    // 参数约束
    np[0] = Math.max(0.0001, Math.min(np[0], Math.min(...yData) * 1.5))
    np[1] = Math.max(0.1, Math.min(np[1], 5))
    np[2] = Math.max(0.1, Math.min(np[2], 10000))
    np[3] = Math.max(Math.max(...yData) * 0.8, Math.min(np[3], Math.max(...yData) * 3))

    const newRSS = rss(np)
    if (newRSS < prevRSS) { params = np; lambda *= 0.1; prevRSS = newRSS }
    else { lambda *= 10 }
    if (delta.reduce((s, d) => s + d * d, 0) < tol) break
  }

  const [A, B, C, D] = params
  const yPred = xData.map(c => fourPLFormula(c, A, B, C, D))
  const mean = yData.reduce((s, y) => s + y, 0) / yData.length
  const ssTot = yData.reduce((s, y) => s + (y - mean) ** 2, 0)
  const ssRes = yData.reduce((s, y, i) => s + (y - yPred[i]) ** 2, 0)
  const r2 = 1 - ssRes / ssTot

  return { A, B, C, D, r2, yPredicted: yPred, params }
}

/** 计算拟合质量 */
function getFitQuality(r2: number): string {
  if (r2 >= 0.999) return '优秀 ✓✓✓'
  if (r2 >= 0.995) return '良好 ✓✓'
  if (r2 >= 0.99) return '可接受 ✓'
  return '需检查 ⚠'
}

/** 格式化方程 */
function formatEquation(A: number, B: number, C: number, D: number): string {
  return `Y = ${D.toFixed(4)} + (${A.toFixed(4)} - ${D.toFixed(4)}) / (1 + (X / ${C.toFixed(4)}) ^ ${B.toFixed(4)})`
}

// ============ 类型定义 ============

interface StandardPoint {
  concentration: number
  od: number
}

interface UnknownSample {
  name: string
  od: number
  concentration?: number
}

interface FitResult {
  A: number
  B: number
  C: number
  D: number
  r2: number
  type: '4pl' | 'linear'
  points: { x: number; y: number; predicted: number }[]
}

type TabType = 'input' | 'curve' | 'report'

// ============ 页面组件 ============

export default function ElisaAnalysisPage() {
  const [activeTab, setActiveTab] = useState<TabType>('input')
  const [rawInput, setRawInput] = useState<string>(
    "标准品浓度(pg/mL)\tOD450\n" +
    "500\t2.845\n" +
    "250\t1.923\n" +
    "125\t1.156\n" +
    "62.5\t0.687\n" +
    "31.25\t0.412\n" +
    "15.625\t0.251\n" +
    "7.812\t0.148\n" +
    "0\t0.052\n" +
    "\n" +
    "未知样本\tOD450\n" +
    "Sample-1\t0.892\n" +
    "Sample-2\t1.234"
  )
  const [standards, setStandards] = useState<StandardPoint[]>([])
  const [unknowns, setUnknowns] = useState<UnknownSample[]>([])
  const [fitResult, setFitResult] = useState<FitResult | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // 数据解析
  const parseData = useCallback(() => {
    const lines = rawInput.trim().split('\n')
    const stds: StandardPoint[] = []
    const unks: UnknownSample[] = []
    let section: 'std' | 'unk' | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.includes('标准品') || trimmed.includes('浓度')) { section = 'std'; continue }
      if (trimmed.includes('未知') || trimmed.includes('样本')) { section = 'unk'; continue }

      const parts = trimmed.split(/\t|\s+/)
      if (parts.length >= 2) {
        const v1 = parseFloat(parts[0].replace(/,/g, ''))
        const v2 = parseFloat(parts[1].replace(/,/g, ''))
        if (section === 'std' && !isNaN(v1) && !isNaN(v2)) {
          stds.push({ concentration: v1, od: v2 })
        } else if (section === 'unk' && !isNaN(v2)) {
          unks.push({ name: parts[0], od: v2 })
        }
      }
    }

    if (stds.length === 0) {
      let foundZero = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.includes('浓度') || trimmed.includes('样本')) continue
        const parts = trimmed.split(/\t|\s+/)
        if (parts.length >= 2) {
          const v1 = parseFloat(parts[0])
          const v2 = parseFloat(parts[1])
          if (!isNaN(v1) && !isNaN(v2)) {
            if (v1 === 0) foundZero = true
            if ((foundZero || v1 > 0) && v1 >= 0 && stds.length < 10) {
              stds.push({ concentration: v1, od: v2 })
            } else if (!isNaN(v2)) {
              unks.push({ name: parts[0], od: v2 })
            }
          }
        }
      }
    }
    return { stds, unks }
  }, [rawInput])

  // 4PL拟合 - 调用内联核心算法
  const handle4PL = () => {
    setError('')
    setIsLoading(true)
    try {
      const { stds, unks } = parseData()
      if (stds.length < 4) {
        setError('标准品数据不足，至少需要 4 个浓度点')
        setIsLoading(false)
        return
      }
      stds.sort((a, b) => a.concentration - b.concentration)
      setStandards(stds)

      // 调用内联的核心算法
      const concentrations = stds.map(s => s.concentration)
      const odValues = stds.map(s => s.od)
      const core = fit4PLCore(concentrations, odValues)

      const fitResult: FitResult = {
        A: core.A, B: core.B, C: core.C, D: core.D,
        r2: core.r2, type: '4pl',
        points: stds.map((s, i) => ({ x: s.concentration, y: s.od, predicted: core.yPredicted[i] }))
      }
      setFitResult(fitResult)

      // 计算样本浓度
      const calculated = unks.map(u => {
        const conc = fourPLInverse(u.od, core.A, core.B, core.C, core.D)
        return { name: u.name, od: u.od, concentration: conc === Infinity ? undefined : conc }
      })
      setUnknowns(calculated)
      setActiveTab('curve')
    } catch (err: any) {
      setError('4PL 拟合失败：' + (err.message || '未知错误'))
    } finally {
      setIsLoading(false)
    }
  }

  // 线性拟合
  const handleLinear = () => {
    setError('')
    setIsLoading(true)
    try {
      const { stds, unks } = parseData()
      if (stds.length < 3) { setError('标准品数据不足'); setIsLoading(false); return }
      stds.sort((a, b) => a.concentration - b.concentration)
      setStandards(stds)

      const n = stds.length
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
      for (const d of stds) {
        const lx = Math.log10(d.concentration + 1e-6)
        sumX += lx; sumY += d.od; sumXY += lx * d.od; sumX2 += lx * lx
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n

      const points = stds.map(d => {
        const lx = Math.log10(d.concentration + 1e-6)
        return { x: d.concentration, y: d.od, predicted: slope * lx + intercept }
      })
      const meanY = sumY / n
      const ssTot = stds.reduce((s, d) => s + (d.od - meanY) ** 2, 0)
      const ssRes = points.reduce((s, p) => s + (p.y - p.predicted) ** 2, 0)

      const result: FitResult = { A: 0, B: slope, C: 0, D: intercept, r2: 1 - ssRes / ssTot, type: 'linear', points }
      setFitResult(result)

      const calculated = unks.map(u => {
        const lx = (u.od - result.D) / result.B
        return { ...u, concentration: Math.pow(10, lx) }
      })
      setUnknowns(calculated)
      setActiveTab('curve')
    } catch (err: any) {
      setError('线性拟合失败：' + (err.message || '未知错误'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setRawInput('')
    setStandards([])
    setUnknowns([])
    setFitResult(null)
    setError('')
  }

  const handleImportCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.txt'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => { setRawInput((ev.target?.result as string) || '') }
      reader.readAsText(file)
    }
    input.click()
  }

  const exportReport = () => {
    if (!fitResult) return
    const lines = [
      'ELISA 实验数据分析报告', '生成时间: ' + new Date().toLocaleString(), '',
      '【拟合方法】' + (fitResult.type === '4pl' ? '四参数逻辑斯蒂拟合 (4PL)' : '线性拟合 (Log-Log)'),
      '【拟合参数】',
      ...(fitResult.type === '4pl' ? [
        'A (Bottom / 最小OD): ' + fitResult.A.toFixed(4),
        'B (Hill斜率): ' + fitResult.B.toFixed(4),
        'C (EC50): ' + fitResult.C.toFixed(4),
        'D (Top / 最大OD): ' + fitResult.D.toFixed(4),
      ] : [ 'Slope: ' + fitResult.B.toFixed(4), 'Intercept: ' + fitResult.D.toFixed(4) ]),
      'R² = ' + fitResult.r2.toFixed(6),
      fitResult.type === '4pl' ? '拟合质量: ' + getFitQuality(fitResult.r2) : '',
      fitResult.type === '4pl' ? '回归方程: ' + formatEquation(fitResult.A, fitResult.B, fitResult.C, fitResult.D) : '',
      '', '【标准品数据】', '浓度(pg/mL)\tOD450\t预测值',
      ...standards.map(s => {
        const pred = fitResult.type === '4pl'
          ? fourPLFormula(s.concentration, fitResult.A, fitResult.B, fitResult.C, fitResult.D)
          : fitResult.B * Math.log10(s.concentration) + fitResult.D
        return s.concentration + '\t' + s.od.toFixed(3) + '\t' + pred.toFixed(3)
      }),
      '', '【未知样本浓度】', '样本名称\tOD450\t浓度(pg/mL)',
      ...unknowns.map(u => u.name + '\t' + u.od.toFixed(3) + '\t' + (u.concentration ? u.concentration.toFixed(3) : 'N/A')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ELISA_Report_' + Date.now() + '.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  // SVG曲线绘制
  const renderCurve = () => {
    if (!fitResult || standards.length === 0) return null

    const width = 700, height = 400
    const pad = { top: 30, right: 40, bottom: 60, left: 70 }
    const cw = width - pad.left - pad.right
    const ch = height - pad.top - pad.bottom

    const nonZero = standards.filter(s => s.concentration > 0)
    if (nonZero.length === 0) return null

    const xMin = Math.max(0.1, Math.min(...nonZero.map(s => s.concentration)) * 0.5)
    const xMax = Math.max(...nonZero.map(s => s.concentration)) * 1.5
    const yMin = 0
    const yMax = Math.max(...standards.map(s => s.od)) * 1.1

    const xScale = (x: number) => {
      if (x <= 0) return pad.left
      return pad.left + ((Math.log10(x) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * cw
    }
    const yScale = (y: number) => pad.top + ch - ((y - yMin) / (yMax - yMin)) * ch

    const curvePoints: string[] = []
    for (let i = 0; i <= 100; i++) {
      const lx = Math.log10(xMin) + (i / 100) * (Math.log10(xMax) - Math.log10(xMin))
      const x = Math.pow(10, lx)
      const y = fitResult.type === '4pl'
        ? fourPLFormula(x, fitResult.A, fitResult.B, fitResult.C, fitResult.D)
        : fitResult.B * Math.log10(x) + fitResult.D
      if (!isNaN(y) && y >= yMin && y <= yMax) curvePoints.push(`${xScale(x)},${yScale(y)}`)
    }

    const gridX = [1, 10, 100, 1000].filter(v => v >= xMin && v <= xMax)
    const gridY = Array.from({ length: 6 }, (_, i) => (yMax / 5) * i)

    return (
      <svg ref={svgRef} width={width} height={height} className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {gridX.map(v => <line key={`gx-${v}`} x1={xScale(v)} y1={pad.top} x2={xScale(v)} y2={pad.top + ch} stroke="#E2E8F0" strokeDasharray="4,4" />)}
        {gridY.map((v, i) => <line key={`gy-${i}`} x1={pad.left} y1={yScale(v)} x2={pad.left + cw} y2={yScale(v)} stroke="#E2E8F0" strokeDasharray="4,4" />)}
        <line x1={pad.left} y1={pad.top + ch} x2={pad.left + cw} y2={pad.top + ch} stroke="#94A3B8" strokeWidth={1.5} />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ch} stroke="#94A3B8" strokeWidth={1.5} />
        {gridX.map(v => <text key={`lx-${v}`} x={xScale(v)} y={pad.top + ch + 25} textAnchor="middle" fontSize={12} fill="#64748B">{v}</text>)}
        <text x={pad.left + cw / 2} y={height - 10} textAnchor="middle" fontSize={13} fill="#475569" fontWeight={500}>浓度 (pg/mL) — 对数刻度</text>
        {gridY.map((v, i) => <text key={`ly-${i}`} x={pad.left - 12} y={yScale(v) + 4} textAnchor="end" fontSize={12} fill="#64748B">{v.toFixed(2)}</text>)}
        <text x={18} y={pad.top + ch / 2} textAnchor="middle" fontSize={13} fill="#475569" fontWeight={500} transform={`rotate(-90, 18, ${pad.top + ch / 2})`}>OD450</text>
        {curvePoints.length > 1 && <polyline points={curvePoints.join(' ')} fill="none" stroke="#3B82F6" strokeWidth={2.5} strokeLinecap="round" />}
        {standards.map((s, i) => (
          <g key={`s-${i}`}>
            <circle cx={xScale(s.concentration)} cy={yScale(s.od)} r={6} fill="#3B82F6" stroke="white" strokeWidth={2} />
            <text x={xScale(s.concentration)} y={yScale(s.od) - 12} textAnchor="middle" fontSize={11} fill="#1E293B" fontWeight={600}>{s.od.toFixed(3)}</text>
          </g>
        ))}
        {unknowns.map((u, i) => {
          if (!u.concentration || u.concentration <= 0 || u.concentration > xMax * 2) return null
          return (
            <g key={`u-${i}`}>
              <circle cx={xScale(u.concentration)} cy={yScale(u.od)} r={6} fill="#EF4444" stroke="white" strokeWidth={2} />
              <text x={xScale(u.concentration)} y={yScale(u.od) + 20} textAnchor="middle" fontSize={10} fill="#EF4444" fontWeight={600}>{u.name}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  // ============ JSX ============
  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3CB5C0] to-[#2563EB] flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#1E293B]">实验数据分析工作台</h1>
          </div>
          <p className="text-sm text-[#94A3B8]">从原始 OD 值到专业实验报告，一站式完成数据分析（参考 ELISA Calc 计算逻辑）</p>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { key: 'input' as TabType, label: '数据输入', icon: BarChart3 },
            { key: 'curve' as TabType, label: '标准曲线', icon: TrendingUp },
            { key: 'report' as TabType, label: '报告生成', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon, active = activeTab === tab.key
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                  ? 'bg-gradient-to-r from-[#3CB5C0] to-[#2563EB] text-white shadow-md'
                  : 'bg-white text-[#475569] hover:bg-blue-50 border border-gray-200'}`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {activeTab === 'input' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-600" /><h2 className="text-base font-semibold">OD 值输入</h2></div>
              <div className="flex gap-2">
                <button onClick={handleImportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#475569] bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"><Upload className="w-3.5 h-3.5" />导入 CSV</button>
                <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"><Trash2 className="w-3.5 h-3.5" />清空</button>
              </div>
            </div>
            <textarea value={rawInput} onChange={e => setRawInput(e.target.value)} rows={18}
              className="w-full px-4 py-3 bg-[#F8FAFC] border border-gray-200 rounded-xl text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder={'标准品浓度(pg/mL)\tOD450\n500\t2.845\n250\t1.923\n...\n\n未知样本\tOD450\nSample-1\t0.892'} />
            <div className="flex items-center gap-3 mt-5">
              <button onClick={handle4PL} disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#3CB5C0] to-[#2563EB] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 font-medium shadow-md">
                <Play className="w-4 h-4" />{isLoading ? '拟合中...' : '开始 4PL 拟合'}
              </button>
              <button onClick={handleLinear} disabled={isLoading}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-[#475569] rounded-xl hover:bg-gray-50 border border-gray-200 transition-colors font-medium">
                <Sigma className="w-4 h-4" />线性拟合
              </button>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div><p className="font-medium mb-1">数据格式说明</p><p>标准品：第一列为浓度（pg/mL），第二列为 OD450。未知样本：第一列为样本名称，第二列为 OD450。</p></div>
            </div>
          </div>
        )}

        {activeTab === 'curve' && fitResult && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" />标准曲线</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" />标准品</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" />未知样本</span>
                </div>
              </div>
              <div className="flex justify-center overflow-x-auto">{renderCurve()}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">拟合参数</h3>
                {fitResult.type === '4pl' ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#94A3B8]">A (Bottom / 最小OD)</span><span className="font-mono font-medium">{fitResult.A.toFixed(4)}</span></div>
                    <div className="flex justify-between"><span className="text-[#94A3B8]">B (Hill 斜率)</span><span className="font-mono font-medium">{fitResult.B.toFixed(4)}</span></div>
                    <div className="flex justify-between"><span className="text-[#94A3B8]">C (EC50)</span><span className="font-mono font-medium">{fitResult.C.toFixed(4)}</span></div>
                    <div className="flex justify-between"><span className="text-[#94A3B8]">D (Top / 最大OD)</span><span className="font-mono font-medium">{fitResult.D.toFixed(4)}</span></div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#94A3B8]">Slope</span><span className="font-mono font-medium">{fitResult.B.toFixed(4)}</span></div>
                    <div className="flex justify-between"><span className="text-[#94A3B8]">Intercept</span><span className="font-mono font-medium">{fitResult.D.toFixed(4)}</span></div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8] text-sm">R² 决定系数</span>
                    <span className={`font-mono font-bold text-lg ${fitResult.r2 > 0.99 ? 'text-emerald-600' : fitResult.r2 > 0.95 ? 'text-blue-600' : 'text-amber-600'}`}>{fitResult.r2.toFixed(6)}</span>
                  </div>
                  {fitResult.type === '4pl' && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-[#94A3B8] text-sm">拟合质量</span>
                        <span className="text-sm font-semibold text-emerald-600">{getFitQuality(fitResult.r2)}</span>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-700 font-mono break-all">{formatEquation(fitResult.A, fitResult.B, fitResult.C, fitResult.D)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">未知样本浓度</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {unknowns.length === 0 ? <p className="text-sm text-[#94A3B8]">未检测到未知样本数据</p> : unknowns.map((u, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm font-medium">{u.name}</span>
                      <div className="text-right">
                        <div className="text-sm font-mono font-semibold text-blue-600">{u.concentration ? `${u.concentration.toFixed(2)} pg/mL` : '超出量程'}</div>
                        <div className="text-xs text-[#94A3B8]">OD: {u.od.toFixed(3)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'curve' && !fitResult && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center"><TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-[#94A3B8]">请先完成数据拟合</p></div>
        )}

        {activeTab === 'report' && fitResult && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />实验报告</h2>
              <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3CB5C0] to-[#2563EB] text-white rounded-xl hover:opacity-90 transition-opacity text-sm font-medium shadow-md"><Download className="w-4 h-4" />导出报告</button>
            </div>
            <div className="space-y-6">
              <div className="p-4 bg-[#F8FAFC] rounded-xl">
                <h3 className="text-sm font-semibold text-[#1E293B] mb-2">拟合信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-[#94A3B8]">方法：</span>{fitResult.type === '4pl' ? '四参数逻辑斯蒂拟合 (4PL)' : '线性拟合 (Log-Log)'}</div>
                  <div><span className="text-[#94A3B8]">R²：</span><span className="font-mono font-semibold">{fitResult.r2.toFixed(6)}</span></div>
                  <div><span className="text-[#94A3B8]">标准品数量：</span>{standards.length}</div>
                  <div><span className="text-[#94A3B8]">未知样本数量：</span>{unknowns.length}</div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">标准品拟合详情</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-[#94A3B8] font-medium">浓度 (pg/mL)</th>
                      <th className="text-left py-2 px-3 text-[#94A3B8] font-medium">实测 OD</th>
                      <th className="text-left py-2 px-3 text-[#94A3B8] font-medium">预测 OD</th>
                      <th className="text-left py-2 px-3 text-[#94A3B8] font-medium">残差</th>
                    </tr></thead>
                    <tbody>{standards.map((s, i) => {
                      const pred = fitResult.type === '4pl'
                        ? fourPLFormula(s.concentration, fitResult.A, fitResult.B, fitResult.C, fitResult.D)
                        : fitResult.B * Math.log10(s.concentration) + fitResult.D
                      return <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 px-3 font-mono">{s.concentration}</td>
                        <td className="py-2 px-3 font-mono">{s.od.toFixed(3)}</td>
                        <td className="py-2 px-3 font-mono text-blue-600">{pred.toFixed(3)}</td>
                        <td className="py-2 px-3 font-mono">{(s.od - pred).toFixed(4)}</td>
                      </tr>
                    })}</tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">未知样本浓度结果</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-[#94A3B8] font-medium">样本名称</th>
                      <th className="text-left py-2 px-3 text-[#94A3B8] font-medium">OD450</th>
                      <th className="text-left py-2 px-3 text-[#94A3B8] font-medium">浓度 (pg/mL)</th>
                    </tr></thead>
                    <tbody>{unknowns.map((u, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 px-3 font-medium">{u.name}</td>
                        <td className="py-2 px-3 font-mono">{u.od.toFixed(3)}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-blue-600">{u.concentration ? u.concentration.toFixed(2) : '超出量程'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && !fitResult && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-[#94A3B8]">请先完成数据拟合</p></div>
        )}
      </div>
    </div>
  )
}
