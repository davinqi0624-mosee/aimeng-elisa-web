'use client'

import { useState, useRef, useCallback, type DragEvent, type ClipboardEvent } from 'react'
import {
  BarChart3, TrendingUp, FileText, Play, Download, Trash2, Upload,
  CheckCircle2, AlertCircle, Settings,
  Table, FileSpreadsheet, Eye,
  Info, X, ArrowDownToLine
} from 'lucide-react'

// ═══════════════════════════════════════════
//  ELISA 数据分析工作台 — 完整版
//  支持: 4PL/5PL/线性拟合, 权重, 复孔, 质控, 报告导出
// ═══════════════════════════════════════════

// ── 拟合模型类型 ──
type FitModel = '4pl' | '5pl' | 'linear' | 'log-log'
type WeightMode = 'none' | '1/y' | '1/y²'
type BlankCorrectionMode = 'none' | 'subtract'

interface StandardPoint {
  concentration: number
  well?: string
  rawReplicates?: number[]
  rawMean?: number
  replicates: number[]
  mean: number
  sd: number
  cv: number
  outlier?: boolean
}

interface UnknownSample {
  editKey?: string
  name: string
  well?: string
  sampleGroup?: string
  sortIndex?: number
  rawReplicates?: number[]
  rawMean?: number
  replicates: number[]
  mean: number
  sd: number
  cv: number
  calculatedConcentration?: number
  concentration?: number
  concentrationStatus?: ConcentrationStatus
  concentrationMessage?: string
  dilution?: number
}

type ConcentrationStatus = 'ok' | 'below' | 'above' | 'invalid'

interface SampleOverride {
  name?: string
  dilution?: number
}

interface FitResult {
  model: FitModel
  params: Record<string, number>
  r2: number
  rmse: number
  points: { x: number; y: number; predicted: number; residual: number }[]
  standards: StandardPoint[]
  unknowns: UnknownSample[]
  quality: 'excellent' | 'good' | 'acceptable' | 'poor'
  warnings: string[]
  blankCorrectionMode: BlankCorrectionMode
  blankOd?: number
}

interface QCResult {
  cvWarnings: { idx: number; cv: number }[]
  outlierPoints: { idx: number; residual: number; threshold: number }[]
  recoveryChecks: { name: string; expected: number; actual: number; recovery: number }[]
}

type TabType = 'input' | 'curve' | 'table' | 'report'

const DEFAULT_STANDARD_CONCENTRATIONS = [0, 125, 250, 500, 1000, 2000, 4000, 8000]
const ANALYSIS_ENGINE_VERSION = '4PL-ELISACalc-20260822'
const PLATE_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const PLATE_ROW_TO_STANDARD_CONCENTRATION: Record<string, number> = {
  A: 0,
  B: 125,
  C: 250,
  D: 500,
  E: 1000,
  F: 2000,
  G: 4000,
  H: 8000,
}

function formatWell(rowIndex: number, columnNumber: number) {
  return `${PLATE_ROWS[rowIndex] || ''}${String(columnNumber).padStart(2, '0')}`
}

function normalizeWell(value: string | undefined) {
  const match = value?.trim().match(/^([A-Ha-h])0?([1-9]|1[0-2])$/)
  if (!match) return undefined
  return `${match[1].toUpperCase()}${match[2].padStart(2, '0')}`
}

function formatConcentrationValue(value: number | undefined) {
  return value !== undefined && Number.isFinite(value) ? value.toFixed(2) : '--'
}

function getStandardFinalConcentration(backCalculatedConcentration: number | undefined) {
  return backCalculatedConcentration !== undefined && Number.isFinite(backCalculatedConcentration)
    ? backCalculatedConcentration
    : undefined
}

function getConcentrationStatusLabel(status: ConcentrationStatus | undefined) {
  if (status === 'below') return '低于量程'
  if (status === 'above') return '高于量程'
  if (status === 'invalid') return '无法反算'
  return '正常'
}

function getConcentrationStatusClass(status: ConcentrationStatus | undefined) {
  if (status === 'below') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (status === 'above' || status === 'invalid') return 'text-red-600 bg-red-50 border-red-200'
  return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}

function getSampleOverrideKey(sample: { name: string; well?: string; sampleGroup?: string; sortIndex?: number }, index: number) {
  return sample.well || `${sample.sampleGroup || 'sample'}-${sample.sortIndex ?? index}-${sample.name}`
}

function getStandardDisplayLabels(standards: Array<{ concentration: number }>) {
  const labelsByIndex = new Map<number, string>()
  standards
    .map((standard, index) => ({ ...standard, index }))
    .filter(standard => Math.abs(standard.concentration) >= 1e-12)
    .sort((a, b) => b.concentration - a.concentration)
    .forEach((standard, index) => {
      labelsByIndex.set(standard.index, `S${index + 1}`)
    })

  return standards.map((standard, index) => {
    if (Math.abs(standard.concentration) < 1e-12) return 'Blank'
    return labelsByIndex.get(index) || `S${index + 1}`
  })
}

// ═══════════════════════════════════════════
// 数学核心算法
// ═══════════════════════════════════════════

/** 4PL: y = D + (A-D) / (1 + (x/C)^B) */
function fourPL(x: number, A: number, B: number, C: number, D: number): number {
  const xs = Math.max(x, 1e-12)
  return D + (A - D) / (1.0 + Math.pow(xs / C, B))
}

/** 4PL 反函数 */
function fourPLInverse(y: number, A: number, B: number, C: number, D: number): number {
  if (y >= D) return Infinity
  if (y <= A) return 0
  const ratio = (A - D) / (y - D) - 1
  if (ratio <= 0) return 0
  return C * Math.pow(ratio, 1.0 / B)
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value)
    return 1 / (1 + z)
  }
  const z = Math.exp(value)
  return z / (1 + z)
}

function boundedFromLogit(value: number, min: number, max: number) {
  return min + sigmoid(value) * (max - min)
}

function boundedToLogit(value: number, min: number, max: number) {
  const clamped = clampNumber(value, min + (max - min) * 1e-6, max - (max - min) * 1e-6)
  const ratio = (clamped - min) / (max - min)
  return Math.log(ratio / (1 - ratio))
}

/** 5PL: y = D + (A-D) / (1 + (x/C)^B)^E  (E=1 时退化为 4PL) */
function fivePL(x: number, A: number, B: number, C: number, D: number, E: number): number {
  const xs = Math.max(x, 1e-12)
  return D + (A - D) / Math.pow(1.0 + Math.pow(xs / C, B), E)
}

/** 5PL 反函数 (数值求解) */
function fivePLInverse(y: number, A: number, B: number, C: number, D: number, E: number): number {
  if (y >= D) return Infinity
  if (y <= A) return 0
  const ratio = (A - D) / (y - D)
  const inner = Math.pow(ratio, 1.0 / E) - 1
  if (inner <= 0) return 0
  return C * Math.pow(inner, 1.0 / B)
}

/** 线性拟合: y = kx + b */
function linearFit(x: number[], y: number[]): { k: number; b: number } {
  const n = x.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i]; sumXY += x[i] * y[i]; sumX2 += x[i] * x[i]
  }
  const k = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const b = (sumY - k * sumX) / n
  return { k, b }
}

/** Log-Log 线性拟合 */
function logLogFit(x: number[], y: number[]): { k: number; b: number } {
  const lx = x.map(v => Math.log10(Math.max(v, 1e-12)))
  return linearFit(lx, y)
}

/** 权重计算 */
function getWeights(y: number[], mode: WeightMode): number[] {
  switch (mode) {
    case '1/y': return y.map(v => 1.0 / Math.max(v, 1e-6))
    case '1/y²': return y.map(v => 1.0 / Math.max(v * v, 1e-12))
    default: return y.map(() => 1.0)
  }
}

/** R² 计算 */
function rSquared(y: number[], yPred: number[]): number {
  const mean = y.reduce((s, v) => s + v, 0) / y.length
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0)
  const ssRes = y.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0)
  return ssTot > 0 ? 1 - ssRes / ssTot : 0
}

/** 加权 R² */
/** 4PL 加权 Levenberg-Marquardt 拟合 - 修复版 */
function fit4PLWeighted(x: number[], y: number[], weights: number[]): { A: number; B: number; C: number; D: number; r2: number; rmse: number } {
  if (x.length < 4) throw new Error('至少需要 4 个数据点')
  const positiveX = x.filter(v => v > 0)
  if (positiveX.length < 3) throw new Error('至少需要 3 个非零浓度点')

  const minX = Math.min(...positiveX)
  const maxX = Math.max(...positiveX)
  const minY = Math.min(...y)
  const maxY = Math.max(...y)
  const yRange = Math.max(maxY - minY, maxY * 0.1, 0.05)

  const bounds = {
    A: {
      min: Math.max(0, minY - yRange * 0.75),
      max: Math.max(0.000001, minY + yRange * 0.75),
    },
    B: { min: 0.05, max: 6 },
    C: { min: Math.max(minX / 100, 1e-9), max: Math.max(maxX * 100, minX * 10) },
    D: {
      min: Math.max(0.000001, maxY - yRange * 0.5),
      max: Math.max(maxY + yRange * 120, maxY * 60, 100),
    },
  }

  const fromTransformed = (p: number[]) => {
    const A = boundedFromLogit(p[0], bounds.A.min, bounds.A.max)
    const B = boundedFromLogit(p[1], bounds.B.min, bounds.B.max)
    const C = boundedFromLogit(p[2], bounds.C.min, bounds.C.max)
    const D = boundedFromLogit(p[3], bounds.D.min, bounds.D.max)
    return { A, B, C, D }
  }

  const toTransformed = (A: number, B: number, C: number, D: number) => [
    boundedToLogit(A, bounds.A.min, bounds.A.max),
    boundedToLogit(B, bounds.B.min, bounds.B.max),
    boundedToLogit(C, bounds.C.min, bounds.C.max),
    boundedToLogit(D, bounds.D.min, bounds.D.max),
  ]

  const rss = (p: number[]) => {
    const { A, B, C, D } = fromTransformed(p)
    if (!Number.isFinite(A) || !Number.isFinite(B) || !Number.isFinite(C) || !Number.isFinite(D) || D <= A + 1e-9) {
      return Number.POSITIVE_INFINITY
    }
    let s = 0
    for (let i = 0; i < x.length; i++) {
      const predicted = fourPL(x[i], A, B, C, D)
      if (!Number.isFinite(predicted)) return Number.POSITIVE_INFINITY
      const r = y[i] - predicted
      s += weights[i] * r * r
    }
    return s
  }

  const nelderMead = (start: number[]) => {
    const n = start.length
    let simplex = [start]
    const steps = [0.8, 0.8, 0.9, 0.8]
    for (let i = 0; i < n; i++) {
      const point = [...start]
      point[i] += steps[i]
      simplex.push(point)
    }
    let values = simplex.map(rss)

    for (let iter = 0; iter < 2500; iter++) {
      const order = values
        .map((value, index) => ({ value, index }))
        .sort((a, b) => a.value - b.value)
        .map(item => item.index)
      simplex = order.map(i => simplex[i])
      values = order.map(i => values[i])

      const centroid = new Array(n).fill(0)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n
      }

      const reflected = centroid.map((c, j) => c + (c - simplex[n][j]))
      const reflectedValue = rss(reflected)

      if (reflectedValue < values[0]) {
        const expanded = centroid.map((c, j) => c + 2 * (c - simplex[n][j]))
        const expandedValue = rss(expanded)
        simplex[n] = expandedValue < reflectedValue ? expanded : reflected
        values[n] = Math.min(expandedValue, reflectedValue)
      } else if (reflectedValue < values[n - 1]) {
        simplex[n] = reflected
        values[n] = reflectedValue
      } else {
        const contracted = centroid.map((c, j) => c + 0.5 * (simplex[n][j] - c))
        const contractedValue = rss(contracted)
        if (contractedValue < values[n]) {
          simplex[n] = contracted
          values[n] = contractedValue
        } else {
          for (let i = 1; i <= n; i++) {
            simplex[i] = simplex[0].map((best, j) => best + 0.5 * (simplex[i][j] - best))
            values[i] = rss(simplex[i])
          }
        }
      }

      const spread = Math.max(...values) - Math.min(...values)
      if (spread < 1e-14) break
    }

    const bestIndex = values.indexOf(Math.min(...values))
    return { transformed: simplex[bestIndex], rss: values[bestIndex] }
  }

  const cSeeds = [
    Math.sqrt(minX * maxX),
    maxX / 2,
    maxX,
    maxX * 2,
    ...positiveX,
  ].filter(v => v > 0 && isFinite(v))
  const aSeeds = [
    Math.max(0, minY * 0.5),
    Math.max(0, minY * 0.8),
    Math.max(0, minY),
    Math.max(0, minY - Math.abs(maxY - minY) * 0.05),
  ]
  const dSeeds = [maxY * 1.02, maxY * 1.2, maxY * 1.8, maxY * 3, maxY * 10, maxY * 25, bounds.D.max * 0.5]
  const bSeeds = [0.45, 0.65, 0.85, 1, 1.4, 2, 3]

  let best: { transformed: number[]; rss: number } | null = null
  for (const a of aSeeds) {
    for (const d of dSeeds) {
      if (d <= a) continue
      for (const b of bSeeds) {
        for (const c of cSeeds) {
          const start = toTransformed(a, b, c, d)
          const result = nelderMead(start)
          if (!best || result.rss < best.rss) best = result
        }
      }
    }
  }

  if (!best) throw new Error('4PL 拟合失败：无法找到有效初始参数')

  const { A, B, C, D } = fromTransformed(best.transformed)
  const yPred = x.map(v => fourPL(v, A, B, C, D))
  if ([A, B, C, D, ...yPred].some(value => !Number.isFinite(value)) || D <= A) {
    throw new Error('4PL 拟合失败：参数超出有效范围，请检查标准品浓度和 OD 是否对应')
  }
  const r2 = rSquared(y, yPred)
  const rmse = Math.sqrt(y.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0) / y.length)

  return { A, B, C, D, r2, rmse }
}

