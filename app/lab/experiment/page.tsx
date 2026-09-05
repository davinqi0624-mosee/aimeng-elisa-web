'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ClipboardList,
  Layers3,
  Loader2,
  Microscope,
  Send,
  Sparkles,
  Target,
} from 'lucide-react'

type ExperimentType = 'elisa' | 'cell' | 'wb' | 'ihc' | 'biochemical'

const EXPERIMENT_AI_ASSISTANT_IMAGE = '/brand/experiment-ai-assistant-900.jpg'

interface ProtocolResult {
  title: string
  protocolContent: string
  checklist: string[]
}

type ExperimentConfig = {
  value: ExperimentType
  label: string
  desc: string
  cluesTitle: string
  detailsPlaceholder: string
  protocolSections: string[]
}

const EXPERIMENT_TYPES: ExperimentConfig[] = [
  {
    value: 'elisa',
    label: 'ELISA 实验',
    desc: '指标定量、标准曲线、样本处理和孔板布局',
    cluesTitle: 'ELISA 设计线索',
    detailsPlaceholder:
      '可补充：样本来源、样本类型、检测指标、样本数量、预期浓度范围、是否需要代测、是否已有试剂盒或说明书要求。',
    protocolSections: [
      '实验目的与检测指标确认',
      '样本类型、种属、分组和样本量设计',
      '试剂盒选择、标准曲线和孔板布局',
      '样本稀释、加样、孵育、洗板和显色终止',
      'OD 读取、4PL 拟合、浓度换算和质控判断',
    ],
  },
  {
    value: 'cell',
    label: '细胞实验',
    desc: '细胞来源、培养条件、处理分组和检测终点',
    cluesTitle: '细胞实验设计线索',
    detailsPlaceholder:
      '可补充：细胞名称、原代或细胞系、细胞类型、培养基、血清比例、接种密度、处理因素、刺激时间、检测终点和对照组。',
    protocolSections: [
      '细胞来源、细胞类型和培养条件确认',
      '复苏/传代/铺板密度和状态要求',
      '处理因素、剂量梯度、时间点和对照组设计',
      '培养、刺激、换液、收样或染色检测流程',
      '细胞状态、污染风险、重复数和数据记录标准',
    ],
  },
  {
    value: 'wb',
    label: 'WB 实验',
    desc: '蛋白提取、电泳转膜、抗体孵育和显色',
    cluesTitle: 'WB 设计线索',
    detailsPlaceholder:
      '可补充：样本来源、目标蛋白、分子量、蛋白提取方式、上样量、内参、抗体信息、膜类型、显色方式和预期结果。',
    protocolSections: [
      '实验目的、目标蛋白和内参确认',
      '样本裂解、蛋白提取、定量和变性',
      'SDS-PAGE 电泳、转膜和封闭',
      '一抗/二抗孵育、洗膜、显色或发光检测',
      '条带定量、归一化、阴阳性对照和异常排查',
    ],
  },
  {
    value: 'ihc',
    label: 'IHC 实验',
    desc: '组织切片、抗原修复、封闭染色和判读',
    cluesTitle: 'IHC 设计线索',
    detailsPlaceholder:
      '可补充：组织类型、固定方式、石蜡/冰冻切片、目标抗原、抗体信息、抗原修复方式、显色体系、阳性组织和判读指标。',
    protocolSections: [
      '组织来源、固定包埋方式和目标抗原确认',
      '切片、脱蜡复水或冰冻切片预处理',
      '抗原修复、封闭和内源性酶处理',
      '一抗/二抗孵育、DAB 或荧光显色、复染封片',
      '阳性/阴性对照、图像采集、评分和结果判读',
    ],
  },
  {
    value: 'biochemical',
    label: '生化检测实验',
    desc: '酶活、代谢指标、氧化应激和比色检测',
    cluesTitle: '生化检测设计线索',
    detailsPlaceholder:
      '可补充：检测指标、样本类型、前处理方式、匀浆比例、检测方法、酶标仪波长、标准品/质控品、样本数量和计算单位。',
    protocolSections: [
      '检测指标、样本类型和方法学确认',
      '样本采集、保存、匀浆/离心/提取前处理',
      '试剂配制、标准品或质控品设置',
      '反应体系、孵育条件、检测波长和读数',
      '单位换算、蛋白校正、重复孔和异常值判断',
    ],
  },
]

function getConfig(type: ExperimentType) {
  return EXPERIMENT_TYPES.find((item) => item.value === type) || EXPERIMENT_TYPES[0]
}

