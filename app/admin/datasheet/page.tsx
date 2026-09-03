'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  FlaskConical,
  AlertCircle,
  Loader2,
  ChevronDown,
  CheckCircle2,
  Download,
  Search,
  RotateCcw,
  WandSparkles,
} from 'lucide-react'

interface Section {
  title: string
  content: string
}

interface GenerateResponse {
  id?: string
  sections?: Section[]
  error?: string
  title?: string
  catalogNumber?: string
  template?: TemplateStatus | null
  templateReady?: boolean
}

interface TemplateStatus {
  fileName: string
  hasPlaceholders: boolean
  placeholders: string[]
  role: 'work_template' | 'complete_sample'
}

interface TargetPerformanceCandidate {
  catalogNumber: string
  name: string
  target: string
  species: string
  detectionRange: string
  sensitivity: string
  source: 'aimeng_product_database' | 'ai_reference_draft'
  confidence: 'verified' | 'needs_review'
  note: string
}

interface TargetIntelResult {
  candidateIntro: string
  performanceCandidates: TargetPerformanceCandidate[]
  keyPoints: string[]
  reviewNotes: string[]
  confidence: 'high' | 'medium' | 'low'
}

const SPECIES_OPTIONS = [
  'Human',
  'Mouse',
  'Rat',
  'Rabbit',
  'Monkey',
  'Canine/Dog',
  'Porcine/Pig',
  'Bovine/Cow',
  'Chicken',
  'Guinea pig',
  'Sheep',
  'Zebrafish',
]

const METHOD_OPTIONS = ['Sandwich', 'Competitive', 'Indirect']
const TARGET_INTEL_DIRECTIONS = ['ELISA说明书简介', '蛋白功能', '疾病相关', '全部']

const SPECIES_CODE_MAP: Record<string, string> = {
  Human: '1',
  Mouse: '3',
  Rat: '2',
  Rabbit: '21',
  Monkey: '5',
  'Canine/Dog': '6',
  'Porcine/Pig': '7',
  'Bovine/Cow': '8',
  Chicken: '9',
  'Guinea pig': '17',
  Sheep: '18',
  Zebrafish: '19',
}

function performanceCandidateKey(item: TargetPerformanceCandidate, index: number) {
  return `${item.source}-${item.catalogNumber || item.name || 'candidate'}-${index}`
}

