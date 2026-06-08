'use client'

import { useState, useRef } from 'react'
import {
  FileText,
  Printer,
  FlaskConical,
  AlertCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react'

interface Section {
  title: string
  content: string
}

interface GenerateResponse {
  sections?: Section[]
  error?: string
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

const SIZE_OPTIONS = ['48T', '96T']

export default function DatasheetAdminPage() {
  const [target, setTarget] = useState('')
  const [species, setSpecies] = useState('Human')
  const [method, setMethod] = useState('Sandwich')
  const [size, setSize] = useState('96T')
  const [antibodyId, setAntibodyId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [customAntibody, setCustomAntibody] = useState('')

  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setGenerated(false)

    const payload: Record<string, string> = {
      target,
      species,
      method,
      size,
    }
    if (antibodyId.trim()) payload.antibodyId = antibodyId.trim()
    if (templateId.trim()) payload.templateId = templateId.trim()
    if (customAntibody.trim()) payload.customAntibody = customAntibody.trim()

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
      } else if (data.sections) {
        setSections(data.sections)
        setGenerated(true)
      } else {
        setError('返回数据格式异常')
        setSections([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试')
      setSections([])
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
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
          填写 ELISA 试剂盒参数，自动生成产品说明书
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
              {/* Target */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  靶标 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
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
                    onChange={(e) => setSpecies(e.target.value)}
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

              {/* Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  规格 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm appearance-none bg-white"
                  >
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Antibody ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  抗体编号
                  <span className="text-gray-400 font-normal ml-1">（可选）</span>
                </label>
                <input
                  type="text"
                  value={antibodyId}
                  onChange={(e) => setAntibodyId(e.target.value)}
                  placeholder="例如：AB-2024-001"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Template ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模板编号
                  <span className="text-gray-400 font-normal ml-1">（可选）</span>
                </label>
                <input
                  type="text"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="例如：TPL-001"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Custom Antibody */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  自定义抗体信息
                  <span className="text-gray-400 font-normal ml-1">（可选）</span>
                </label>
                <textarea
                  value={customAntibody}
                  onChange={(e) => setCustomAntibody(e.target.value)}
                  placeholder="输入额外的抗体描述或备注..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm resize-none"
                />
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
                  onClick={handlePrint}
                  disabled={!generated && sections.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200"
                >
                  <Printer className="w-4 h-4" />
                  打印 / 存PDF
                </button>
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
                      <p>规格: {size}</p>
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
