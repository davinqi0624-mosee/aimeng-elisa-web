'use client'

import { useState, useCallback } from 'react'
import {
  Upload,
  BarChart3,
  FileSpreadsheet,
  Calculator,
  Download,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import StandardCurveChart from '@/components/analysis/StandardCurveChart'
import ConcentrationTable from '@/components/analysis/ConcentrationTable'

interface AnalysisResult {
  fit: {
    A: number
    B: number
    C: number
    D: number
    r2: number
    equation: string
  }
  standards: Array<{
    concentration: number
    od: number
    predicted: number
    residual: number
  }>
  samples: Array<{
    id: string
    od: number
    concentration: number | null
    dilution: number
    finalConcentration: number | null
  }>
}

export default function AnalysisPage() {
  const [rawData, setRawData] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const handleAnalyze = useCallback(async () => {
    if (!rawData.trim()) {
      setError('请输入数据')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [rawData])

  const handleGenerateReport = async () => {
    if (!result) return
    setReportLoading(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, rawData }),
      })
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ELISA分析报告_${new Date().toISOString().slice(0, 10)}.html`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">在线数据分析</h1>
          <p className="text-sm text-gray-500">标准曲线拟合、浓度计算与报告生成</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              粘贴数据（CSV / Excel）
            </label>
            <button
              onClick={() => { setRawData(''); setResult(null) }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              清空
            </button>
          </div>
          <textarea
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            placeholder={`格式示例：
类型,编号,浓度(pg/mL),OD值,稀释倍数
标准品,STD1,1000,2.845,
标准品,STD2,500,1.923,
标准品,STD3,250,1.145,
标准品,STD4,125,0.678,
标准品,STD5,62.5,0.412,
标准品,STD6,31.25,0.256,
标准品,STD7,15.625,0.178,
样本,S1,,0.892,1
样本,S2,,1.234,1
样本,S3,,0.456,2`}
            rows={18}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                计算中...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                运行 4PL 拟合分析
              </>
            )}
          </button>
        </div>

        {/* Result Panel */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Fit Stats */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  拟合结果
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">R² 决定系数</div>
                    <div className={`text-lg font-bold ${result.fit.r2 >= 0.99 ? 'text-emerald-600' : result.fit.r2 >= 0.95 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {result.fit.r2.toFixed(4)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">拐点浓度 (C)</div>
                    <div className="text-lg font-bold text-gray-900">{result.fit.C.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">斜率因子 (B)</div>
                    <div className="text-lg font-bold text-gray-900">{result.fit.B.toFixed(3)}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 font-mono">
                  {result.fit.equation}
                </div>
              </div>

              {/* Chart */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <StandardCurveChart standards={result.standards} />
              </div>

              {/* Table */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <ConcentrationTable samples={result.samples} />
              </div>

              {/* Actions */}
              <button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {reportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    导出分析报告
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <Upload className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">粘贴数据并点击分析，结果将显示在这里</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