export default function ExperimentPage() {
  const router = useRouter()
  const [experimentType, setExperimentType] = useState<ExperimentType>('elisa')
  const [species, setSpecies] = useState('')
  const [sampleType, setSampleType] = useState('')
  const [target, setTarget] = useState('')
  const [purpose, setPurpose] = useState('')
  const [sampleCount, setSampleCount] = useState('')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ProtocolResult | null>(null)
  const config = getConfig(experimentType)

  const handleGenerate = async () => {
    if (!experimentType || !purpose.trim()) {
      setError('请至少选择实验类型，并填写实验目的或研究问题')
      return
    }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/experiment/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentType,
          species,
          sampleType,
          target,
          purpose,
          sampleCount,
          details,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        throw new Error(data?.detail || data?.error || `服务器返回 ${res.status}`)
      }
      if (data.error) throw new Error(data.detail || data.error)
      if (data.id) {
        router.push(`/lab/experiment/${data.id}`)
      } else if (data.protocolContent) {
        setResult({
          title: data.title,
          protocolContent: data.protocolContent,
          checklist: data.checklist || [],
        })
        setLoading(false)
      } else {
        throw new Error('生成结果为空')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '实验方案生成失败'
      const isApiError = msg.includes('API') || msg.includes('Key') || msg.includes('环境变量')
      setError(isApiError ? `AI 调用失败：${msg}。请检查服务器模型 API Key 与后台 AI 模型设置。` : msg)
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-white via-[#F7FBFF] to-[#EEF6FF] p-5 shadow-sm sm:flex-row sm:items-center sm:gap-5">
        <div className="relative h-28 w-full max-w-[320px] shrink-0 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-lg shadow-blue-900/10 sm:h-32 sm:w-80">
          <Image
            src={EXPERIMENT_AI_ASSISTANT_IMAGE}
            alt="AI 实验方案助手"
            fill
            sizes="(max-width: 640px) 90vw, 320px"
            onError={(event) => {
              event.currentTarget.style.opacity = '0'
            }}
            className="object-cover object-center"
          />
        </div>
        <div>
          <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-700 ring-1 ring-blue-100">
            <Sparkles className="h-3.5 w-3.5" />
            AI Protocol Designer
          </span>
          <h1 className="bg-gradient-to-r from-[#0B1220] via-[#1D4ED8] to-[#06B6D4] bg-clip-text text-3xl font-black tracking-normal text-transparent">
            实验方案生成器
          </h1>
          <p className="mt-2 max-w-2xl text-base font-semibold leading-7 text-[#334155]">
            先明确实验目的，再按实验类型提取关键线索，生成可执行 protocol。
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <label className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Microscope className="h-4 w-4 text-[#177E97]" />
              想做什么实验 <span className="text-red-500">*</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {EXPERIMENT_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setExperimentType(item.value)}
                  className={`min-h-[120px] rounded-lg border p-4 text-left transition-colors ${
                    experimentType === item.value
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="mt-2 block text-xs leading-5 text-gray-500">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">
              实验目的 / 研究问题 <span className="text-red-500">*</span>
            </span>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="例如：想比较处理组和对照组某个指标的变化，希望设计分组、样本处理、关键步骤、质控点和结果判断..."
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          {experimentType === 'elisa' && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#123A63]">
                <Target className="h-4 w-4" />
                ELISA 推荐补充信息
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">样本种属</span>
                  <input
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    placeholder="例如：人、小鼠、大鼠、牛、犬..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">样本类型</span>
                  <input
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value)}
                    placeholder="例如：血清、血浆、细胞上清、组织匀浆..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">检测指标 / 目标蛋白</span>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="例如：IL-6、TNF-alpha、SOD..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">样本数量 / 分组</span>
                  <input
                    value={sampleCount}
                    onChange={(e) => setSampleCount(e.target.value)}
                    placeholder="例如：24 个样本，3 组，每组 8 个"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              </div>
            </div>
          )}

          <label className="mt-4 block">
            <span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <ClipboardList className="h-4 w-4 text-[#177E97]" />
              已知实验信息
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={config.detailsPlaceholder}
              rows={5}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#177E97] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0F667C] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 生成中...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                生成实验方案
              </>
            )}
          </button>
          {error && (
            <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700">
              {error}
            </p>
          )}
          {loading && (
            <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-700">
              AI 正在组织实验方案，复杂 protocol 可能需要几十秒，请不要重复点击。
            </p>
          )}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-[#123A63]" />
            <h2 className="text-base font-bold text-slate-950">{config.cluesTitle}</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            系统会按当前实验类型组织 protocol。信息不完整时，AI 会先给出可执行框架，并在末尾列出需要补充确认的问题。
          </p>
          <div className="mt-5 space-y-3">
            {config.protocolSections.map((section, index) => (
              <div key={section} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#123A63]">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-slate-700">{section}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-600">
            这个入口不是让客户填完整表单，而是让客户用自然语言描述需求。页面只提供线索，AI 根据 protocol 结构追问缺失信息。
          </div>
        </aside>
      </div>

      {result && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
            <h2 className="text-lg font-bold">{result.title}</h2>
          </div>
          <div className="space-y-6 p-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">实验方案</h3>
              <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-5 text-sm leading-relaxed text-gray-700">
                {result.protocolContent}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