/** 5PL 加权拟合 */
function fit5PLWeighted(x: number[], y: number[], weights: number[]): { A: number; B: number; C: number; D: number; E: number; r2: number; rmse: number } {
  if (x.length < 5) throw new Error('5PL 需要至少 5 个数据点')
  // 先用 4PL 初始化
  const init4 = fit4PLWeighted(x, y, weights)
  let params = [init4.A, init4.B, init4.C, init4.D, 1.0]
  let lambda = 0.01
  const maxIter = 300
  const tol = 1e-8

  const rss = (p: number[]) => {
    const [pA, pB, pC, pD, pE] = p
    let s = 0
    for (let i = 0; i < x.length; i++) {
      const r = y[i] - fivePL(x[i], pA, pB, pC, pD, pE)
      s += weights[i] * r * r
    }
    return s
  }

  let prevRSS = rss(params)
  for (let iter = 0; iter < maxIter; iter++) {
    const J = jacobian5PL(x, params)

    const JTJ = Array.from({ length: 5 }, () => new Array(5).fill(0))
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        for (let k = 0; k < x.length; k++) {
          JTJ[i][j] += weights[k] * J[k][i] * J[k][j]
        }
      }
    }

    const JTr = new Array(5).fill(0)
    for (let i = 0; i < 5; i++) {
      for (let k = 0; k < x.length; k++) {
        const r = y[k] - fivePL(x[k], params[0], params[1], params[2], params[3], params[4])
        JTr[i] += weights[k] * J[k][i] * r
      }
    }

    for (let i = 0; i < 5; i++) JTJ[i][i] += lambda * JTJ[i][i]
    const delta = solveLinear(JTJ, JTr)
    const np = [
      Math.max(0, Math.min(params[0] + delta[0], Math.min(...y) * 1.5)),
      Math.max(0.01, Math.min(params[1] + delta[1], 10)),
      Math.max(0.001, params[2] + delta[2]),
      Math.max(Math.max(...y) * 0.8, Math.min(params[3] + delta[3], Math.max(...y) * 3)),
      Math.max(0.1, Math.min(params[4] + delta[4], 3))
    ]

    const newRSS = rss(np)
    if (newRSS < prevRSS) {
      params = np
      lambda *= 0.1
      prevRSS = newRSS
    } else {
      lambda *= 10
    }

    const deltaNorm = Math.sqrt(delta.reduce((s, d) => s + d * d, 0))
    if (deltaNorm < tol) break
  }

  const [pA, pB, pC, pD, pE] = params
  const yPred = x.map(v => fivePL(v, pA, pB, pC, pD, pE))
  const r2 = rSquared(y, yPred)
  const rmse = Math.sqrt(y.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0) / y.length)

  return { A: pA, B: pB, C: pC, D: pD, E: pE, r2, rmse }
}

/** 5PL Jacobian */
function jacobian5PL(x: number[], p: number[]): number[][] {
  const [jA, jB, jC, jD, jE] = p
  return x.map(v => {
    if (v <= 0) return [1, 0, 0, 1, 0]
    const xc = Math.pow(v / jC, jB)
    const denom = 1 + xc
    const dA = 1 / Math.pow(denom, jE)
    const dB = -(jA - jD) * jE * xc * Math.log(v / jC) / Math.pow(denom, jE + 1)
    const dC = (jA - jD) * jE * jB * xc / (jC * Math.pow(denom, jE + 1))
    const dD = 1 - 1 / Math.pow(denom, jE)
    const dE = -(jA - jD) * Math.log(denom) / Math.pow(denom, jE)
    return [dA, dB, dC, dD, dE]
  })
}

/** 高斯消元求解线性方程组 */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = A.length
  const aug = A.map((row, i) => [...row, b[i]])

  for (let i = 0; i < n; i++) {
    let maxRow = i, maxVal = Math.abs(aug[i][i])
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > maxVal) { maxVal = Math.abs(aug[k][i]); maxRow = k }
    }
    ;[aug[i], aug[maxRow]] = [aug[maxRow], aug[i]]
    if (Math.abs(aug[i][i]) < 1e-14) continue

    for (let k = i + 1; k < n; k++) {
      const f = aug[k][i] / aug[i][i]
      for (let j = i; j <= n; j++) aug[k][j] -= f * aug[i][j]
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-14) { x[i] = 0; continue }
    let s = aug[i][n]
    for (let j = i + 1; j < n; j++) s -= aug[i][j] * x[j]
    x[i] = s / aug[i][i]
  }
  return x
}

/** 拟合质量评估 */
function getFitQuality(r2: number): { level: 'excellent' | 'good' | 'acceptable' | 'poor'; label: string } {
  if (r2 >= 0.999) return { level: 'excellent', label: '优秀 ✓✓✓' }
  if (r2 >= 0.995) return { level: 'good', label: '良好 ✓✓' }
  if (r2 >= 0.99) return { level: 'acceptable', label: '可接受 ✓' }
  return { level: 'poor', label: '需检查 ⚠' }
}

/** 格式化方程 */
function formatEquation(model: FitModel, params: Record<string, number>): string {
  if (model === '4pl') {
    return `Y = ${params.D.toFixed(4)} + (${params.A.toFixed(4)} - ${params.D.toFixed(4)}) / (1 + (X / ${params.C.toFixed(4)}) ^ ${params.B.toFixed(4)})`
  }
  if (model === '5pl') {
    return `Y = ${params.D.toFixed(4)} + (${params.A.toFixed(4)} - ${params.D.toFixed(4)}) / (1 + (X / ${params.C.toFixed(4)}) ^ ${params.B.toFixed(4)}) ^ ${params.E.toFixed(4)}`
  }
  return ''
}

function attachConcentrationResult(sample: UnknownSample, calculated: number, standardConcentrations: number[]): UnknownSample {
  const dilution = sample.dilution || 1
  const positiveStandards = standardConcentrations.filter(value => value > 0)
  const minStandard = positiveStandards.length > 0 ? Math.min(...positiveStandards) : Math.min(...standardConcentrations)
  const maxStandard = Math.max(...standardConcentrations)

  if (!Number.isFinite(calculated)) {
    return {
      ...sample,
      calculatedConcentration: undefined,
      concentration: undefined,
      concentrationStatus: calculated === Infinity ? 'above' : 'invalid',
      concentrationMessage: calculated === Infinity ? '样本 OD 高于标准曲线可反算范围' : '样本 OD 无法按当前曲线反算',
    }
  }

  const finalConcentration = calculated * dilution
  if (calculated <= 0 || calculated < minStandard) {
    return {
      ...sample,
      calculatedConcentration: Math.max(0, calculated),
      concentration: Math.max(0, finalConcentration),
      concentrationStatus: 'below',
      concentrationMessage: `低于最低非零标准品 ${minStandard} pg/mL`,
    }
  }

  if (calculated > maxStandard) {
    return {
      ...sample,
      calculatedConcentration: calculated,
      concentration: finalConcentration,
      concentrationStatus: 'above',
      concentrationMessage: `高于最高标准品 ${maxStandard} pg/mL`,
    }
  }

  return {
    ...sample,
    calculatedConcentration: calculated,
    concentration: finalConcentration,
    concentrationStatus: 'ok',
    concentrationMessage: '在标准曲线范围内',
  }
}

function makeLinearTicks(min: number, max: number, count: number): number[] {
  if (count <= 1 || max <= min) return [min, max]
  const rawStep = (max - min) / (count - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / magnitude
  const niceStep = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  const step = niceStep * magnitude
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = start; value <= max + step * 0.5; value += step) {
    ticks.push(Number(value.toFixed(8)))
  }
  if (ticks[0] !== min) ticks.unshift(min)
  return ticks.slice(0, count + 2)
}

function getStandardTrendWarning(standards: StandardPoint[]) {
  const ordered = [...standards]
    .filter(standard => Number.isFinite(standard.concentration) && Number.isFinite(standard.mean))
    .sort((a, b) => a.concentration - b.concentration)
  if (ordered.length < 4) return null

  const means = ordered.map(standard => standard.mean)
  const yRange = Math.max(...means) - Math.min(...means)
  const tolerance = Math.max(0.03, yRange * 0.08)
  let decreases = 0
  for (let index = 1; index < ordered.length; index++) {
    if (ordered[index].mean + tolerance < ordered[index - 1].mean) decreases += 1
  }

  return decreases >= 2
    ? '标准品 OD 与浓度没有呈现正常递增趋势，请检查模板中的标准品浓度、孔位和 OD 是否对应。'
    : null
}

// ═══════════════════════════════════════════
// 默认数据
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
// 主页面组件
// ═══════════════════════════════════════════

