'use client'

import { useState, useMemo } from 'react'
import { Calculator, CheckCircle2, Info } from 'lucide-react'

export default function PlateCalculator() {
  const [sampleCount, setSampleCount] = useState<number>(20)
  const [stdReplicates, setStdReplicates] = useState<number>(2)
  const [sampleReplicates, setSampleReplicates] = useState<number>(2)
  const [blankWells, setBlankWells] = useState<number>(2)

  const result = useMemo(() => {
    const stdPoints = 8 // S1-S7 + Blank
    const stdWells = stdPoints * stdReplicates
    const sampleWells = sampleCount * sampleReplicates
    const totalWells = stdWells + blankWells + sampleWells

    const plate48Available = 48 - stdWells - blankWells
    const plate96Available = 96 - stdWells - blankWells

    // Recommendations
    const recommendations: Array<{
      label: string
      plates: number
      type: '48T' | '96T'
      totalCapacity: number
      available: number
      margin: number
      note: string
    }> = []

    // Check 96T options
    const plates96 = Math.ceil(totalWells / 96)
    const capacity96 = plates96 * 96
    const margin96 = capacity96 - totalWells
    recommendations.push({
      label: plates96 === 1 ? '🥇 推荐方案' : '🥈 备选方案',
      plates: plates96,
      type: '96T',
      totalCapacity: capacity96,
      available: plate96Available,
      margin: margin96,
      note: plates96 === 1 ? '单块 96T 即可满足' : '适合大批量实验',
    })

    // Check 48T options
    const plates48 = Math.ceil(totalWells / 48)
    const capacity48 = plates48 * 48
    const margin48 = capacity48 - totalWells
    if (plates48 <= 2 && plates48 !== plates96) {
      recommendations.push({
        label: plates48 === 1 ? '🥈 小批量方案' : '🥉 分批方案',
        plates: plates48,
        type: '48T',
        totalCapacity: capacity48,
        available: plate48Available,
        margin: margin48,
        note: plates48 === 1 ? '适合小样本量，经济灵活' : '适合分批实验',
      })
    }

    return {
      stdWells,
      sampleWells,
      blankWells,
      totalWells,
      plate48Available,
      plate96Available,
      recommendations,
    }
  }, [sampleCount, stdReplicates, sampleReplicates, blankWells])

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">酶标板孔数计算器</h3>
          <p className="text-xs text-slate-500">基于 AIMENG UNING 产品说明书（8 点标准曲线：S1-S7 + Blank）</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Sample count */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            样本数量
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={sampleCount}
            onChange={(e) => setSampleCount(Math.max(1, Math.min(200, Number(e.target.value) || 0)))}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Standard replicates */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            标准品操作 <span className="text-xs text-emerald-600 font-normal">（说明书推荐双孔）</span>
          </label>
          <div className="flex gap-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                onClick={() => setStdReplicates(n)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  stdReplicates === n
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {n === 1 ? '单孔' : '双孔（推荐）'}
              </button>
            ))}
          </div>
        </div>

        {/* Sample replicates */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            样本平行次数 <span className="text-xs text-emerald-600 font-normal">（说明书推荐双孔）</span>
          </label>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setSampleReplicates(n)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  sampleReplicates === n
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {n === 1 ? '不做平行' : n === 2 ? '双孔' : '三孔'}
              </button>
            ))}
          </div>
        </div>

        {/* Blank wells */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            空白对照孔
          </label>
          <div className="flex gap-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                onClick={() => setBlankWells(n)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  blankWells === n
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {n} 孔 {n === 2 && <span className="text-xs">（推荐）</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="bg-slate-50 rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-semibold text-slate-900">详细孔数分配</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">标准品孔（{stdReplicates === 1 ? '单孔' : '双孔'} × 8 点）</span>
            <span className="font-semibold text-slate-900">{result.stdWells} 孔</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">空白对照孔</span>
            <span className="font-semibold text-slate-900">{result.blankWells} 孔</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              样本孔（{sampleCount} × {sampleReplicates}）
            </span>
            <span className="font-semibold text-slate-900">{result.sampleWells} 孔</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="font-semibold text-slate-900">总需求孔数</span>
            <span className="font-bold text-blue-600 text-lg">{result.totalWells} 孔</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900">推荐方案</h4>
        {result.recommendations.map((rec, i) => (
          <div
            key={i}
            className={`rounded-xl p-4 border ${
              i === 0
                ? 'bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900">{rec.label}</span>
              <span className="text-sm font-bold text-blue-600">
                {rec.plates} 块 {rec.type}
              </span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>总容量：{rec.totalCapacity} 孔 | 余量：{rec.margin} 孔</p>
              <p className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                {rec.note}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <p>
          公式：总需求 = 标准品孔数（8 点 × 标准品平行）+ 空白对照孔 + 样本数 × 样本平行次数。
          实际可用孔数 = 板总孔数（48T/96T）- 标准品孔 - 空白孔。
        </p>
      </div>
    </div>
  )
}
