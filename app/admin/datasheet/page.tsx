'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Select, Spin, Tag } from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  RedoOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

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

function confidenceLabel(confidence: TargetIntelResult['confidence']) {
  if (confidence === 'high') return '高'
  if (confidence === 'low') return '低'
  return '中'
}

function confidenceTagColor(confidence: TargetIntelResult['confidence']) {
  if (confidence === 'high') return 'green'
  if (confidence === 'low') return 'volcano'
  return 'gold'
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
      <div className="no-print">
        <PageHeader
          icon={<FileTextOutlined />}
          title="说明书生成"
          description="填写 ELISA 试剂盒参数，生成说明书草稿；正式 Word 模板状态会在下方显示"
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: Form panel */}
        <div className="no-print w-full lg:w-[40%]">
          <Card
            title={
              <span className="flex items-center gap-2">
                <ExperimentOutlined />
                参数设置
              </span>
            }
          >
            <form onSubmit={handleGenerate} className="space-y-4">
              {templateInfo?.activeTemplate ? (
                <Alert
                  type={templateInfo.placeholderReady ? 'success' : 'warning'}
                  showIcon
                  message={`当前 Word 模板：${templateInfo.activeTemplate.fileName}`}
                  description={
                    templateInfo.placeholderReady
                      ? `已识别 ${templateInfo.activeTemplate.placeholders.length} 个占位符，可进入正式 DOCX 套版流程。`
                      : '已读取模板文件，但该 Word 还没有 {{field_name}} 占位符；当前先生成网页预览草稿，正式 DOCX/PDF 套版需先改造模板。'
                  }
                />
              ) : (
                <Alert
                  type="error"
                  showIcon
                  message="未检测到 Word 模板，请确认模板文件位于 project-materials/02-product-data/datasheet-templates。"
                />
              )}

              {/* Target */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  靶标 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value)
                    setAdoptedPerformanceKey(null)
                    setIntroAdopted(false)
                    setTargetIntelFeedback(null)
                  }}
                  placeholder="例如：IL-6"
                  required
                />
              </div>

              {/* Species */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  种属 <span className="text-red-500">*</span>
                </label>
                <Select
                  className="w-full"
                  value={species}
                  onChange={(value) => {
                    setSpecies(value)
                    setAdoptedPerformanceKey(null)
                    setIntroAdopted(false)
                    setTargetIntelFeedback(null)
                  }}
                  options={SPECIES_OPTIONS.map((s) => ({ value: s, label: s }))}
                />
              </div>

              {/* Method */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  方法 <span className="text-red-500">*</span>
                </label>
                <Select
                  className="w-full"
                  value={method}
                  onChange={(value) => setMethod(value)}
                  options={METHOD_OPTIONS.map((m) => ({ value: m, label: m }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    检测范围 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={detectionRange}
                    onChange={(e) => {
                      setDetectionRange(e.target.value)
                      setAdoptedPerformanceKey(null)
                      setTargetIntelFeedback(null)
                    }}
                    placeholder="例如：15.6-1000 pg/ml"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    灵敏度 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={sensitivity}
                    onChange={(e) => {
                      setSensitivity(e.target.value)
                      setAdoptedPerformanceKey(null)
                      setTargetIntelFeedback(null)
                    }}
                    placeholder="例如：3.1 pg/ml"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">样本类型</label>
                <Input
                  value={sampleTypes}
                  onChange={(e) => setSampleTypes(e.target.value)}
                />
              </div>

              <Alert
                type="info"
                showIcon
                message="产品货号自动生成"
                description="规则：LV + 种属编号 + 流水号。说明书规格固定显示 96T/48T，不参与货号生成。种属编号：1 Human、2 Rat、3 Mouse、5 Monkey、6 Canine、7 Porcine、8 Bovine、9 Chicken、17 Guinea pig、18 Sheep、19 Zebrafish、21 Rabbit。"
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  货号流水号 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={catalogSerial}
                  onChange={(e) => setCatalogSerial(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="例如：1770"
                  required
                  inputMode="numeric"
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
                    <Select
                      size="small"
                      className="min-w-[120px]"
                      value={targetIntelDirection}
                      onChange={(value) => setTargetIntelDirection(value)}
                      options={TARGET_INTEL_DIRECTIONS.map((item) => ({ value: item, label: item }))}
                    />
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      loading={targetIntelLoading}
                      onClick={handleTargetIntelSearch}
                    >
                      智能检索
                    </Button>
                  </div>
                </div>
                <Input.TextArea
                  value={targetIntro}
                  onChange={(e) => {
                    setTargetIntro(e.target.value)
                    setIntroAdopted(false)
                    setTargetIntelFeedback(null)
                  }}
                  placeholder="请粘贴已审核的指标简介素材；该内容会自动填入说明书“简介”区域。"
                  rows={3}
                  required
                />
                {targetIntelError && (
                  <Alert className="mt-2" type="error" showIcon message={targetIntelError} />
                )}
                {targetIntelResult && (
                  <Card
                    size="small"
                    className="mt-3"
                    title={
                      <span className="flex items-center gap-2 text-sm">
                        <SearchOutlined />
                        候选简介素材
                      </span>
                    }
                    extra={
                      <Tag color={confidenceTagColor(targetIntelResult.confidence)}>
                        可信度：{confidenceLabel(targetIntelResult.confidence)}
                      </Tag>
                    }
                  >
                    {targetIntelFeedback && (
                      <Alert
                        aria-live="polite"
                        className="mb-3"
                        type="success"
                        showIcon
                        message={targetIntelFeedback}
                      />
                    )}
                    {targetIntelResult.candidateIntro ? (
                      <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                        {targetIntelResult.candidateIntro}
                      </p>
                    ) : (
                      <Alert
                        type="warning"
                        message="本次未生成简介素材，但已返回检测参数候选；简介请手动填写或再次检索。"
                      />
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
                            <div
                              key={performanceCandidateKey(item, index)}
                              className={`rounded-lg border bg-white p-3 transition-colors ${
                                adoptedPerformanceKey === performanceCandidateKey(item, index)
                                  ? 'border-emerald-400 bg-emerald-50'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {item.catalogNumber || item.name || '候选参数'}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {item.confidence === 'verified' ? '来自爱萌产品库' : 'AI 待核验候选'} · {item.note}
                                  </p>
                                </div>
                                <Tag color={item.confidence === 'verified' ? 'green' : 'gold'}>
                                  {item.confidence === 'verified' ? '已验证' : '待核验'}
                                </Tag>
                              </div>
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                  检测范围：<span className="font-semibold">{item.detectionRange || '未提供'}</span>
                                </div>
                                <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                  灵敏度：<span className="font-semibold">{item.sensitivity || '未提供'}</span>
                                </div>
                              </div>
                              <Button
                                className="mt-2"
                                size="small"
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={() => adoptPerformanceCandidate(item, index)}
                              >
                                {adoptedPerformanceKey === performanceCandidateKey(item, index) ? '已采用到上方' : '采用检测参数'}
                              </Button>
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
                      <Alert
                        className="mt-3"
                        type="warning"
                        showIcon
                        message="采用前请人工核验"
                        description={
                          <div>
                            {targetIntelResult.reviewNotes.map((note) => (
                              <p key={note}>• {note}</p>
                            ))}
                          </div>
                        }
                      />
                    )}
                    <Button
                      className="mt-3"
                      size="small"
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      disabled={!targetIntelResult.candidateIntro}
                      onClick={adoptCandidateIntro}
                    >
                      {introAdopted ? '已采用此简介' : '采用此简介'}
                    </Button>
                  </Card>
                )}
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  icon={<FileTextOutlined />}
                  loading={loading}
                >
                  生成说明书
                </Button>

                <Button
                  block
                  icon={<RedoOutlined />}
                  onClick={resetFormForNextDatasheet}
                  disabled={loading || targetIntelLoading}
                >
                  一键清空，开始下一个指标
                </Button>

                {generatedMeta?.id && generatedMeta.templateReady ? (
                  <Button
                    type="primary"
                    block
                    icon={<DownloadOutlined />}
                    href={`/api/datasheet/docx?id=${encodeURIComponent(generatedMeta.id)}`}
                  >
                    下载正式 Word
                  </Button>
                ) : generatedMeta?.id ? (
                  <Alert
                    type="warning"
                    message="当前 Word 模板没有占位符，暂时不能生成正式 DOCX。请先按占位符规范改造模板。"
                  />
                ) : null}
              </div>

              {/* Error */}
              {error && <Alert type="error" showIcon message={error} />}
            </form>
          </Card>
        </div>

        {/* Right: Preview panel */}
        <div className="w-full lg:w-[60%]">
          <div ref={previewRef}>
            <Card className="print-card" styles={{ body: { padding: 32, minHeight: 600 } }}>
              {!generated && sections.length === 0 && !loading ? (
                <div className="flex h-[400px] flex-col items-center justify-center text-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span className="text-sm text-slate-500">
                        填写左侧信息并点击生成
                        <span className="mt-1 block text-xs text-slate-400">说明书预览将显示在此处</span>
                      </span>
                    }
                  />
                </div>
              ) : loading ? (
                <div className="flex h-[400px] flex-col items-center justify-center">
                  <Spin size="large" />
                  <p className="mt-3 text-sm text-slate-500">正在生成说明书...</p>
                </div>
              ) : (
                <div className="datasheet-content space-y-6">
                  {generatedMeta && (
                    <Alert
                      type={generatedMeta.templateReady ? 'success' : 'warning'}
                      showIcon
                      message={`已生成草稿：${generatedMeta.catalogNumber || '-'}`}
                      description={`使用模板：${generatedMeta.template?.fileName || '未检测到模板'}。${
                        generatedMeta.templateReady
                          ? '该模板具备占位符，后续可生成正式 DOCX/PDF。'
                          : '当前 Word 模板尚未设置占位符，因此这里是网页预览草稿，不是最终正式 Word 套版文件。'
                      }`}
                    />
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
            </Card>
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
          .datasheet-page .w-full.lg\\:w-\\[40\\%\\] {
            display: none !important;
          }
          .datasheet-page .w-full.lg\\:w-\\[60\\%\\] {
            width: 100% !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          .print-card .ant-card-body {
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
