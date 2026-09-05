'use client'

import { useState, useMemo } from 'react'
import { Calculator, CheckCircle2, Info } from 'lucide-react'

type PlateRecommendation = {
  label: string
  plate96Count: number
  plate48Count: number
  plateCount: number
  totalCapacity: number
  sampleCapacity: number
  usedWells: number
  margin: number
  note: string
}

function formatPlateMix(recommendation: Pick<PlateRecommendation, 'plate96Count' | 'plate48Count'>) {
  const parts: string[] = []
  if (recommendation.plate96Count > 0) parts.push(`${recommendation.plate96Count} 块 96T`)
  if (recommendation.plate48Count > 0) parts.push(`${recommendation.plate48Count} 块 48T`)
  return parts.join(' + ')
}

function buildPlateRecommendations(sampleWells: number, stdWellsPerPlate: number): PlateRecommendation[] {
  const plate48SampleCapacity = 48 - stdWellsPerPlate
  const plate96SampleCapacity = 96 - stdWellsPerPlate
  const maxPlates = Math.max(1, Math.ceil(sampleWells / Math.max(plate48SampleCapacity, 1)) + 1)
  const candidates: PlateRecommendation[] = []

  for (let plate96Count = 0; plate96Count <= maxPlates; plate96Count += 1) {
    for (let plate48Count = 0; plate48Count <= maxPlates; plate48Count += 1) {
      const plateCount = plate96Count + plate48Count
      if (plateCount === 0) continue

      const sampleCapacity =
        plate96Count * plate96SampleCapacity + plate48Count * plate48SampleCapacity

      if (sampleCapacity < sampleWells) continue

      const totalCapacity = plate96Count * 96 + plate48Count * 48
      const usedWells = sampleWells + stdWellsPerPlate * plateCount
      const margin = sampleCapacity - sampleWells

      candidates.push({
        label: '',
        plate96Count,
        plate48Count,
        plateCount,
        totalCapacity,
        sampleCapacity,
        usedWells,
        margin,
        note: '',
      })
    }
  }

  return candidates
    .sort((a, b) => {
      if (a.plateCount !== b.plateCount) return a.plateCount - b.plateCount
      if (a.margin !== b.margin) return a.margin - b.margin
      if (a.totalCapacity !== b.totalCapacity) return a.totalCapacity - b.totalCapacity
      return b.plate96Count - a.plate96Count
    })
    .slice(0, 2)
    .map((candidate, index) => ({
      ...candidate,
      label: index === 0 ? '🥇 推荐方案' : '🥈 备选方案',
      note:
        index === 0
          ? '按每块板重做标准曲线后，孔板浪费最少'
          : '可作为库存不足时的替代组合',
    }))
}

export default function PlateCalculator() {
  const [sampleCount, setSampleCount] = useState<number>(20)
  const [stdReplicates, setStdReplicates] = useState<number>(2)
  const [sampleReplicates, setSampleReplicates] = useState<number>(2)

  const result = useMemo(() => {
    const stdPoints = 8 // S1-S7 + Blank
    const stdWells = stdPoints * stdReplicates
    const blankWells = stdReplicates // Blank is included in the 8-point standard curve.
    const sampleWells = sampleCount * sampleReplicates
    const totalWells = stdWells + sampleWells

    const plate48Available = 48 - stdWells
    const plate96Available = 96 - stdWells
    const recommendations = buildPlateRecommendations(sampleWells, stdWells)

    return {
      stdWells,
      sampleWells,
      blankWells,
      totalWells,
      plate48Available,
      plate96Available,
      recommendations,
    }
  }, [sampleCount, stdReplicates, sampleReplicates])

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

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Blank 已包含在标准曲线中</p>
          <p className="mt-1 text-xs leading-5 text-emerald-700">
            8 点标准曲线 = S1-S7 + Blank。空白孔随标准品操作自动计算，不需要单独选择。
          </p>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="bg-slate-50 rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-semibold text-slate-900">详细孔数分配</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">标准曲线孔（S1-S7 + Blank，{stdReplicates === 1 ? '单孔' : '双孔'} × 8 点）</span>
            <span className="font-semibold text-slate-900">{result.stdWells} 孔</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">其中 Blank 孔（已包含，不额外加孔）</span>
            <span className="font-semibold text-slate-900">{result.blankWells} 孔</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">
              样本孔（{sampleCount} × {sampleReplicates}）
            </span>
            <span className="font-semibold text-slate-900">{result.sampleWells} 孔</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="font-semibold text-slate-900">单板基础需求孔数</span>
            <span className="font-bold text-[#177E97] text-lg">{result.totalWells} 孔</span>
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
              <span className="text-sm font-bold text-[#177E97]">
                {formatPlateMix(rec)}
              </span>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>总容量：{rec.totalCapacity} 孔 | 实际占用：{rec.usedWells} 孔 | 余量：{rec.margin} 孔</p>
              <p>
                可测样本孔：{rec.sampleCapacity} 孔（每块板已扣除 {result.stdWells} 孔标准曲线）
              </p>
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
          公式：每块板都需要标准曲线。96T 实际可测样本孔 = 96 - 标准曲线孔数；
          48T 实际可测样本孔 = 48 - 标准曲线孔数。系统优先选择板数最少、余量最小的 96T/48T 组合。
        </p>
      </div>
    </div>
  )
}