export default function DatasheetAdminPage() {
  const [target, setTarget] = useState('')
  const [species, setSpecies] = useState('Human')
  const [method, setMethod] = useState('Sandwich')
  const [catalogSerial, setCatalogSerial] = useState('')
  const [detectionRange, setDetectionRange] = useState('')
  const [sensitivity, setSensitivity] = useState('')
  const [targetIntro, setTargetIntro] = useState('')
  const [sampleTypes, setSampleTypes] = useState('血清、血浆、组织匀浆、细胞培养上清及其它生物体液')
  const [targetIntelDirection, setTargetIntelDirection] = useState('ELISA说明书简介')
  const [targetIntelLoading, setTargetIntelLoading] = useState(false)
  const [targetIntelResult, setTargetIntelResult] = useState<TargetIntelResult | null>(null)
  const [targetIntelError, setTargetIntelError] = useState<string | null>(null)
  const [adoptedPerformanceKey, setAdoptedPerformanceKey] = useState<string | null>(null)
  const [introAdopted, setIntroAdopted] = useState(false)
  const [targetIntelFeedback, setTargetIntelFeedback] = useState<string | null>(null)

  const [sections, setSections] = useState<Section[]>([])
  const [templateInfo, setTemplateInfo] = useState<{
    directory: string
    activeTemplate: TemplateStatus | null
    templates: TemplateStatus[]
    placeholderReady: boolean
  } | null>(null)
  const [generatedMeta, setGeneratedMeta] = useState<GenerateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)
  const speciesCode = SPECIES_CODE_MAP[species] || ''
  const previewCatalogNumber = catalogSerial.trim()
    ? `LV${speciesCode}${catalogSerial.trim()}`
    : `LV${speciesCode}____`

  function resetFormForNextDatasheet() {
    setTarget('')
    setSpecies('Human')
    setMethod('Sandwich')
    setCatalogSerial('')
    setDetectionRange('')
    setSensitivity('')
    setTargetIntro('')
    setSampleTypes('血清、血浆、组织匀浆、细胞培养上清及其它生物体液')
    setTargetIntelDirection('ELISA说明书简介')
    setTargetIntelLoading(false)
    setTargetIntelResult(null)
    setTargetIntelError(null)
    setAdoptedPerformanceKey(null)
    setIntroAdopted(false)
    setTargetIntelFeedback(null)
    setSections([])
    setGeneratedMeta(null)
    setGenerated(false)
    setError(null)
  }

  useEffect(() => {
    fetch('/api/datasheet/templates')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setTemplateInfo(data)
      })
      .catch(() => null)
  }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setGenerated(false)
    setGeneratedMeta(null)

    if (!targetIntro.trim()) {
      setError('请填写指标简介素材。该内容会写入说明书“简介”区域，不能留空。')
      setSections([])
      setLoading(false)
      return
    }

    const payload: Record<string, string> = {
      target,
      species,
      method,
      catalogSerial,
      detectionRange,
      sensitivity,
      targetIntro: targetIntro.trim(),
      sampleTypes,
    }

    try {
      const res = await fetch('/api/datasheet/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data: GenerateResponse = await res.json()
      if (data.error) {
        setError(data.error)
        setSections([])
        setGeneratedMeta(null)
      } else if (data.sections) {
        setSections(data.sections)
        setGeneratedMeta(data)
        setGenerated(true)
      } else {
        setError('返回数据格式异常')
        setSections([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试')
      setSections([])
      setGeneratedMeta(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleTargetIntelSearch() {
    setTargetIntelError(null)
    setTargetIntelResult(null)
    setAdoptedPerformanceKey(null)
    setIntroAdopted(false)
    setTargetIntelFeedback(null)

    if (!target.trim()) {
      setTargetIntelError('请先填写靶标名称，再进行智能检索。')
      return
    }
    if (!species.trim()) {
      setTargetIntelError('请先选择种属，再进行智能检索。')
      return
    }

    setTargetIntelLoading(true)
    try {
      const res = await fetch('/api/admin/target-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: target.trim(),
          species,
          direction: targetIntelDirection,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setTargetIntelError(data.error || data.detail || '指标信息智能检索失败。')
        return
      }
      const performanceCandidates = Array.isArray(data.performanceCandidates) ? data.performanceCandidates : []
      if (!data.candidateIntro && performanceCandidates.length === 0) {
        setTargetIntelError('未生成可用的候选简介或检测参数，请稍后重试或手动填写。')
        return
      }
      setTargetIntelResult({
        candidateIntro: data.candidateIntro || '',
        performanceCandidates,
        keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
        reviewNotes: Array.isArray(data.reviewNotes) ? data.reviewNotes : [],
        confidence: data.confidence || 'medium',
      })
    } catch (err) {
      setTargetIntelError(err instanceof Error ? err.message : '指标信息智能检索失败。')
    } finally {
      setTargetIntelLoading(false)
    }
  }

  function adoptPerformanceCandidate(item: TargetPerformanceCandidate, index: number) {
    if (item.detectionRange) setDetectionRange(item.detectionRange)
    if (item.sensitivity) setSensitivity(item.sensitivity)
    const key = performanceCandidateKey(item, index)
    setAdoptedPerformanceKey(key)
    setTargetIntelFeedback(`已采用检测参数：检测范围 ${item.detectionRange || '未提供'}，灵敏度 ${item.sensitivity || '未提供'}。`)
  }

  function adoptCandidateIntro() {
    if (!targetIntelResult?.candidateIntro) return
    setTargetIntro(targetIntelResult.candidateIntro)
    setIntroAdopted(true)
    setTargetIntelFeedback('已采用候选简介，并填入上方“指标简介素材”。')
  }

  return (
    <div className="datasheet-page">
      {/* Page header */}
      <div className="mb-6 no-print">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          说明书生成
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          填写 ELISA 试剂盒参数，生成说明书草稿；正式 Word 模板状态会在下方显示
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Form panel */}
        <div className="w-full lg:w-[40%] no-print">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <FlaskConical className="w-5 h-5 text-cyan-600" />
              <h2 className="text-base font-semibold text-gray-900">参数设置</h2>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              {templateInfo?.activeTemplate ? (
                <div className={`rounded-lg border p-3 text-sm ${
                  templateInfo.placeholderReady
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <div className="flex items-start gap-2">
                    {templateInfo.placeholderReady ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
                    <div>
                      <p className="font-semibold">当前 Word 模板：{templateInfo.activeTemplate.fileName}</p>
                      <p className="mt-1 text-xs leading-5">
                        {templateInfo.placeholderReady
                          ? `已识别 ${templateInfo.activeTemplate.placeholders.length} 个占位符，可进入正式 DOCX 套版流程。`
                          : '已读取模板文件，但该 Word 还没有 {{field_name}} 占位符；当前先生成网页预览草稿，正式 DOCX/PDF 套版需先改造模板。'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  未检测到 Word 模板，请确认模板文件位于 project-materials/02-product-data/datasheet-templates。
                </div>
              )}

              {/* Target */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  靶标 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value)
                    setAdoptedPerformanceKey(null)
                    setIntroAdopted(false)
                    setTargetIntelFeedback(null)
                  }}
                  placeholder="例如：IL-6"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Species */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  种属 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={species}
                    onChange={(e) => {
                      setSpecies(e.target.value)
                      setAdoptedPerformanceKey(null)
                      setIntroAdopted(false)
                      setTargetIntelFeedback(null)
                    }}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm appearance-none bg-white"
                  >
                    {SPECIES_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  方法 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm appearance-none bg-white"
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    检测范围 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={detectionRange}
                    onChange={(e) => {
                      setDetectionRange(e.target.value)
                      setAdoptedPerformanceKey(null)
                      setTargetIntelFeedback(null)
                    }}
                    placeholder="例如：15.6-1000 pg/ml"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    灵敏度 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sensitivity}
                    onChange={(e) => {
                      setSensitivity(e.target.value)
                      setAdoptedPerformanceKey(null)
                      setTargetIntelFeedback(null)
                    }}
                    placeholder="例如：3.1 pg/ml"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  样本类型
                </label>
                <input
                  type="text"
                  value={sampleTypes}
                  onChange={(e) => setSampleTypes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">
                <p className="font-semibold">产品货号自动生成</p>
                <p className="mt-1 text-xs leading-5 text-cyan-800">
                  规则：LV + 种属编号 + 流水号。说明书规格固定显示 96T/48T，不参与货号生成。
                  种属编号：1 Human、2 Rat、3 Mouse、5 Monkey、6 Canine、7 Porcine、8 Bovine、9 Chicken、17 Guinea pig、18 Sheep、19 Zebrafish、21 Rabbit。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  货号流水号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={catalogSerial}
                  onChange={(e) => setCatalogSerial(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="例如：1770"
                  required
                  inputMode="numeric"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                />
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  最终产品货号：<span className="font-semibold text-cyan-700">{previewCatalogNumber}</span>
                </div>
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    指标简介素材 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select
                        value={targetIntelDirection}
                        onChange={(e) => setTargetIntelDirection(e.target.value)}
                        className="h-8 rounded-lg border border-gray-300 bg-white pl-2 pr-7 text-xs text-gray-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 appearance-none"
                      >
                        {TARGET_INTEL_DIRECTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    </div>
                    <button
                      type="button"
                      onClick={handleTargetIntelSearch}
                      disabled={targetIntelLoading}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {targetIntelLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <WandSparkles className="h-3.5 w-3.5" />
                      )}
                      智能检索
                    </button>
                  </div>
                </div>
                <textarea
                  value={targetIntro}
                  onChange={(e) => {
                    setTargetIntro(e.target.value)
                    setIntroAdopted(false)
                    setTargetIntelFeedback(null)
                  }}
                  placeholder="请粘贴已审核的指标简介素材；该内容会自动填入说明书“简介”区域。"
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm resize-none"
                />
                {targetIntelError && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{targetIntelError}</span>
                  </div>
                )}
                {targetIntelResult && (
                  <div className="mt-3 rounded-lg border border-cyan-100 bg-slate-50 p-3 text-sm text-slate-800">
                    {targetIntelFeedback && (
                      <div
                        aria-live="polite"
                        className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium leading-5 text-emerald-800"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{targetIntelFeedback}</span>
                      </div>
                    )}
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Search className="h-4 w-4 text-cyan-600" />
                        候选简介素材
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                        可信度：{targetIntelResult.confidence === 'high' ? '高' : targetIntelResult.confidence === 'low' ? '低' : '中'}
                      </span>
                    </div>
                    {targetIntelResult.candidateIntro ? (
                      <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                        {targetIntelResult.candidateIntro}
                      </p>
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                        本次未生成简介素材，但已返回检测参数候选；简介请手动填写或再次检索。
                      </div>
                    )}
                    {targetIntelResult.keyPoints.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-500">提炼要点</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {targetIntelResult.keyPoints.map((point) => (
                            <span key={point} className="rounded-full bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                              {point}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {targetIntelResult.performanceCandidates.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-500">检测范围 / 灵敏度候选</p>
                        <div className="mt-2 space-y-2">
                          {targetIntelResult.performanceCandidates.map((item, index) => (
                            <div key={performanceCandidateKey(item, index)} className={`rounded-lg border bg-white p-3 transition-colors ${
                              adoptedPerformanceKey === performanceCandidateKey(item, index)
                                ? 'border-emerald-300 ring-2 ring-emerald-100'
                                : 'border-slate-200'
                            }`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {item.catalogNumber || item.name || '候选参数'}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {item.confidence === 'verified' ? '来自爱萌产品库' : 'AI 待核验候选'} · {item.note}
                                  </p>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                                  item.confidence === 'verified'
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                }`}>
                                  {item.confidence === 'verified' ? '已验证' : '待核验'}
                                </span>
                              </div>
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                  检测范围：<span className="font-semibold">{item.detectionRange || '未提供'}</span>
                                </div>
                                <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                  灵敏度：<span className="font-semibold">{item.sensitivity || '未提供'}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => adoptPerformanceCandidate(item, index)}
                                className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] ${
                                  adoptedPerformanceKey === performanceCandidateKey(item, index)
                                    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700'
                                }`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {adoptedPerformanceKey === performanceCandidateKey(item, index) ? '已采用到上方' : '采用检测参数'}
                              </button>
                              {adoptedPerformanceKey === performanceCandidateKey(item, index) && (
                                <p className="mt-1.5 text-xs font-medium text-emerald-700">
                                  已填入“检测范围”和“灵敏度”输入框。
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {targetIntelResult.reviewNotes.length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">
                        <p className="font-semibold">采用前请人工核验</p>
                        {targetIntelResult.reviewNotes.map((note) => (
                          <p key={note}>• {note}</p>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!targetIntelResult.candidateIntro}
                      onClick={adoptCandidateIntro}
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                        introAdopted ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-cyan-600 hover:bg-cyan-700'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {introAdopted ? '已采用此简介' : '采用此简介'}
                    </button>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      生成说明书
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetFormForNextDatasheet}
                  disabled={loading || targetIntelLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200"
                >
                  <RotateCcw className="w-4 h-4" />
                  一键清空，开始下一个指标
                </button>

                {generatedMeta?.id && generatedMeta.templateReady ? (
                  <a
                    href={`/api/datasheet/docx?id=${encodeURIComponent(generatedMeta.id)}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    下载正式 Word
                  </a>
                ) : generatedMeta?.id ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    当前 Word 模板没有占位符，暂时不能生成正式 DOCX。请先按占位符规范改造模板。
                  </div>
                ) : null}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right: Preview panel */}
        <div className="w-full lg:w-[60%]">
          <div
            ref={previewRef}
            className="bg-white rounded-xl border border-gray-200 p-8 min-h-[600px] print-card"
          >
            {!generated && sections.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-center">
                <FileText className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">
                  填写左侧信息并点击生成
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  说明书预览将显示在此处
                </p>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center h-[400px]">
                <Loader2 className="w-8 h-8 text-cyan-600 animate-spin mb-3" />
                <p className="text-gray-500 text-sm">正在生成说明书...</p>
              </div>
            ) : (
              <div className="datasheet-content space-y-6">
                {generatedMeta && (
                  <div className={`rounded-lg border p-4 text-sm ${
                    generatedMeta.templateReady
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}>
                    <p className="font-semibold">
                      已生成草稿：{generatedMeta.catalogNumber || '-'}
                    </p>
                    <p className="mt-1 text-xs leading-5">
                      使用模板：{generatedMeta.template?.fileName || '未检测到模板'}。
                      {generatedMeta.templateReady
                        ? '该模板具备占位符，后续可生成正式 DOCX/PDF。'
                        : '当前 Word 模板尚未设置占位符，因此这里是网页预览草稿，不是最终正式 Word 套版文件。'}
                    </p>
                  </div>
                )}
                {/* Header for print */}
                <div className="print-header hidden print:block border-b border-gray-300 pb-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">
                        AIMENG UNING 爱萌优宁
                      </h1>
                      <p className="text-sm text-gray-600 mt-0.5">
                        ELISA 试剂盒产品说明书
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>靶标: {target || '-'}</p>
                      <p>种属: {species}</p>
                      <p>方法: {method}</p>
                      <p>规格: 96T/48T</p>
                    </div>
                  </div>
                </div>

                {sections.map((section, idx) => (
                  <div key={idx} className="datasheet-section">
                    <h3 className="text-base font-bold text-gray-900 mb-2 pb-1 border-b border-gray-200">
                      {section.title}
                    </h3>
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {section.content}
                    </div>
                  </div>
                ))}

                {/* Footer for print */}
                <div className="print-footer hidden print:block border-t border-gray-300 pt-4 mt-8 text-xs text-gray-500 text-center">
                  <p>AIMENG UNING 爱萌优宁 · www.animalunion.cn</p>
                  <p className="mt-0.5">本说明书仅供科研使用，请仔细阅读后操作。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 20mm;
          }
          body {
            background: white !important;
          }
          .no-print,
          .no-print * {
            display: none !important;
          }
          .datasheet-page {
            padding: 0 !important;
          }
          .datasheet-page > div {
            display: block !important;
          }
          .datasheet-page .w-full\\.lg\\:w\\[40\\%\\],
          .datasheet-page .w-full.lg\\:w-\\[40\\%\\] {
            display: none !important;
          }
          .datasheet-page .w-full\\.lg\\:w\\[60\\%\\],
          .datasheet-page .w-full.lg\\:w-\\[60\\%\\] {
            width: 100% !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          .print-header {
            display: block !important;
          }
          .print-footer {
            display: block !important;
          }
          .datasheet-section h3 {
            color: black !important;
            border-bottom-color: #ccc !important;
          }
          .datasheet-section div {
            color: #333 !important;
          }
        }
      `}</style>
    </div>
  )
}