export default function ElisaAnalysisPage() {
  const [activeTab, setActiveTab] = useState<TabType>('input')
  const [rawInput, setRawInput] = useState('')
  const [fitModel, setFitModel] = useState<FitModel>('4pl')
  const [weightMode, setWeightMode] = useState<WeightMode>('none')
  const [blankCorrectionMode, setBlankCorrectionMode] = useState<BlankCorrectionMode>('none')
  const [fitResult, setFitResult] = useState<FitResult | null>(null)
  const [sampleOverrides, setSampleOverrides] = useState<Record<string, SampleOverride>>({})
  const [qcResult, setQcResult] = useState<QCResult | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOcrLoading, setIsOcrLoading] = useState(false)
  const [ocrMessage, setOcrMessage] = useState('')
  const [analysisRewardMessage, setAnalysisRewardMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // ── 解析数据 ──
  const parseData = useCallback(() => {
    const lines = rawInput.trim().split('\n')
    const standards: { concentration: number; well?: string; replicates: number[] }[] = []
    const unknowns: { name: string; well?: string; sampleGroup?: string; sortIndex?: number; replicates: number[]; dilution: number }[] = []
    let section: 'std' | 'unk' | null = null
    const splitLine = (value: string) => {
      const trimmed = value.trim()
      if (/[\t,;]/.test(trimmed)) {
        return trimmed.split(/\t|,|;/).map(part => part.trim())
      }
      return trimmed.split(/\s+/).filter(Boolean)
    }
    const parseNumber = (value: string | undefined) => {
      if (!value) return NaN
      return parseFloat(value.replace(/,/g, ''))
    }
    const normalizeHeader = (value: string | undefined) => (value || '').replace(/\s+/g, '').toLowerCase()
    const findHeaderIndex = (headers: string[], patterns: RegExp[]) =>
      headers.findIndex(header => patterns.some(pattern => pattern.test(normalizeHeader(header))))
    const findKnownConcentrationIndex = (headers: string[]) =>
      headers.findIndex((header) => {
        const normalized = normalizeHeader(header)
        if (!/浓度|concentration/.test(normalized)) return false
        if (/终浓度|最终浓度|反算浓度|回算浓度|final|back/.test(normalized)) return false
        return true
      })

    const tryParseVerticalTemplate = () => {
      const parsedRows = lines
        .map(line => splitLine(line))
        .filter(parts => parts.some(part => part.trim()))

      const headerIndex = parsedRows.findIndex((parts) => {
        const headers = parts.map(normalizeHeader)
        return (
          headers.some(header => /位置|孔位|well/.test(header)) &&
          headers.some(header => /类型|type/.test(header)) &&
          headers.some(header => /od|吸光|450/.test(header))
        )
      })
      if (headerIndex < 0) return false

      const headers = parsedRows[headerIndex]
      const wellIndex = findHeaderIndex(headers, [/位置/, /孔位/, /^well$/])
      const nameIndex = findHeaderIndex(headers, [/名称/, /样本编号/, /样本名称/, /name/])
      const typeIndex = findHeaderIndex(headers, [/类型/, /type/])
      const odIndex = findHeaderIndex(headers, [/od/, /吸光/, /450/])
      const concentrationIndex = findKnownConcentrationIndex(headers)
      const dilutionIndex = findHeaderIndex(headers, [/稀释/, /dilution/])

      if (wellIndex < 0 || nameIndex < 0 || typeIndex < 0 || odIndex < 0) return false

      const verticalStandards: { concentration: number; well?: string; replicates: number[] }[] = []
      const verticalUnknowns: { name: string; well?: string; sampleGroup?: string; sortIndex?: number; replicates: number[]; dilution: number }[] = []

      for (const [rowOffset, parts] of parsedRows.slice(headerIndex + 1).entries()) {
        const well = normalizeWell(parts[wellIndex])
        const rawName = (parts[nameIndex] || '').trim()
        const rawType = (parts[typeIndex] || '').trim()
        const od = parseNumber(parts[odIndex])
        const explicitConcentration = parseNumber(concentrationIndex >= 0 && concentrationIndex !== odIndex ? parts[concentrationIndex] : undefined)
        const dilution = parseNumber(dilutionIndex >= 0 ? parts[dilutionIndex] : undefined)
        if (!well || !Number.isFinite(od) || od < 0 || od > 4) continue

        const typeText = rawType.toLowerCase()
        const isBlank = /空白|blank|零标准/.test(typeText)
        const isStandard = isBlank || /标准|standard|std/.test(typeText)
        const isSample = /检测|样本|sample|unknown/.test(typeText)

        if (isStandard) {
          const concentrationFromName = parseNumber(rawName)
          const inferredByWell = well.endsWith('01')
            ? PLATE_ROW_TO_STANDARD_CONCENTRATION[well[0]]
            : undefined
          const concentration = isBlank
            ? 0
            : Number.isFinite(explicitConcentration)
              ? explicitConcentration
              : Number.isFinite(concentrationFromName)
                ? concentrationFromName
                : inferredByWell
          if (concentration !== undefined && Number.isFinite(concentration)) {
            verticalStandards.push({
              concentration,
              well,
              replicates: [od],
            })
          }
        } else if (isSample || rawName) {
          const rowNumber = Number(well.slice(1))
          const rowLetter = well[0]
          const rowOrder = PLATE_ROWS.indexOf(rowLetter)
          verticalUnknowns.push({
            name: rawName || well,
            well,
            sampleGroup: `${rowNumber}#`,
            sortIndex: rowNumber * 100 + Math.max(0, rowOrder >= 0 ? rowOrder : rowOffset),
            replicates: [od],
            dilution: Number.isFinite(dilution) && dilution > 0 ? dilution : 1,
          })
        }
      }

      if (verticalStandards.length < 4) return false
      standards.push(...verticalStandards)
      unknowns.push(...verticalUnknowns)
      return true
    }

    const tryParseRawPlateTable = () => {
      const plateRows = lines
        .map((line) => splitLine(line))
        .filter(parts => /^[A-Ha-h]$/.test(parts[0] || ''))
        .map(parts => ({
          row: parts[0].toUpperCase(),
          numbers: parts.slice(1).map(parseNumber).filter(value => !isNaN(value)),
        }))
        .filter(item => item.numbers.length > 0)

      const candidateBlocks: Array<Array<{ row: string; numbers: number[] }>> = []
      for (let start = 0; start < plateRows.length; start++) {
        if (plateRows[start].row !== 'A') continue
        const block: Array<{ row: string; numbers: number[] }> = []
        for (let offset = 0; offset < 8; offset++) {
          const expectedRow = String.fromCharCode(65 + offset)
          const item = plateRows[start + offset]
          if (!item || item.row !== expectedRow) break
          block.push(item)
        }
        if (block.length >= 7) candidateBlocks.push(block)
      }

      const standardRows = candidateBlocks.find((block) => {
        const firstColumn = block.map(item => item.numbers[0])
        return (
          firstColumn.length >= 7 &&
          Math.max(...firstColumn) <= 4 &&
          Math.min(...firstColumn) >= 0 &&
          firstColumn.filter((value, index) => index === 0 || value >= firstColumn[index - 1] * 0.7).length >= 6
        )
      }) || []

      if (standardRows.length < 7) return false

      const firstColumn = standardRows.map(item => item.numbers[0])
      const firstColumnLooksLikeOd =
        firstColumn.length >= 7 &&
        Math.max(...firstColumn) <= 4 &&
        Math.min(...firstColumn) >= 0 &&
        firstColumn.filter((value, index) => index === 0 || value >= firstColumn[index - 1] * 0.7).length >= 6

      if (!firstColumnLooksLikeOd) return false

      for (const item of standardRows) {
        standards.push({
          concentration: PLATE_ROW_TO_STANDARD_CONCENTRATION[item.row],
          well: `${item.row}01`,
          replicates: [item.numbers[0]],
        })
      }

      const maxColumns = Math.max(...standardRows.map(item => item.numbers.length))
      for (let columnIndex = 1; columnIndex < maxColumns; columnIndex++) {
        for (let rowIndex = 0; rowIndex < standardRows.length; rowIndex++) {
          const item = standardRows[rowIndex]
          const od = item.numbers[columnIndex]
          if (!isNaN(od) && od > 0 && od <= 4) {
            const sampleColumnNumber = columnIndex + 1
            unknowns.push({
              name: `${sampleColumnNumber}#-${rowIndex + 1}`,
              well: `${item.row}${String(sampleColumnNumber).padStart(2, '0')}`,
              sampleGroup: `${sampleColumnNumber}#`,
              sortIndex: sampleColumnNumber * 100 + rowIndex,
              replicates: [od],
              dilution: 1,
            })
          }
        }
      }

      return standards.length >= 7
    }

    const tryParseStandardOdOnlyTable = () => {
      const numericRows = lines
        .map(line => splitLine(line).map(parseNumber).filter(value => !isNaN(value)))
        .filter(values => values.length >= 1)

      if (numericRows.length !== 8) return false
      const firstColumn = numericRows.map(values => values[0])
      const standardTail = firstColumn.slice(1)
      const increasingLike = firstColumn.filter((value, index) => index === 0 || value >= firstColumn[index - 1] * 0.7).length >= 7
      const serialDilutionLike = standardTail.filter((value, index) => index === 0 || value <= standardTail[index - 1] * 1.3).length >= 6
      const looksLikeOdColumn =
        Math.min(...firstColumn) >= 0 &&
        Math.max(...firstColumn) <= 4 &&
        (increasingLike || serialDilutionLike)

      if (!looksLikeOdColumn) return false

      for (let index = 0; index < numericRows.length; index++) {
        standards.push({
          concentration: DEFAULT_STANDARD_CONCENTRATIONS[index],
          well: formatWell(index, 1),
          replicates: [numericRows[index][0]],
        })
      }

      for (let columnIndex = 1; columnIndex < Math.max(...numericRows.map(row => row.length)); columnIndex++) {
        for (let rowIndex = 0; rowIndex < numericRows.length; rowIndex++) {
          const od = numericRows[rowIndex][columnIndex]
          if (!isNaN(od) && od > 0 && od <= 4) {
            const sampleColumnNumber = columnIndex + 1
            unknowns.push({
              name: `${sampleColumnNumber}#-${rowIndex + 1}`,
              well: formatWell(rowIndex, sampleColumnNumber),
              sampleGroup: `${sampleColumnNumber}#`,
              sortIndex: sampleColumnNumber * 100 + rowIndex,
              replicates: [od],
              dilution: 1,
            })
          }
        }
      }

      return standards.length === 8
    }

    const parsedVerticalTemplate = tryParseVerticalTemplate()
    const parsedRawPlateTable = parsedVerticalTemplate ? false : tryParseRawPlateTable()
    const parsedStandardOdOnlyTable = parsedVerticalTemplate || parsedRawPlateTable ? false : tryParseStandardOdOnlyTable()
    const buildParsedData = (
      standardRows: { concentration: number; well?: string; replicates: number[] }[],
      unknownRows: { name: string; well?: string; sampleGroup?: string; sortIndex?: number; replicates: number[]; dilution: number }[]
    ) => {
      const blankReplicates = standardRows
        .filter(row => row.concentration === 0)
        .flatMap(row => row.replicates)
        .filter(value => Number.isFinite(value))
      const blankOd = blankReplicates.length > 0
        ? blankReplicates.reduce((sum, value) => sum + value, 0) / blankReplicates.length
        : undefined
      const correctReplicates = (values: number[]) => {
        if (blankCorrectionMode !== 'subtract' || blankOd === undefined) return values
        return values.map(value => Math.max(0, value - blankOd))
      }

      const stdPoints: StandardPoint[] = standardRows.map(s => {
        const replicates = correctReplicates(s.replicates)
        const rawMean = s.replicates.reduce((a, b) => a + b, 0) / s.replicates.length
        const mean = replicates.reduce((a, b) => a + b, 0) / replicates.length
        const sd = Math.sqrt(replicates.reduce((sq, v) => sq + (v - mean) ** 2, 0) / replicates.length)
        const cv = mean > 0 ? (sd / mean) * 100 : 0
        return { concentration: s.concentration, well: s.well, rawReplicates: s.replicates, rawMean, replicates, mean, sd, cv }
      })

      const unkSamples: UnknownSample[] = unknownRows.map((u, index) => {
        const editKey = getSampleOverrideKey(u, index)
        const override = sampleOverrides[editKey]
        const overrideName = override?.name?.trim()
        const overrideDilution = override?.dilution && override.dilution > 0 ? override.dilution : undefined
        const replicates = correctReplicates(u.replicates)
        const rawMean = u.replicates.reduce((a, b) => a + b, 0) / u.replicates.length
        const mean = replicates.reduce((a, b) => a + b, 0) / replicates.length
        const sd = Math.sqrt(replicates.reduce((sq, v) => sq + (v - mean) ** 2, 0) / replicates.length)
        const cv = mean > 0 ? (sd / mean) * 100 : 0
        return {
          editKey,
          name: overrideName || u.name,
          well: u.well,
          sampleGroup: u.sampleGroup,
          sortIndex: u.sortIndex ?? index,
          rawReplicates: u.replicates,
          rawMean,
          replicates,
          mean,
          sd,
          cv,
          dilution: overrideDilution ?? u.dilution,
        }
      })

      return {
        standards: stdPoints,
        unknowns: unkSamples,
        blankOd: blankCorrectionMode === 'subtract' ? blankOd : undefined,
        blankReplicateCount: blankReplicates.length,
      }
    }

    const firstDataLineIndex = lines.findIndex(line => line.trim())
    const headerParts = firstDataLineIndex >= 0 ? splitLine(lines[firstDataLineIndex]) : []
    const looksLikeElisaCalcWideTable =
      headerParts.length >= 3 &&
      headerParts[0].includes('浓度') &&
      headerParts.slice(1).some(part => part.includes('标准'))

    if (!parsedVerticalTemplate && !parsedRawPlateTable && !parsedStandardOdOnlyTable && looksLikeElisaCalcWideTable) {
      const dataRows = lines.slice(firstDataLineIndex + 1)
        .map(line => splitLine(line).map(parseNumber).filter(value => !isNaN(value)))
        .filter(values => values.length > 0)
      const firstColumnValues = dataRows.slice(0, 8).map(values => values[0])
      const firstColumnLooksLikeMisplacedStandardOd =
        firstColumnValues.length === 8 &&
        Math.min(...firstColumnValues) >= 0 &&
        Math.max(...firstColumnValues) <= 4 &&
        firstColumnValues.filter((value, index) => index === 0 || value >= firstColumnValues[index - 1] * 0.7).length >= 7

      if (firstColumnLooksLikeMisplacedStandardOd) {
        for (let index = 0; index < 8; index++) {
          standards.push({
            concentration: DEFAULT_STANDARD_CONCENTRATIONS[index],
            well: formatWell(index, 1),
            replicates: [firstColumnValues[index]],
          })
        }

        for (let columnIndex = 1; columnIndex < Math.max(...dataRows.map(row => row.length)); columnIndex++) {
          for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
            const od = dataRows[rowIndex][columnIndex]
            if (!isNaN(od) && od > 0 && od <= 4) {
              const sampleColumnNumber = columnIndex + 1
              unknowns.push({
                name: `${sampleColumnNumber}#-${rowIndex + 1}`,
                well: formatWell(rowIndex, sampleColumnNumber),
                sampleGroup: `${sampleColumnNumber}#`,
                sortIndex: sampleColumnNumber * 100 + rowIndex,
                replicates: [od],
                dilution: 1,
              })
            }
          }
        }

        return buildParsedData(standards, unknowns)
      }

      const headerColumns = headerParts.map((part, index) => ({ label: part.trim(), index }))
      const standardWellIndexes = headerColumns
        .filter(({ label, index }) => index > 0 && label.includes('标准') && (label.includes('孔位') || label.includes('位置')))
        .map(({ index }) => index)
      const standardOdIndexes = headerColumns
        .filter(({ label, index }) => (
          index > 0 &&
          label.includes('标准') &&
          !label.includes('孔位') &&
          !label.includes('位置')
        ))
        .map(({ index }) => index)
      const standardColIndex = standardOdIndexes[0] ?? Math.max(1, headerParts.findIndex(part => part.includes('标准')))
      const reservedStandardColumns = new Set([...standardWellIndexes, ...(standardOdIndexes.length > 0 ? standardOdIndexes : [standardColIndex])])
      const sampleGroups = new Map<string, { label: string; wellIndex?: number; nameIndex?: number; odIndex?: number; dilutionIndex?: number; firstIndex: number }>()
      const getSampleGroup = (rawLabel: string, index: number) => {
        const label = rawLabel
          .replace(/样本编号|样本名称|客户样本名称|编号|孔位|位置|OD值?|吸光值?|稀释倍数?|稀释度|样本/g, '')
          .trim() || `样本${index}`
        const group = sampleGroups.get(label) || { label, firstIndex: index }
        group.firstIndex = Math.min(group.firstIndex, index)
        sampleGroups.set(label, group)
        return group
      }

      for (const column of headerColumns) {
        if (column.index === 0 || reservedStandardColumns.has(column.index)) continue
        const group = getSampleGroup(column.label, column.index)
        if (column.label.includes('孔位') || column.label.includes('位置')) {
          group.wellIndex = column.index
        } else if (column.label.includes('样本编号') || column.label.includes('样本名称') || column.label.includes('客户样本名称') || column.label.includes('编号')) {
          group.nameIndex = column.index
        } else if (column.label.includes('稀释')) {
          group.dilutionIndex = column.index
        } else {
          group.odIndex = column.index
        }
      }

      const sampleColumns = Array.from(sampleGroups.values())
        .filter(group => group.odIndex !== undefined)
        .sort((a, b) => a.firstIndex - b.firstIndex)

      for (const [dataRowIndex, line] of lines.slice(firstDataLineIndex + 1).entries()) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parts = splitLine(trimmed)
        const conc = parseNumber(parts[0])
        const standardOds = (standardOdIndexes.length > 0 ? standardOdIndexes : [standardColIndex])
          .map(index => parseNumber(parts[index]))
          .filter(value => !isNaN(value))
        if (!isNaN(conc) && standardOds.length > 0) {
          const standardWell = standardWellIndexes
            .map(index => normalizeWell(parts[index]))
            .find(Boolean)
          standards.push({
            concentration: conc,
            well: standardWell || formatWell(standards.length, 1),
            replicates: standardOds,
          })
        }

        for (const [groupIndex, group] of sampleColumns.entries()) {
          const od = parseNumber(group.odIndex !== undefined ? parts[group.odIndex] : undefined)
          if (!isNaN(od)) {
            const dilution = parseNumber(group.dilutionIndex !== undefined ? parts[group.dilutionIndex] : undefined)
            const columnNumber = groupIndex + 2
            const sampleWell = normalizeWell(group.wellIndex !== undefined ? parts[group.wellIndex] : undefined)
            const sampleName = group.nameIndex !== undefined ? parts[group.nameIndex]?.trim() : ''
            unknowns.push({
              name: sampleName || `${group.label}-${dataRowIndex + 1}`,
              well: sampleWell || formatWell(dataRowIndex, columnNumber),
              sampleGroup: group.label,
              sortIndex: columnNumber * 100 + dataRowIndex,
              replicates: [od],
              dilution: !isNaN(dilution) && dilution > 0 ? dilution : 1,
            })
          }
        }
      }
    }

    if (!parsedVerticalTemplate && !parsedRawPlateTable && !parsedStandardOdOnlyTable && standards.length === 0) for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.includes('浓度') || trimmed.includes('标准')) { section = 'std'; continue }
      if (trimmed.includes('样本') || trimmed.includes('Sample') || trimmed.includes('未知')) { section = 'unk'; continue }
      if (trimmed.includes('OD') || trimmed.includes('稀释')) continue

      const parts = splitLine(trimmed)
      if (parts.length < 2) continue

      if (section === 'std') {
        const conc = parseNumber(parts[0])
        const ods = parts.slice(1).map(parseNumber).filter(n => !isNaN(n))
        if (!isNaN(conc) && ods.length > 0) {
          standards.push({ concentration: conc, replicates: ods })
        }
      } else if (section === 'unk') {
        const name = parts[0]
        const numericValues = parts.slice(1).map(parseNumber).filter(n => !isNaN(n))
        const dilution = numericValues.length >= 3 ? numericValues[numericValues.length - 1] : 1
        const ods = numericValues.length >= 3 ? numericValues.slice(0, -1) : numericValues
        if (ods.length > 0) {
          unknowns.push({ name, replicates: ods, dilution: dilution > 0 ? dilution : 1 })
        }
      }
    }

    // 如果没有分区标记，尝试自动识别
    if (!parsedVerticalTemplate && !parsedRawPlateTable && !parsedStandardOdOnlyTable && standards.length === 0 && unknowns.length === 0) {
      let foundZero = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.includes('浓度') || trimmed.includes('OD') || trimmed.includes('样本')) continue
        const parts = splitLine(trimmed)
        if (parts.length >= 2) {
          const v1 = parseNumber(parts[0])
          const ods = parts.slice(1).map(parseNumber).filter(n => !isNaN(n))
          if (!isNaN(v1) && ods.length > 0) {
            if (v1 === 0) foundZero = true
            if (foundZero || v1 > 0) {
              if (standards.length < 10) {
                standards.push({ concentration: v1, replicates: ods })
              } else {
                unknowns.push({ name: String(v1), replicates: ods, dilution: 1 })
              }
            }
          }
        }
      }
    }

    return buildParsedData(standards, unknowns)
  }, [rawInput, sampleOverrides, blankCorrectionMode])

  // ── 执行拟合 ──
  const handleFit = () => {
    setError('')
    setAnalysisRewardMessage('')
    setIsLoading(true)
    try {
      const { standards, unknowns, blankOd, blankReplicateCount } = parseData()
      if (standards.length < 4) {
        setError('标准品数据不足，至少需要 4 个浓度点（建议 7-8 点）')
        setIsLoading(false)
        return
      }
      if (blankCorrectionMode === 'subtract' && blankReplicateCount === 0) {
        setError('已选择“扣除空白”，但没有识别到 0 浓度标准品。请确认标准品中包含 Blank / 0 pg/mL，或切回“保留空白”。')
        setIsLoading(false)
        return
      }

      const maxConcentration = Math.max(...standards.map(s => s.concentration))
      const maxStandardOd = Math.max(...standards.map(s => s.mean))
      if (maxConcentration < 10 && maxStandardOd <= 4) {
        setError('标准品浓度看起来没有正确识别：第一列像 OD 值，不像浓度。请上传完整 Excel，或使用“浓度(pg/mL) + 标准品OD值”的表格。Human LRP1 这类原始孔板表会自动按 A-H 映射为 0、125、250、500、1000、2000、4000、8000。')
        setIsLoading(false)
        return
      }

      // 检查复孔 CV
      const cvWarnings = standards
        .map((s, i) => ({ idx: i, cv: s.cv }))
        .filter(c => c.cv > 20)

      const xData = standards.map(s => s.concentration)
      const yData = standards.map(s => s.mean)
      const weights = getWeights(yData, weightMode)

      let result: FitResult
      let params: Record<string, number>

      if (fitModel === '4pl') {
        const fit = fit4PLWeighted(xData, yData, weights)
        params = { A: fit.A, B: fit.B, C: fit.C, D: fit.D }
        const yPred = xData.map(x => fourPL(x, fit.A, fit.B, fit.C, fit.D))
        const points = xData.map((x, i) => ({
          x, y: yData[i], predicted: yPred[i], residual: yData[i] - yPred[i]
        }))

        // 计算未知样本浓度
        const calculatedUnknowns = unknowns.map(u => {
          const conc = fourPLInverse(u.mean, fit.A, fit.B, fit.C, fit.D)
          return attachConcentrationResult(u, conc, xData)
        })

        const quality = getFitQuality(fit.r2)
        const warnings: string[] = []
        if (cvWarnings.length > 0) warnings.push(`${cvWarnings.length} 个标准品复孔 CV% > 20%，建议检查实验操作`)
        const trendWarning = getStandardTrendWarning(standards)
        if (trendWarning) warnings.push(trendWarning)
        if (fit.r2 < 0.99) warnings.push('R² < 0.99，拟合质量一般，建议检查数据或更换拟合模型')

        result = {
          model: '4pl', params, r2: fit.r2, rmse: fit.rmse,
          points, standards, unknowns: calculatedUnknowns,
          quality: quality.level, warnings,
          blankCorrectionMode,
          blankOd,
        }
      } else if (fitModel === '5pl') {
        const fit = fit5PLWeighted(xData, yData, weights)
        params = { A: fit.A, B: fit.B, C: fit.C, D: fit.D, E: fit.E }
        const yPred = xData.map(x => fivePL(x, fit.A, fit.B, fit.C, fit.D, fit.E))
        const points = xData.map((x, i) => ({
          x, y: yData[i], predicted: yPred[i], residual: yData[i] - yPred[i]
        }))

        const calculatedUnknowns = unknowns.map(u => {
          const conc = fivePLInverse(u.mean, fit.A, fit.B, fit.C, fit.D, fit.E)
          return attachConcentrationResult(u, conc, xData)
        })

        const quality = getFitQuality(fit.r2)
        const warnings: string[] = []
        if (cvWarnings.length > 0) warnings.push(`${cvWarnings.length} 个标准品复孔 CV% > 20%`)
        const trendWarning = getStandardTrendWarning(standards)
        if (trendWarning) warnings.push(trendWarning)
        if (fit.r2 < 0.99) warnings.push('R² < 0.99，建议检查数据')

        result = {
          model: '5pl', params, r2: fit.r2, rmse: fit.rmse,
          points, standards, unknowns: calculatedUnknowns,
          quality: quality.level, warnings,
          blankCorrectionMode,
          blankOd,
        }
      } else {
        // 线性拟合
        const { k, b } = logLogFit(xData, yData)
        params = { k, b }
        const yPred = xData.map(x => k * Math.log10(Math.max(x, 1e-12)) + b)
        const points = xData.map((x, i) => ({
          x, y: yData[i], predicted: yPred[i], residual: yData[i] - yPred[i]
        }))

        const calculatedUnknowns = unknowns.map(u => {
          const lx = (u.mean - b) / k
          const conc = Math.pow(10, lx)
          return attachConcentrationResult(u, conc, xData)
        })

        const r2 = rSquared(yData, yPred)
        const rmse = Math.sqrt(yData.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0) / yData.length)
        const quality = getFitQuality(r2)

        result = {
          model: fitModel, params, r2, rmse,
          points, standards, unknowns: calculatedUnknowns,
          quality: quality.level, warnings: [],
          blankCorrectionMode,
          blankOd,
        }
      }

      // QC 检查
      const residuals = result.points.map(p => p.residual)
      const resSD = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length)
      const outlierPoints = result.points
        .map((p, i) => ({ idx: i, residual: Math.abs(p.residual), threshold: 2.5 * resSD }))
        .filter(p => p.residual > p.threshold)

      setQcResult({
        cvWarnings: standards.map((s, i) => ({ idx: i, cv: s.cv })).filter(c => c.cv > 20),
        outlierPoints,
        recoveryChecks: []
      })

      const rangeWarnings = result.unknowns
        .filter(sample => sample.concentrationStatus && sample.concentrationStatus !== 'ok')
        .map(sample => `${sample.well ? `${sample.well} ` : ''}${sample.name}: ${sample.concentrationMessage || getConcentrationStatusLabel(sample.concentrationStatus)}`)
      if (rangeWarnings.length > 0) {
        result.warnings = [
          ...result.warnings,
          `有 ${rangeWarnings.length} 个样本超出或接近标准曲线范围，请结合稀释倍数和原始 OD 复核。`,
          ...rangeWarnings.slice(0, 8),
        ]
      }
      if (blankCorrectionMode === 'subtract' && blankOd !== undefined) {
        result.warnings = [
          `已启用空白扣除：所有标准品和样本 OD 已扣除 Blank 平均 OD ${blankOd.toFixed(4)}。`,
          ...result.warnings,
        ]
      }

      setFitResult(result)
      setActiveTab('curve')

      if (fitModel === '4pl' && unknowns.length > 0) {
        void fetch('/api/points/rewards/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawInput: rawInput.slice(0, 500_000),
            fitModel,
            r2: result.r2,
            standards: standards.map((standard) => ({ concentration: standard.concentration, od: standard.mean })),
            samples: unknowns.map((sample) => ({ od: sample.mean })),
          }),
        })
          .then(async (response) => {
            const data = await response.json().catch(() => ({})) as { message?: string; error?: string }
            if (data.message) setAnalysisRewardMessage(data.message)
          })
          .catch(() => {
            // 奖励请求失败不影响本次计算结果。
          })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      setError('拟合失败：' + message)
    } finally {
      setIsLoading(false)
    }
  }

  const recalculateFitWithOverrides = (nextOverrides: Record<string, SampleOverride>) => {
    setSampleOverrides(nextOverrides)
    setFitResult(current => {
      if (!current) return current
      const standardConcentrations = current.standards.map(standard => standard.concentration)
      return {
        ...current,
        unknowns: current.unknowns.map((sample, index) => {
          const editKey = sample.editKey || getSampleOverrideKey(sample, index)
          const override = nextOverrides[editKey]
          const nextName = override?.name?.trim() || sample.name
          const nextDilution = override?.dilution && override.dilution > 0 ? override.dilution : sample.dilution || 1
          const renamedSample: UnknownSample = {
            ...sample,
            editKey,
            name: nextName,
            dilution: nextDilution,
          }
          const calculatedForRecheck =
            renamedSample.calculatedConcentration ??
            (renamedSample.concentrationStatus === 'above' ? Infinity : NaN)
          return attachConcentrationResult(renamedSample, calculatedForRecheck, standardConcentrations)
        }),
      }
    })
  }

  const updateSampleName = (sample: UnknownSample, value: string) => {
    const editKey = sample.editKey || getSampleOverrideKey(sample, 0)
    recalculateFitWithOverrides({
      ...sampleOverrides,
      [editKey]: {
        ...sampleOverrides[editKey],
        name: value,
      },
    })
  }

  const updateSampleDilution = (sample: UnknownSample, value: string) => {
    const editKey = sample.editKey || getSampleOverrideKey(sample, 0)
    const parsed = Number(value)
    recalculateFitWithOverrides({
      ...sampleOverrides,
      [editKey]: {
        ...sampleOverrides[editKey],
        dilution: Number.isFinite(parsed) && parsed > 0 ? parsed : 1,
      },
    })
  }

  // ── 清空 ──
  const handleClear = () => {
    setRawInput('')
    setFitResult(null)
    setSampleOverrides({})
    setQcResult(null)
    setError('')
    setOcrMessage('')
  }

  // ── 截图 OCR 识别 ──
  const handleImageOcr = async (file: File) => {
    setError('')
    setOcrMessage('')

    if (!file.type.startsWith('image/')) {
      setError('请上传 PNG、JPG 或 WebP 格式的 ELISA 数据截图')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('截图图片超过 8MB，请裁剪有效表格区域后再上传')
      return
    }

    setIsOcrLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch('/api/lab/analysis/ocr', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || '截图识别失败')
      if (!data.text) throw new Error('没有识别到可用数据')

      setRawInput(data.text)
      setFitResult(null)
      setSampleOverrides({})
      setQcResult(null)
      setOcrMessage('截图已识别，请核对数据后开始拟合计算。')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '截图识别失败，请换一张更清晰的截图，或上传 Excel 文件'
      setError(message)
    } finally {
      setIsOcrLoading(false)
    }
  }

  const handleImportImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) await handleImageOcr(file)
    }
    input.click()
  }

  const handlePasteData = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find(item => item.type.startsWith('image/'))
    const file = imageItem?.getAsFile()
    if (!file) return
    event.preventDefault()
    await handleImageOcr(file)
  }

  const handleDropData = async (event: DragEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.dataTransfer.files).find(item => item.type.startsWith('image/'))
    if (!file) return
    event.preventDefault()
    await handleImageOcr(file)
  }

  // ── 下载 Excel 模板 ──
  const handleDownloadTemplate = async () => {
    let templateUrl = '/downloads/AM-ELISA数据分析模板.xlsx'
    let templateName = 'AM-ELISA数据分析模板.xlsx'
    try {
      const res = await fetch('/api/lab/analysis/template', { cache: 'no-store' })
      const data = await res.json().catch(() => null) as {
        template?: { url?: string; name?: string }
      } | null
      if (res.ok && data?.template?.url) {
        templateUrl = data.template.url
        templateName = data.template.name || templateName
      }
    } catch (error) {
      console.warn('[lab/analysis] fallback to static template:', error)
    }

    const link = document.createElement('a')
    link.href = templateUrl
    link.download = templateName
    link.click()
  }

  // ── 导入 CSV / Excel ──
  const handleImportCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.txt,.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const extension = file.name.split('.').pop()?.toLowerCase()

      if (extension === 'xlsx' || extension === 'xls') {
        try {
          const XLSX = await import('xlsx')
          const buffer = await file.arrayBuffer()
          const workbook = XLSX.read(buffer)
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1, blankrows: true })
          const text = rows
            .map(row => row.map(cell => cell ?? '').join('\t').trimEnd())
            .join('\n')
            .trim()
          setRawInput(text)
          setSampleOverrides({})
          setFitResult(null)
          setQcResult(null)
        } catch {
          setError('Excel 文件读取失败，请另存为 CSV 后再上传')
        }
        return
      }

      const reader = new FileReader()
      reader.onload = (ev) => {
        setRawInput((ev.target?.result as string) || '')
        setSampleOverrides({})
        setFitResult(null)
        setQcResult(null)
      }
      reader.readAsText(file, 'utf-8')
    }
    input.click()
  }

  // ── 导出 TXT 报告 ──
  const getSortedUnknowns = (unknowns: UnknownSample[]) => {
    return [...unknowns].sort((a, b) => {
      const sortA = a.sortIndex ?? Number.MAX_SAFE_INTEGER
      const sortB = b.sortIndex ?? Number.MAX_SAFE_INTEGER
      if (sortA !== sortB) return sortA - sortB
      return a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
    })
  }

  const formatBlankCorrection = (result: FitResult) => {
    if (result.blankCorrectionMode === 'subtract' && result.blankOd !== undefined) {
      return `扣除 Blank 平均 OD ${result.blankOd.toFixed(4)}`
    }
    return '保留空白，未扣除 Blank'
  }

  const calculateBackCalculatedConcentration = (od: number) => {
    if (!fitResult) return undefined
    let conc: number
    if (fitResult.model === '4pl') {
      conc = fourPLInverse(od, fitResult.params.A, fitResult.params.B, fitResult.params.C, fitResult.params.D)
    } else if (fitResult.model === '5pl') {
      conc = fivePLInverse(od, fitResult.params.A, fitResult.params.B, fitResult.params.C, fitResult.params.D, fitResult.params.E)
    } else {
      const lx = (od - fitResult.params.b) / fitResult.params.k
      conc = Math.pow(10, lx)
    }
    return Number.isFinite(conc) ? conc : undefined
  }

  const getPlateMatrixRows = () => {
    if (!fitResult) return []
    const standardLabels = getStandardDisplayLabels(fitResult.standards)
    const standardByWell = new Map(
      fitResult.standards
        .flatMap((standard, index) => standard.well
          ? [[standard.well, { standard, label: standardLabels[index] }] as const]
          : []
        )
    )
    const unknownByWell = new Map(fitResult.unknowns.filter(u => u.well).map(u => [u.well, u]))

    return PLATE_ROWS.map((rowLabel) => Array.from({ length: 12 }, (_, columnIndex) => {
      const well = `${rowLabel}${String(columnIndex + 1).padStart(2, '0')}`
      const standard = standardByWell.get(well)
      if (standard) {
        const backConc = calculateBackCalculatedConcentration(standard.standard.mean)
        const finalConc = getStandardFinalConcentration(backConc)
        return {
          well,
          label: standard.label,
          od: standard.standard.mean,
          rawOd: standard.standard.rawMean ?? standard.standard.mean,
          value: formatConcentrationValue(finalConc),
          status: 'standard' as const,
        }
      }

      const sample = unknownByWell.get(well)
      if (sample) {
        return {
          well,
          label: sample.name,
          od: sample.mean,
          rawOd: sample.rawMean ?? sample.mean,
          value: formatConcentrationValue(sample.concentration),
          status: sample.concentrationStatus || 'ok',
        }
      }

      return { well, label: '', od: undefined, value: '', status: 'empty' as const }
    }))
  }

  const exportTXT = () => {
    if (!fitResult) return
    const sortedUnknowns = getSortedUnknowns(fitResult.unknowns)
    const plateRows = getPlateMatrixRows()
    const standardLabels = getStandardDisplayLabels(fitResult.standards)
    const lines = [
      '═══════════════════════════════════════════',
      '  ELISA 实验数据分析报告',
      '  AIMENG UNING 爱萌优宁',
      '═══════════════════════════════════════════',
      '',
      '生成时间: ' + new Date().toLocaleString('zh-CN'),
      '计算内核: ' + ANALYSIS_ENGINE_VERSION,
      '',
      '【拟合方法】' + (fitResult.model === '4pl' ? '四参数逻辑斯蒂拟合 (4PL)' : fitResult.model === '5pl' ? '五参数逻辑斯蒂拟合 (5PL)' : '线性拟合 (Log-Log)'),
      '【权重模式】' + (weightMode === 'none' ? '无权重' : weightMode === '1/y' ? '1/Y 权重' : '1/Y² 权重'),
      '【空白处理】' + formatBlankCorrection(fitResult),
      '',
      '【拟合参数】',
      ...(fitResult.model === '4pl' ? [
        'A (Bottom / 最小OD):  ' + fitResult.params.A.toFixed(4),
        'B (Hill斜率):         ' + fitResult.params.B.toFixed(4),
        'C (EC50):             ' + fitResult.params.C.toFixed(4) + ' pg/mL',
        'D (Top / 最大OD):     ' + fitResult.params.D.toFixed(4),
      ] : fitResult.model === '5pl' ? [
        'A (Bottom):           ' + fitResult.params.A.toFixed(4),
        'B (Hill斜率):         ' + fitResult.params.B.toFixed(4),
        'C (EC50):             ' + fitResult.params.C.toFixed(4) + ' pg/mL',
        'D (Top):              ' + fitResult.params.D.toFixed(4),
        'E (不对称因子):       ' + fitResult.params.E.toFixed(4),
      ] : [
        'Slope:                ' + fitResult.params.k.toFixed(4),
        'Intercept:            ' + fitResult.params.b.toFixed(4),
      ]),
      '',
      'R² = ' + fitResult.r2.toFixed(6),
      'RMSE = ' + fitResult.rmse.toFixed(6),
      '拟合质量: ' + getFitQuality(fitResult.r2).label,
      '',
      ...(fitResult.model === '4pl' || fitResult.model === '5pl' ? [
        '回归方程:',
        formatEquation(fitResult.model, fitResult.params),
        ''
      ] : []),
      '【标准品数据】',
      '孔位\t标准品\t已知浓度(pg/mL)\t均值OD\tSD\t反算浓度(pg/mL)\t终浓度(pg/mL)\t回收率\t预测OD\t残差',
      ...fitResult.standards.map((s, i) => {
        const pred = fitResult.points[i].predicted
        const backConc = calculateBackCalculatedConcentration(s.mean)
        const finalConc = getStandardFinalConcentration(backConc)
        const recovery = s.concentration > 0 && backConc !== undefined ? `${((backConc / s.concentration) * 100).toFixed(1)}%` : '--'
        return `${s.well || ''}\t${standardLabels[i]}\t${s.concentration}\t${s.mean.toFixed(3)}\t${s.sd.toFixed(4)}\t${backConc !== undefined ? backConc.toFixed(2) : '--'}\t${finalConc !== undefined ? finalConc.toFixed(2) : '--'}\t${recovery}\t${pred.toFixed(3)}\t${(s.mean - pred).toFixed(4)}`
      }),
      '',
      '【未知样本浓度】',
      '孔位\t样本名称\t均值OD\tSD\t稀释倍数\t反算浓度(pg/mL)\t最终浓度(pg/mL)',
      ...sortedUnknowns.map(u =>
        `${u.well || ''}\t${u.name}\t${u.mean.toFixed(3)}\t${u.sd.toFixed(4)}\t${u.dilution || 1}\t${formatConcentrationValue(u.calculatedConcentration)}\t${formatConcentrationValue(u.concentration)}`
      ),
      '',
      '【96孔位结果矩阵】',
      '孔位内格式：名称 / OD / 最终浓度；空孔以 -- 表示。',
      ['行', ...Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))].join('\t'),
      ...plateRows.map((row, rowIndex) => [
        PLATE_ROWS[rowIndex],
        ...row.map(cell => cell.label ? `${cell.well} ${cell.label} / OD ${cell.od?.toFixed(3)} / ${cell.value || '-'}` : '--')
      ].join('\t')),
      '',
      ...(fitResult.warnings.length > 0 ? [
        '【警告】',
        ...fitResult.warnings,
        ''
      ] : []),
      '═══════════════════════════════════════════',
      '  报告由 AIMENG UNING 数据分析平台生成',
      '  https://aimenguning.com',
      '═══════════════════════════════════════════',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ELISA_Report_' + new Date().toISOString().slice(0, 10) + '.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportExcelReport = async () => {
    if (!fitResult) return

    try {
      const XLSX = await import('xlsx')
      const generatedAt = new Date().toLocaleString('zh-CN')
      const dateText = new Date().toISOString().slice(0, 10)
      const sortedUnknowns = getSortedUnknowns(fitResult.unknowns)
      const plateRows = getPlateMatrixRows()
      const standardLabels = getStandardDisplayLabels(fitResult.standards)
      const modelLabel = fitResult.model === '4pl' ? '4PL 四参数拟合' : fitResult.model === '5pl' ? '5PL 五参数拟合' : 'Log-Log 线性拟合'
      const weightLabel = weightMode === 'none' ? '无权重' : weightMode === '1/y' ? '1/Y 权重' : '1/Y² 权重'
      const blankLabel = formatBlankCorrection(fitResult)
      const equation = fitResult.model === '4pl' || fitResult.model === '5pl' ? formatEquation(fitResult.model, fitResult.params) : ''

      const workbook = XLSX.utils.book_new()
      const appendSheet = (name: string, rows: Array<Array<string | number>>, columnWidths: number[]) => {
        const worksheet = XLSX.utils.aoa_to_sheet(rows)
        worksheet['!cols'] = columnWidths.map(width => ({ wch: width }))
        XLSX.utils.book_append_sheet(workbook, worksheet, name)
      }

      const rawRows: Array<Array<string | number>> = [
        ['ELISA 原始数据'],
        ['生成时间', generatedAt],
        ['计算内核', ANALYSIS_ENGINE_VERSION],
        ['拟合方法', modelLabel],
        ['权重模式', weightLabel],
        ['空白处理', blankLabel],
        ['R²', fitResult.r2],
        ['RMSE', fitResult.rmse],
        [],
        ['96 孔板 OD 矩阵'],
        ['行', ...Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))],
        ...plateRows.map((row, rowIndex) => [
          PLATE_ROWS[rowIndex],
          ...row.map(cell => cell.rawOd !== undefined ? Number(cell.rawOd.toFixed(4)) : ''),
        ]),
        [],
        ['标准品浓度与 OD'],
        ['孔位', '标准品', '浓度(pg/mL)', '原始复孔OD', '原始均值OD', 'SD'],
        ...fitResult.standards.map((standard, index) => [
          standard.well || '',
          standardLabels[index],
          standard.concentration,
          (standard.rawReplicates || standard.replicates).map(value => value.toFixed(4)).join(', '),
          Number((standard.rawMean ?? standard.mean).toFixed(4)),
          Number(standard.sd.toFixed(4)),
        ]),
      ]

      if (rawInput.trim()) {
        rawRows.push([], ['原始粘贴/识别文本'])
        rawRows.push(...rawInput.split('\n').map(line => [line]))
      }

      appendSheet('原始数据', rawRows, [10, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16])

      const organizedRows: Array<Array<string | number>> = [
        ['位置', '客户样本名称', '类型', '原始OD', '已知浓度(pg/mL)', '反算浓度(pg/mL)', '稀释倍数', '终浓度(pg/mL)'],
        ...fitResult.standards.map((standard, index) => {
          const backConc = calculateBackCalculatedConcentration(standard.mean)
          const standardFinalConc = getStandardFinalConcentration(backConc)
          return [
            standard.well || '',
            standardLabels[index],
            standard.concentration === 0 ? '空白/零标准品' : '标准品',
            Number((standard.rawMean ?? standard.mean).toFixed(4)),
            standard.concentration,
            backConc !== undefined ? Number(backConc.toFixed(4)) : '',
            1,
            standardFinalConc !== undefined ? Number(standardFinalConc.toFixed(4)) : '',
          ]
        }),
        ...sortedUnknowns.map(sample => [
          sample.well || '',
          sample.name,
          '检测样本',
          Number((sample.rawMean ?? sample.mean).toFixed(4)),
          '',
          sample.calculatedConcentration !== undefined ? Number(sample.calculatedConcentration.toFixed(4)) : '',
          sample.dilution || 1,
          sample.concentration !== undefined ? Number(sample.concentration.toFixed(4)) : '',
        ]),
      ]
      appendSheet('整理后数据', organizedRows, [12, 20, 14, 12, 18, 18, 10, 18])

      const reportRows: Array<Array<string | number>> = [
        ['ELISA 实验数据分析报告'],
        ['AIMENG UNING 爱萌优宁'],
        ['生成时间', generatedAt],
        [],
        ['实验信息'],
        ['计算内核', ANALYSIS_ENGINE_VERSION],
        ['拟合方法', modelLabel],
        ['权重模式', weightLabel],
        ['空白处理', blankLabel],
        ['标准品数量', fitResult.standards.length],
        ['拟合质量', getFitQuality(fitResult.r2).label],
        ['R²', fitResult.r2],
        ['RMSE', fitResult.rmse],
        ...(equation ? [['拟合方程', equation] as Array<string | number>] : []),
        [],
        ['拟合参数'],
        ...Object.entries(fitResult.params).map(([key, value]) => [key, Number(value.toFixed(6))] as Array<string | number>),
        [],
        ['标准品拟合详情'],
        ['孔位', '标准品', '浓度(pg/mL)', '均值OD', 'SD', '反算浓度(pg/mL)', '终浓度(pg/mL)', '回收率', '预测OD', '残差'],
        ...fitResult.standards.map((standard, index) => {
          const predicted = fitResult.points[index]?.predicted
          const residual = fitResult.points[index]?.residual
          const backConc = calculateBackCalculatedConcentration(standard.mean)
          const finalConc = getStandardFinalConcentration(backConc)
          const recovery = standard.concentration > 0 && backConc !== undefined ? `${((backConc / standard.concentration) * 100).toFixed(1)}%` : '--'
          return [
            standard.well || '',
            standardLabels[index],
            standard.concentration,
            Number(standard.mean.toFixed(4)),
            Number(standard.sd.toFixed(4)),
            backConc !== undefined ? Number(backConc.toFixed(4)) : '',
            finalConc !== undefined ? Number(finalConc.toFixed(4)) : '',
            recovery,
            predicted !== undefined ? Number(predicted.toFixed(4)) : '',
            residual !== undefined ? Number(residual.toFixed(4)) : '',
          ]
        }),
        [],
        ['未知样本浓度结果'],
        ['孔位', '样本', '均值OD', '稀释倍数', '反算浓度(pg/mL)', '最终浓度(pg/mL)'],
        ...sortedUnknowns.map(sample => [
          sample.well || '',
          sample.name,
          Number(sample.mean.toFixed(4)),
          sample.dilution || 1,
          sample.calculatedConcentration !== undefined ? Number(sample.calculatedConcentration.toFixed(4)) : '',
          sample.concentration !== undefined ? Number(sample.concentration.toFixed(4)) : '',
        ]),
      ]

      if (fitResult.warnings.length > 0) {
        reportRows.push([], ['质控提示'], ...fitResult.warnings.map(warning => [warning]))
      }

      appendSheet('报告', reportRows, [14, 12, 24, 16, 12, 18, 18, 18, 18, 18])
      XLSX.writeFile(workbook, `ELISA_Report_${dateText}.xlsx`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      setError(`Excel 报告生成失败：${message}`)
    }
  }

  // ── SVG 曲线绘制 ──
  const renderCurve = () => {
    if (!fitResult || fitResult.standards.length === 0) return null

    const width = 720, height = 420
    const pad = { top: 35, right: 45, bottom: 65, left: 75 }
    const cw = width - pad.left - pad.right
    const ch = height - pad.top - pad.bottom

    const xMin = 0
    const maxStandardX = Math.max(...fitResult.standards.map(s => s.concentration))
    const xMax = Math.max(maxStandardX * 1.05, 1)

    const predictY = (x: number) => {
      if (fitResult.model === '4pl') {
        return fourPL(x, fitResult.params.A, fitResult.params.B, fitResult.params.C, fitResult.params.D)
      }
      if (fitResult.model === '5pl') {
        return fivePL(x, fitResult.params.A, fitResult.params.B, fitResult.params.C, fitResult.params.D, fitResult.params.E)
      }
      return fitResult.params.k * Math.log10(Math.max(x, 1e-12)) + fitResult.params.b
    }

    const STEPS = 400
    const sampledCurve = Array.from({ length: STEPS + 1 }, (_, i) => {
      const x = xMin + (i / STEPS) * (xMax - xMin)
      return { x, y: predictY(x) }
    }).filter(point => Number.isFinite(point.y))

    const allYValues = [
      ...fitResult.standards.map(s => s.mean),
      ...fitResult.unknowns.map(u => u.mean),
    ].filter(v => Number.isFinite(v) && v >= 0 && v <= 4.5)
    const maxObservedY = Math.max(...allYValues, 0.1)
    const usableCurveY = sampledCurve
      .map(point => point.y)
      .filter(value => value >= 0 && value <= Math.max(maxObservedY * 2.5, maxObservedY + 1))
    const yMin = 0
    const yMax = Math.max(...allYValues, ...usableCurveY, 0.1) * 1.12

    const xScale = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * cw
    const yScale = (y: number) => pad.top + ch - ((y - yMin) / (yMax - yMin)) * ch

    // 曲线点
    const curvePoints = sampledCurve
      .filter(point => point.y >= yMin - 0.05 && point.y <= yMax + 0.05)
      .map(point => `${xScale(point.x)},${yScale(point.y)}`)

    // 网格线
    const gridX = makeLinearTicks(xMin, xMax, 6)
    const gridY = makeLinearTicks(yMin, yMax, 6)

    return (
      <svg ref={svgRef} width={width} height={height} className="bg-white rounded-lg border border-slate-200 shadow-sm">
        {/* 网格 */}
        {gridX.map(v => (
          <line key={`gx-${v}`} x1={xScale(v)} y1={pad.top} x2={xScale(v)} y2={pad.top + ch}
            stroke="#E2E8F0" strokeDasharray="4,4" />
        ))}
        {gridY.map((v, i) => (
          <line key={`gy-${i}`} x1={pad.left} y1={yScale(v)} x2={pad.left + cw} y2={yScale(v)}
            stroke="#E2E8F0" strokeDasharray="4,4" />
        ))}

        {/* 坐标轴 */}
        <line x1={pad.left} y1={pad.top + ch} x2={pad.left + cw} y2={pad.top + ch} stroke="#94A3B8" strokeWidth={1.5} />
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ch} stroke="#94A3B8" strokeWidth={1.5} />

        {/* X 标签 */}
        {gridX.map(v => (
          <text key={`lx-${v}`} x={xScale(v)} y={pad.top + ch + 22} textAnchor="middle" fontSize={11} fill="#64748B">
            {v >= 1000 ? `${Math.round(v / 1000)}k` : v.toFixed(v < 10 && v !== 0 ? 1 : 0)}
          </text>
        ))}
        <text x={pad.left + cw / 2} y={height - 12} textAnchor="middle" fontSize={12} fill="#475569" fontWeight={500}>
          浓度 (pg/mL)
        </text>

        {/* Y 标签 */}
        {gridY.map((v, i) => (
          <text key={`ly-${i}`} x={pad.left - 10} y={yScale(v) + 4} textAnchor="end" fontSize={11} fill="#64748B">
            {v.toFixed(2)}
          </text>
        ))}
        <text x={16} y={pad.top + ch / 2} textAnchor="middle" fontSize={12} fill="#475569" fontWeight={500}
          transform={`rotate(-90, 16, ${pad.top + ch / 2})`}>
          OD450
        </text>

        {/* 拟合曲线 */}
        {curvePoints.length > 1 && (
          <path d={`M ${curvePoints.join(' L ')}`} fill="none" stroke="#177E97" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* 标准品点 */}
        {fitResult.standards.map((s, i) => (
          <g key={`s-${i}`}>
            <circle cx={xScale(s.concentration)} cy={yScale(s.mean)} r={6} fill="#48B0C8" stroke="white" strokeWidth={2} />
            {/* 误差线 */}
            {s.sd > 0 && (
              <line x1={xScale(s.concentration)} y1={yScale(s.mean + s.sd)}
                x2={xScale(s.concentration)} y2={yScale(Math.max(s.mean - s.sd, 0))}
                stroke="#48B0C8" strokeWidth={1} opacity={0.5} />
            )}
            <text x={xScale(s.concentration)} y={yScale(s.mean) - 14} textAnchor="middle" fontSize={10} fill="#1E293B" fontWeight={600}>
              {s.mean.toFixed(3)}
            </text>
          </g>
        ))}

        {/* 未知样本点 */}
        {getSortedUnknowns(fitResult.unknowns).map((u, i) => {
          if (u.concentration === undefined || u.concentration <= 0 || u.concentration > xMax) return null
          return (
            <g key={`u-${i}`}>
              <circle cx={xScale(u.concentration)} cy={yScale(u.mean)} r={6} fill="#EF4444" stroke="white" strokeWidth={2} />
              <text x={xScale(u.concentration)} y={yScale(u.mean) + 18} textAnchor="middle" fontSize={9} fill="#EF4444" fontWeight={600}>
                {u.name}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  // ── 复孔数据表格 ──
  const renderReplicateTable = () => {
    if (!fitResult) return null
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">孔位</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">浓度 (pg/mL)</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">复孔 OD</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">均值</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">SD</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">CV%</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">反算浓度</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">终浓度</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">回收率</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">预测 OD</th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">残差</th>
            </tr>
          </thead>
          <tbody>
            {fitResult.standards.map((s, i) => {
              const pred = fitResult.points[i].predicted
              const residual = fitResult.points[i].residual
              const backConc = calculateBackCalculatedConcentration(s.mean)
              const finalConc = getStandardFinalConcentration(backConc)
              const recovery = s.concentration > 0 && backConc !== undefined ? `${((backConc / s.concentration) * 100).toFixed(1)}%` : '--'
              const cvHigh = s.cv > 20
              const resHigh = Math.abs(residual) > 2.5 * fitResult.rmse
              return (
                <tr key={i} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono text-slate-600">{s.well || '--'}</td>
                  <td className="py-2 px-3 font-mono font-medium">{s.concentration}</td>
                  <td className="py-2 px-3 font-mono text-xs">{s.replicates.map(r => r.toFixed(3)).join(', ')}</td>
                  <td className="py-2 px-3 font-mono">{s.mean.toFixed(3)}</td>
                  <td className="py-2 px-3 font-mono">{s.sd.toFixed(4)}</td>
                  <td className={`py-2 px-3 font-mono font-medium ${cvHigh ? 'text-red-600 bg-red-50' : ''}`}>
                    {s.cv.toFixed(1)}%
                    {cvHigh && <span className="ml-1 text-xs">⚠</span>}
                  </td>
                  <td className="py-2 px-3 font-mono">{backConc !== undefined ? backConc.toFixed(2) : '--'}</td>
                  <td className="py-2 px-3 font-mono">{finalConc !== undefined ? finalConc.toFixed(2) : '--'}</td>
                  <td className="py-2 px-3 font-mono">{recovery}</td>
                  <td className="py-2 px-3 font-mono text-[#177E97]">{pred.toFixed(3)}</td>
                  <td className={`py-2 px-3 font-mono ${resHigh ? 'text-red-600 font-bold' : ''}`}>
                    {residual.toFixed(4)}
                    {resHigh && <span className="ml-1 text-xs">⚠</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-[#177E97]">
            lab.analysis / 4pl workbench
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[#177E97] flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-normal text-slate-950">ELISA 实验数据分析工作台</h1>
              <p className="text-sm text-slate-500">4PL / 5PL 拟合 · 复孔统计 · 质控检查 · 报告导出</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/60 p-1">
            {[
              { key: 'input' as TabType, label: '数据输入', icon: Table },
              { key: 'curve' as TabType, label: '标准曲线', icon: TrendingUp },
              { key: 'table' as TabType, label: '数据表格', icon: FileSpreadsheet },
              { key: 'report' as TabType, label: '实验报告', icon: FileText },
            ].map(tab => {
              const Icon = tab.icon, active = activeTab === tab.key
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${active
                    ? 'bg-white text-[#177E97] shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'}`}>
                  <Icon className="w-4 h-4" />{tab.label}
                </button>
              )
            })}
          </div>
          <button onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all ${showSettings
              ? 'border-[#48B0C8] bg-[#E8F5F8] text-[#0F667C]'
              : 'border-slate-300 bg-white text-slate-600 hover:border-[#48B0C8] hover:text-[#177E97]'}`}>
            <Settings className="w-4 h-4" />拟合设置
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1E293B]">拟合参数设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">拟合模型</label>
                <div className="space-y-2">
                  {([
                    { value: '4pl' as FitModel, label: '4PL (四参数)', desc: '标准 S 型曲线' },
                    { value: '5pl' as FitModel, label: '5PL (五参数)', desc: '不对称曲线' },
                    { value: 'log-log' as FitModel, label: 'Log-Log 线性', desc: '简单线性拟合' },
                  ]).map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${fitModel === opt.value
                      ? 'border-[#48B0C8] bg-[#E8F5F8]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <input type="radio" name="model" value={opt.value} checked={fitModel === opt.value}
                        onChange={() => setFitModel(opt.value)} className="w-4 h-4 accent-[#177E97]" />
                      <div>
                        <div className="text-sm font-medium text-[#1E293B]">{opt.label}</div>
                        <div className="text-xs text-[#94A3B8]">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">权重模式</label>
                <div className="space-y-2">
                  {([
                    { value: 'none' as WeightMode, label: '无权重', desc: '默认推荐，整体曲线更贴合' },
                    { value: '1/y' as WeightMode, label: '1/Y 权重', desc: '更偏重低 OD 点' },
                    { value: '1/y²' as WeightMode, label: '1/Y² 权重', desc: '强烈偏重低 OD 点' },
                  ]).map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${weightMode === opt.value
                      ? 'border-[#48B0C8] bg-[#E8F5F8]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <input type="radio" name="weight" value={opt.value} checked={weightMode === opt.value}
                        onChange={() => setWeightMode(opt.value)} className="w-4 h-4 accent-[#177E97]" />
                      <div>
                        <div className="text-sm font-medium text-[#1E293B]">{opt.label}</div>
                        <div className="text-xs text-[#94A3B8]">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 mb-2 block">空白处理</label>
                <div className="space-y-2">
                  {([
                    { value: 'none' as BlankCorrectionMode, label: '保留空白', desc: '默认，不改变原始 OD' },
                    { value: 'subtract' as BlankCorrectionMode, label: '扣除 Blank', desc: '所有 OD 扣除 0 浓度均值' },
                  ]).map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${blankCorrectionMode === opt.value
                      ? 'border-[#48B0C8] bg-[#E8F5F8]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <input type="radio" name="blank-correction" value={opt.value} checked={blankCorrectionMode === opt.value}
                        onChange={() => setBlankCorrectionMode(opt.value)} className="w-4 h-4 accent-[#177E97]" />
                      <div>
                        <div className="text-sm font-medium text-[#1E293B]">{opt.label}</div>
                        <div className="text-xs text-[#94A3B8]">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-md bg-[#E8F5F8] p-4">
                <h4 className="text-sm font-semibold text-[#0F667C] mb-2">推荐设置</h4>
                <p className="text-xs text-[#0F667C] leading-relaxed">
                  默认建议使用 <strong>4PL + 无权重 + 保留空白</strong>，先保证整条标准曲线贴合。若实验报告或试剂盒 SOP 明确要求
                  扣除 Blank 或使用 1/Y、1/Y² 权重，再切换对应设置。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* Warnings */}
        {fitResult?.warnings && fitResult.warnings.length > 0 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
            {fitResult.warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{w}
              </div>
            ))}
          </div>
        )}

        {/* ── 数据输入 Tab ── */}
        {activeTab === 'input' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-[#177E97]" />
                <h2 className="text-base font-semibold">实验数据输入</h2>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-[#48B0C8] hover:text-[#177E97]">
                  <Download className="w-3.5 h-3.5" />下载 Excel 模板
                </button>
                <button onClick={handleImportImage} disabled={isOcrLoading}
                  className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-[#48B0C8] hover:text-[#177E97] disabled:opacity-50">
                  <Eye className="w-3.5 h-3.5" />{isOcrLoading ? '识别中...' : '上传截图识别'}
                </button>
                <button onClick={handleImportCSV}
                  className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-[#48B0C8] hover:text-[#177E97]">
                  <Upload className="w-3.5 h-3.5" />上传 Excel / CSV
                </button>
                <button onClick={handleClear}
                  className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100">
                  <Trash2 className="w-3.5 h-3.5" />清空
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md border border-[#BFE3EC] bg-[#E8F5F8] p-4">
                <p className="text-sm font-semibold text-[#0F667C]">推荐方式</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">下载模板，按客户常用 ELISACalc 表格习惯填写，再上传 Excel。</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">兼容方式</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">也可以直接从 Excel 复制标准品和样本区域，粘贴到下方文本框。</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">截图识别</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">可点击上传截图，也可以把截图直接粘贴或拖入下方数据框。</p>
              </div>
            </div>

            {ocrMessage && (
              <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{ocrMessage}
              </div>
            )}

            <textarea
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
              onPaste={handlePasteData}
              onDrop={handleDropData}
              onDragOver={event => event.preventDefault()}
              rows={12}
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed resize-y transition-all focus:border-[#48B0C8] focus:outline-none focus:ring-1 focus:ring-[#48B0C8]"
              placeholder={`请上传 Excel / CSV，或从 Excel 复制数据后粘贴到这里。\n也可以把截图直接粘贴或拖入这里识别。\n\n推荐使用下载模板：浓度(pg/mL) + 标准品孔位/OD + 1#到11#样本孔位/样本编号/OD/稀释倍数。\n说明：标准品默认占 01 列，样本孔位默认覆盖 02-12 列。`}
              disabled={isOcrLoading}
            />

            <div className="flex items-center gap-3 mt-5">
              <button onClick={handleFit} disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 rounded-md bg-[#177E97] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0F667C] disabled:opacity-50">
                <Play className="w-4 h-4" />
                {isLoading ? '拟合计算中...' : `开始 ${fitModel.toUpperCase()} 拟合`}
              </button>
            </div>
            {analysisRewardMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {analysisRewardMessage}
              </div>
            )}

            <div className="mt-4 space-y-2 rounded-md bg-[#E8F5F8] p-4 text-xs text-slate-600">
              <p className="font-medium flex items-center gap-1.5">
                <Info className="w-4 h-4" />数据格式说明
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium mb-1">标准品区域</p>
                  <p className="text-slate-500">模板预填 A01-H01 孔位</p>
                  <p className="text-slate-500">数据行：浓度值 + 标准品 OD 值</p>
                  <p className="text-slate-500">建议 7-8 个浓度点（含 Blank = 0）</p>
                </div>
                <div>
                  <p className="font-medium mb-1">未知样本区域</p>
                  <p className="text-slate-500">模板预填 A02-H12 孔位</p>
                  <p className="text-slate-500">每组样本包含孔位、样本编号、OD、稀释倍数</p>
                  <p className="text-slate-500">稀释倍数默认为 1，可按实际修改</p>
                </div>
              </div>
              <p className="text-slate-400 mt-2">支持 Excel、CSV、TXT 上传，也支持 Tab、逗号、空格分隔的复制粘贴。模板中的孔位、样本编号和稀释倍数会进入最终报告。</p>
            </div>
          </div>
        )}

        {/* ── 标准曲线 Tab ── */}
        {activeTab === 'curve' && fitResult && (
          <div className="space-y-6">
            {/* 拟合参数卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {fitResult.model === '4pl' && (
                <>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">A (Bottom)</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.A.toFixed(4)}</p>
                  </div>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">B (Hill)</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.B.toFixed(4)}</p>
                  </div>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">C (EC50)</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.C.toFixed(2)}</p>
                  </div>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">D (Top)</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.D.toFixed(4)}</p>
                  </div>
                </>
              )}
              {fitResult.model === '5pl' && (
                <>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">A</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.A.toFixed(4)}</p>
                  </div>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">B</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.B.toFixed(4)}</p>
                  </div>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">C</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.C.toFixed(2)}</p>
                  </div>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">D</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.D.toFixed(4)}</p>
                  </div>
                  <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                    <p className="text-xs text-[#94A3B8] mb-1">E (不对称)</p>
                    <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.params.E.toFixed(4)}</p>
                  </div>
                </>
              )}
              <div className="rounded-md border border-[#BFE3EC] bg-[#E8F5F8] p-4 text-center">
                <p className="text-xs text-[#177E97] mb-1">R²</p>
                <p className="text-lg font-bold font-mono text-[#0F667C]">{fitResult.r2.toFixed(6)}</p>
              </div>
              <div className="bg-white rounded-md border border-slate-200 p-4 text-center">
                <p className="text-xs text-[#94A3B8] mb-1">RMSE</p>
                <p className="text-lg font-bold font-mono text-[#1E293B]">{fitResult.rmse.toFixed(4)}</p>
              </div>
            </div>

            {/* 曲线图 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#177E97]" />标准曲线
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#177E97]" />标准品</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" />未知样本</span>
                </div>
              </div>
              <div className="flex justify-center overflow-x-auto">{renderCurve()}</div>
              {fitResult.model === '4pl' || fitResult.model === '5pl' ? (
                <div className="mt-4 rounded-md bg-[#E8F5F8] p-3">
                  <p className="text-xs text-[#0F667C] font-mono break-all">{formatEquation(fitResult.model, fitResult.params)}</p>
                </div>
              ) : null}
            </div>

            {/* QC 面板 */}
            {qcResult && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#1E293B] mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />质控检查结果
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-md ${qcResult.cvWarnings.length === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className="text-sm font-medium mb-1">{qcResult.cvWarnings.length === 0 ? '复孔 CV% 正常' : `${qcResult.cvWarnings.length} 个 CV% 超标`}</p>
                    <p className="text-xs text-slate-500">阈值: CV% ≤ 20%</p>
                    {qcResult.cvWarnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {qcResult.cvWarnings.map((w, i) => (
                          <p key={i} className="text-xs text-red-600">S{w.idx + 1}: CV = {w.cv.toFixed(1)}%</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={`p-4 rounded-md ${qcResult.outlierPoints.length === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <p className="text-sm font-medium mb-1">{qcResult.outlierPoints.length === 0 ? '无异常点' : `${qcResult.outlierPoints.length} 个异常点`}</p>
                    <p className="text-xs text-slate-500">阈值: |残差| {'>'} 2.5×SD</p>
                    {qcResult.outlierPoints.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {qcResult.outlierPoints.map((o, i) => (
                          <p key={i} className="text-xs text-amber-700">S{o.idx + 1}: 残差 = {o.residual.toFixed(4)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium mb-1">拟合质量</p>
                    <p className="text-xs text-slate-500">R² = {fitResult.r2.toFixed(6)}</p>
                    <p className={`text-sm font-bold mt-1 ${fitResult.quality === 'excellent' ? 'text-emerald-600' : fitResult.quality === 'good' ? 'text-[#177E97]' : fitResult.quality === 'acceptable' ? 'text-amber-600' : 'text-red-600'}`}>
                      {getFitQuality(fitResult.r2).label}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'curve' && !fitResult && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-[#94A3B8]">请先完成数据拟合</p>
          </div>
        )}

        {/* ── 数据表格 Tab ── */}
        {activeTab === 'table' && fitResult && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[#1E293B] mb-4">标准品拟合详情</h3>
              {renderReplicateTable()}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-semibold text-[#1E293B]">未知样本浓度结果</h3>
                <span className="text-xs text-slate-500">样本名称和稀释倍数可直接修改，最终浓度会同步更新。</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">孔位</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">样本名称</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">复孔 OD</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">均值</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">SD</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">CV%</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">稀释倍数</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">反算浓度</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">最终浓度</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">判定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedUnknowns(fitResult.unknowns).map((u, i) => (
                      <tr key={i} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-600">{u.well || '--'}</td>
                        <td className="py-2 px-3">
                          <input
                            value={u.name}
                            onChange={event => updateSampleName(u, event.target.value)}
                            className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#48B0C8] focus:border-[#48B0C8]"
                            aria-label={`修改 ${u.well || u.name} 样本名称`}
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{u.replicates.map(r => r.toFixed(3)).join(', ')}</td>
                        <td className="py-2 px-3 font-mono">{u.mean.toFixed(3)}</td>
                        <td className="py-2 px-3 font-mono">{u.sd.toFixed(4)}</td>
                        <td className={`py-2 px-3 font-mono ${u.cv > 20 ? 'text-red-600 bg-red-50 font-bold' : ''}`}>
                          {u.cv.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0.0001"
                            step="0.1"
                            value={u.dilution || 1}
                            onChange={event => updateSampleDilution(u, event.target.value)}
                            className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#48B0C8] focus:border-[#48B0C8]"
                            aria-label={`修改 ${u.well || u.name} 稀释倍数`}
                          />
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-[#177E97]">
                          {formatConcentrationValue(u.calculatedConcentration)}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-[#177E97]">
                          {formatConcentrationValue(u.concentration)}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getConcentrationStatusClass(u.concentrationStatus)}`}>
                            {getConcentrationStatusLabel(u.concentrationStatus)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'table' && !fitResult && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-[#94A3B8]">请先完成数据拟合</p>
          </div>
        )}

        {/* ── 实验报告 Tab ── */}
        {activeTab === 'report' && fitResult && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#177E97]" />实验报告
              </h2>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={exportExcelReport}
                  className="flex items-center gap-2 rounded-md bg-[#177E97] px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0F667C]">
                  <Download className="w-4 h-4" />导出 Excel 报告
                </button>
                <button onClick={exportTXT}
                  className="flex items-center gap-2 rounded-md border border-[#48B0C8] bg-white px-4 py-2 text-sm font-bold text-[#177E97] transition-colors hover:bg-[#E8F5F8]">
                  <ArrowDownToLine className="w-4 h-4" />导出 TXT 报告
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="p-4 bg-[#F8FAFC] rounded-xl">
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">实验信息</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-[#94A3B8]">拟合方法：</span>{fitResult.model === '4pl' ? '4PL' : fitResult.model === '5pl' ? '5PL' : 'Log-Log 线性'}</div>
                  <div><span className="text-[#94A3B8]">计算内核：</span><span className="font-mono text-xs">{ANALYSIS_ENGINE_VERSION}</span></div>
                  <div><span className="text-[#94A3B8]">权重模式：</span>{weightMode === 'none' ? '无' : weightMode === '1/y' ? '1/Y' : '1/Y²'}</div>
                  <div><span className="text-[#94A3B8]">空白处理：</span>{formatBlankCorrection(fitResult)}</div>
                  <div><span className="text-[#94A3B8]">R²：</span><span className="font-mono font-semibold">{fitResult.r2.toFixed(6)}</span></div>
                  <div><span className="text-[#94A3B8]">RMSE：</span><span className="font-mono font-semibold">{fitResult.rmse.toFixed(6)}</span></div>
                  <div><span className="text-[#94A3B8]">标准品数量：</span>{fitResult.standards.length}</div>
                  <div><span className="text-[#94A3B8]">生成时间：</span>{new Date().toLocaleString('zh-CN')}</div>
                  <div><span className="text-[#94A3B8]">拟合质量：</span><span className={`font-semibold ${fitResult.quality === 'excellent' ? 'text-emerald-600' : fitResult.quality === 'good' ? 'text-[#177E97]' : 'text-amber-600'}`}>{getFitQuality(fitResult.r2).label}</span></div>
                </div>
              </div>

              {/* 拟合参数 */}
              <div className="p-4 bg-[#F8FAFC] rounded-xl">
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">拟合参数</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {fitResult.model === '4pl' && (
                    <>
                      <div><span className="text-[#94A3B8]">A (Bottom)：</span><span className="font-mono">{fitResult.params.A.toFixed(4)}</span></div>
                      <div><span className="text-[#94A3B8]">B (Hill)：</span><span className="font-mono">{fitResult.params.B.toFixed(4)}</span></div>
                      <div><span className="text-[#94A3B8]">C (EC50)：</span><span className="font-mono">{fitResult.params.C.toFixed(4)} pg/mL</span></div>
                      <div><span className="text-[#94A3B8]">D (Top)：</span><span className="font-mono">{fitResult.params.D.toFixed(4)}</span></div>
                    </>
                  )}
                  {fitResult.model === '5pl' && (
                    <>
                      <div><span className="text-[#94A3B8]">A：</span><span className="font-mono">{fitResult.params.A.toFixed(4)}</span></div>
                      <div><span className="text-[#94A3B8]">B：</span><span className="font-mono">{fitResult.params.B.toFixed(4)}</span></div>
                      <div><span className="text-[#94A3B8]">C：</span><span className="font-mono">{fitResult.params.C.toFixed(4)}</span></div>
                      <div><span className="text-[#94A3B8]">D：</span><span className="font-mono">{fitResult.params.D.toFixed(4)}</span></div>
                      <div><span className="text-[#94A3B8]">E：</span><span className="font-mono">{fitResult.params.E.toFixed(4)}</span></div>
                    </>
                  )}
                  {fitResult.model === 'log-log' && (
                    <>
                      <div><span className="text-[#94A3B8]">Slope：</span><span className="font-mono">{fitResult.params.k.toFixed(4)}</span></div>
                      <div><span className="text-[#94A3B8]">Intercept：</span><span className="font-mono">{fitResult.params.b.toFixed(4)}</span></div>
                    </>
                  )}
                </div>
                {(fitResult.model === '4pl' || fitResult.model === '5pl') && (
                  <div className="mt-3 rounded-md bg-[#E8F5F8] p-3">
                    <p className="text-xs text-[#0F667C] font-mono">{formatEquation(fitResult.model, fitResult.params)}</p>
                  </div>
                )}
              </div>

              {/* 标准品数据 */}
              <div>
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">标准品拟合详情</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">孔位</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">标准品</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">浓度</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">复孔</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">均值</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">SD</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">反算浓度</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">终浓度</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">回收率</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">预测 OD</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">残差</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fitResult.standards.map((s, i) => {
                        const pred = fitResult.points[i].predicted
                        const backConc = calculateBackCalculatedConcentration(s.mean)
                        const finalConc = getStandardFinalConcentration(backConc)
                        const recovery = s.concentration > 0 && backConc !== undefined ? `${((backConc / s.concentration) * 100).toFixed(1)}%` : '--'
                        return (
                          <tr key={i} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-600">{s.well || '--'}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">{getStandardDisplayLabels(fitResult.standards)[i]}</td>
                            <td className="py-2 px-3 font-mono">{s.concentration}</td>
                            <td className="py-2 px-3 font-mono text-xs">{s.replicates.map(r => r.toFixed(3)).join(', ')}</td>
                            <td className="py-2 px-3 font-mono">{s.mean.toFixed(3)}</td>
                            <td className="py-2 px-3 font-mono">{s.sd.toFixed(4)}</td>
                            <td className="py-2 px-3 font-mono">{backConc !== undefined ? backConc.toFixed(2) : '--'}</td>
                            <td className="py-2 px-3 font-mono">{finalConc !== undefined ? finalConc.toFixed(2) : '--'}</td>
                            <td className="py-2 px-3 font-mono">{recovery}</td>
                            <td className="py-2 px-3 font-mono text-[#177E97]">{pred.toFixed(3)}</td>
                            <td className="py-2 px-3 font-mono">{(s.mean - pred).toFixed(4)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 96孔位矩阵 */}
              <div>
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">96 孔位结果矩阵</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="py-2 px-2 text-left text-xs font-medium text-slate-500">行</th>
                        {Array.from({ length: 12 }, (_, index) => (
                          <th key={index} className="py-2 px-2 text-left text-xs font-medium text-slate-500">{String(index + 1).padStart(2, '0')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getPlateMatrixRows().map((row, rowIndex) => (
                        <tr key={PLATE_ROWS[rowIndex]} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                          <td className="py-2 px-2 font-mono font-semibold text-slate-600">{PLATE_ROWS[rowIndex]}</td>
                          {row.map(cell => (
                            <td key={cell.well} className="py-2 px-2 align-top">
                              {cell.label ? (
                                <div className={`rounded-lg border px-2 py-1.5 ${cell.status === 'standard' ? 'border-[#BFE3EC] bg-[#E8F5F8] text-[#0F667C]' : getConcentrationStatusClass(cell.status === 'empty' ? undefined : cell.status)}`}>
                                  <div className="font-mono font-semibold">{cell.well}</div>
                                  <div className="truncate">{cell.label}</div>
                                  <div className="font-mono">OD {cell.od?.toFixed(3)}</div>
                                  {cell.value && <div className="font-mono">{cell.value}</div>}
                                </div>
                              ) : (
                                <span className="text-slate-300">--</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 未知样本 */}
              <div>
                <h3 className="text-sm font-semibold text-[#1E293B] mb-3">未知样本浓度结果</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">孔位</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">样本</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">复孔</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">均值 OD</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">稀释倍数</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">反算浓度</th>
                        <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">最终浓度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedUnknowns(fitResult.unknowns).map((u, i) => (
                        <tr key={i} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-600">{u.well || '--'}</td>
                          <td className="py-2 px-3 font-medium">{u.name}</td>
                          <td className="py-2 px-3 font-mono text-xs">{u.replicates.map(r => r.toFixed(3)).join(', ')}</td>
                          <td className="py-2 px-3 font-mono">{u.mean.toFixed(3)}</td>
                          <td className="py-2 px-3 font-mono">{u.dilution || 1}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-[#177E97]">
                            {formatConcentrationValue(u.calculatedConcentration)}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-[#177E97]">
                            {formatConcentrationValue(u.concentration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 警告 */}
              {fitResult.warnings.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <h3 className="text-sm font-semibold text-amber-800 mb-2">⚠ 注意事项</h3>
                  {fitResult.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-amber-700">{w}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'report' && !fitResult && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-[#94A3B8]">请先完成数据拟合</p>
          </div>
        )}
      </div>
    </div>
  )
}
