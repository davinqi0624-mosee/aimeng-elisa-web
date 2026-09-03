'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  KeyRound,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'

type AgentAudience = 'customer' | 'admin'
type AgentStatus = 'enabled' | 'draft' | 'paused'
type RiskLevel = 'low' | 'medium' | 'high'

interface AiAgentConfig {
  id: string
  name: string
  audience: AgentAudience
  status: AgentStatus
  riskLevel: RiskLevel
  entryPath: string
  description: string
  responsibilities: string
  systemPrompt: string
  tools: string[]
  ragScopes: string[]
  requiresReview: boolean
  owner: string
}

const STORAGE_KEY = 'aimeng-ai-agents-admin-drafts-v1'

const TOOL_OPTIONS = [
  { id: 'product_search', label: '产品检索' },
  { id: 'rag_search', label: '知识库检索' },
  { id: 'datasheet_writer', label: '说明书生成' },
  { id: 'docx_export', label: 'Word/PDF 导出' },
  { id: 'elisa_4pl', label: '4PL 数据分析' },
  { id: 'report_writer', label: '实验报告生成' },
  { id: 'file_parser', label: '文件解析' },
  { id: 'admin_review', label: '管理员审核' },
  { id: 'backup_check', label: '备份状态检查' },
]

const RAG_SCOPE_OPTIONS = [
  { id: 'products', label: '产品库' },
  { id: 'datasheets', label: '说明书' },
  { id: 'knowledge', label: 'ELISA 知识库' },
  { id: 'citations', label: '文献引用' },
  { id: 'conversations', label: '客户问答沉淀' },
  { id: 'internal_qc', label: '内部质检数据' },
]

const DEFAULT_AGENTS: AiAgentConfig[] = [
  {
    id: 'customer_service',
    name: 'AI 客服 Agent',
    audience: 'customer',
    status: 'enabled',
    riskLevel: 'medium',
    entryPath: '/chat',
    description: '售前、售后、技术支持，只从爱萌优宁角度回答客户问题。',
    responsibilities: '回答 ELISA 产品咨询、售后问题、实验常见问题；不得推荐其他品牌；不编造产品参数。',
    systemPrompt: '你是 AIMENG UNING 爱萌优宁的专业客服，只能推荐和解释爱萌优宁产品，回答必须真实、克制、可追溯。',
    tools: ['product_search', 'rag_search'],
    ragScopes: ['products', 'datasheets', 'knowledge'],
    requiresReview: false,
    owner: '客服/技术支持',
  },
  {
    id: 'product_recommender',
    name: '产品推荐 Agent',
    audience: 'customer',
    status: 'draft',
    riskLevel: 'medium',
    entryPath: '/products/elisa',
    description: '根据指标、种属、样本类型、检测范围推荐合适的 ELISA 试剂盒或血清产品。',
    responsibilities: '解析客户需求，匹配爱萌优宁产品；产品参数必须来自产品库；无法确认时提示联系客服。',
    systemPrompt: '你是爱萌优宁产品推荐助手，必须基于产品库和说明书资料推荐产品，不得补造货号、价格、灵敏度或检测范围。',
    tools: ['product_search', 'rag_search'],
    ragScopes: ['products', 'datasheets'],
    requiresReview: false,
    owner: '产品/销售',
  },
  {
    id: 'protocol_designer',
    name: '实验方案 Agent',
    audience: 'customer',
    status: 'enabled',
    riskLevel: 'medium',
    entryPath: '/lab/experiment',
    description: '根据客户实验目的生成 ELISA 实验方案、样本处理建议和孔板布局。',
    responsibilities: '生成实验流程、样本处理、复孔建议、孔板布局；对不确定条件给出预实验建议。',
    systemPrompt: '你是 ELISA 实验方案设计专家，方案必须符合爱萌优宁说明书和常规 ELISA 实验规范。',
    tools: ['rag_search', 'product_search'],
    ragScopes: ['datasheets', 'knowledge', 'products'],
    requiresReview: false,
    owner: '技术支持',
  },
  {
    id: 'elisa_analysis',
    name: '数据分析 Agent',
    audience: 'customer',
    status: 'enabled',
    riskLevel: 'high',
    entryPath: '/lab/analysis',
    description: '分析 OD 值、4PL 标准曲线、样本浓度，并生成实验报告。',
    responsibilities: '读取上传数据，执行 4PL 拟合，生成标准曲线和报告；异常数据必须提示客户复核。',
    systemPrompt: '你是 ELISA 数据分析助手，必须基于用户上传数据和确定算法计算，不得改写原始数据或夸大结论。',
    tools: ['elisa_4pl', 'report_writer', 'file_parser'],
    ragScopes: ['knowledge', 'datasheets'],
    requiresReview: false,
    owner: '数据分析',
  },
  {
    id: 'datasheet_generator',
    name: '说明书生成 Agent',
    audience: 'admin',
    status: 'draft',
    riskLevel: 'high',
    entryPath: '/admin/datasheet',
    description: '根据货号、指标、种属、性能参数和 Word 模板生成说明书草稿。',
    responsibilities: '生成说明书草稿；检测范围、灵敏度、标准曲线浓度必须来自内部产品数据；发布前必须审核。',
    systemPrompt: '你是爱萌优宁说明书文档工程师，只能使用后台确认的数据生成说明书，禁止编造性能参数。',
    tools: ['datasheet_writer', 'docx_export', 'rag_search', 'admin_review'],
    ragScopes: ['products', 'datasheets', 'knowledge', 'internal_qc'],
    requiresReview: true,
    owner: '产品/质量/管理员',
  },
  {
    id: 'knowledge_maintainer',
    name: '知识库维护 Agent',
    audience: 'admin',
    status: 'draft',
    riskLevel: 'high',
    entryPath: '/admin/knowledge/generate',
    description: '整理说明书、文献、客户问答和实验问题，维护 RAG 知识库。',
    responsibilities: '抽取可靠知识、记录来源、标记冲突和过期内容；新增知识必须可追溯。',
    systemPrompt: '你是爱萌优宁知识库管理员，所有知识必须保留来源、时间和审核状态，不确定内容不能进入正式知识库。',
    tools: ['rag_search', 'file_parser', 'admin_review', 'backup_check'],
    ragScopes: ['products', 'datasheets', 'knowledge', 'citations', 'conversations'],
    requiresReview: true,
    owner: '管理员/知识库',
  },
]

const EMPTY_AGENT: AiAgentConfig = {
  id: '',
  name: '',
  audience: 'admin',
  status: 'draft',
  riskLevel: 'medium',
  entryPath: '/admin',
  description: '',
  responsibilities: '',
  systemPrompt: '',
  tools: [],
  ragScopes: [],
  requiresReview: true,
  owner: '',
}

function uniqueAgents(agents: AiAgentConfig[]) {
  const seen = new Set<string>()
  return agents.filter((agent) => {
    if (!agent.id || seen.has(agent.id)) return false
    seen.add(agent.id)
    return true
  })
}

export default function AdminAiAgentsPage() {
  const [agents, setAgents] = useState<AiAgentConfig[]>(DEFAULT_AGENTS)
  const [editing, setEditing] = useState<AiAgentConfig | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [savedAt, setSavedAt] = useState('')

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 挂载后从浏览器 localStorage 恢复管理员草稿配置。
        setAgents(uniqueAgents(parsed))
      }
    } catch {
      setAgents(DEFAULT_AGENTS)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))
  }, [agents])

  const stats = useMemo(() => {
    return {
      total: agents.length,
      enabled: agents.filter((agent) => agent.status === 'enabled').length,
      review: agents.filter((agent) => agent.requiresReview).length,
      customer: agents.filter((agent) => agent.audience === 'customer').length,
    }
  }, [agents])

  const openCreate = () => {
    setEditing({ ...EMPTY_AGENT })
    setShowForm(true)
  }

  const openEdit = (agent: AiAgentConfig) => {
    setEditing({ ...agent })
    setShowForm(true)
  }

  const saveAgent = () => {
    if (!editing?.id.trim() || !editing.name.trim()) {
      alert('请填写 Agent ID 和名称')
      return
    }

    const nextAgent = {
      ...editing,
      id: editing.id.trim().replace(/\s+/g, '_').toLowerCase(),
      name: editing.name.trim(),
    }

    setAgents((prev) => {
      const exists = prev.some((agent) => agent.id === nextAgent.id)
      return exists
        ? prev.map((agent) => (agent.id === nextAgent.id ? nextAgent : agent))
        : [...prev, nextAgent]
    })
    setSavedAt(new Date().toLocaleString('zh-CN'))
    setShowForm(false)
    setEditing(null)
  }

  const duplicateAgent = (agent: AiAgentConfig) => {
    const copied = {
      ...agent,
      id: `${agent.id}_copy`,
      name: `${agent.name} 副本`,
      status: 'draft' as AgentStatus,
    }
    setAgents((prev) => [...prev, copied])
  }

  const deleteAgent = (id: string) => {
    if (!confirm('确定删除这个 Agent 草稿吗？')) return
    setAgents((prev) => prev.filter((agent) => agent.id !== id))
  }

  const resetDefaults = () => {
    if (!confirm('确定恢复默认 6 个 Agent 配置吗？当前浏览器草稿会被覆盖。')) return
    setAgents(DEFAULT_AGENTS)
    setSavedAt(new Date().toLocaleString('zh-CN'))
  }

  const toggleArrayValue = (field: 'tools' | 'ragScopes', value: string) => {
    if (!editing) return
    setEditing({
      ...editing,
      [field]: editing[field].includes(value)
        ? editing[field].filter((item) => item !== value)
        : [...editing[field], value],
    })
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Agent 中台</h1>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            管理网站里的 AI 工作岗位：在哪里出现、能调用什么工具、能读哪些知识库、是否需要审核。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={resetDefaults}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900"
          >
            <RotateCcw className="h-4 w-4" />
            恢复默认
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            <Plus className="h-4 w-4" />
            新增 Agent
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Agent 总数', value: stats.total, icon: <Bot className="h-4 w-4 text-cyan-300" /> },
          { label: '已启用', value: stats.enabled, icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" /> },
          { label: '需审核', value: stats.review, icon: <ShieldCheck className="h-4 w-4 text-amber-300" /> },
          { label: '客户可见', value: stats.customer, icon: <Sparkles className="h-4 w-4 text-blue-300" /> },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{item.label}</span>
              {item.icon}
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-100">当前版本说明</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/80">
              这里已经是后台新增 Agent 的可视化入口。当前配置先保存为本机浏览器草稿，方便确定“在哪里加、怎么加、加什么、怎么设置”。
              后续接入数据库后，会把这些字段保存到 `agents` 表，并支持全站生效、版本记录和管理员审核。
            </p>
            {savedAt && <p className="mt-2 text-xs text-amber-100/70">最近保存：{savedAt}</p>}
          </div>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Plus className="h-4 w-4 text-cyan-300" />
            怎么加？
          </div>
          <ol className="mt-4 space-y-2 text-sm text-slate-400">
            <li>1. 点击右上角“新增 Agent”。</li>
            <li>2. 填写 ID、名称、出现入口和职责。</li>
            <li>3. 勾选可调用工具和知识库范围。</li>
            <li>4. 设置客户可见或后台可见。</li>
            <li>5. 高风险 Agent 必须开启管理员审核。</li>
          </ol>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Wrench className="h-4 w-4 text-cyan-300" />
            加什么？
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            适合新增的 Agent 包括：文献解析、COA 导入、产品数据清洗、客户运营推送、网站巡检、备份恢复。
            不建议把同一职责拆得太碎。
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <KeyRound className="h-4 w-4 text-cyan-300" />
            怎么设置？
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            前台 Agent 权限要小，主要读产品库和知识库；后台 Agent 可以调用生成、导入、审核工具；
            涉及发布、积分、备份恢复的操作必须走管理员确认。
          </p>
        </div>
      </section>

      <section className="grid gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{agent.name}</h2>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-mono text-slate-300">{agent.id}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    agent.status === 'enabled'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : agent.status === 'paused'
                        ? 'bg-orange-500/10 text-orange-300'
                        : 'bg-slate-700 text-slate-300'
                  }`}>
                    {agent.status === 'enabled' ? '已启用' : agent.status === 'paused' ? '已暂停' : '草稿'}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    agent.riskLevel === 'high'
                      ? 'bg-red-500/10 text-red-300'
                      : agent.riskLevel === 'medium'
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-blue-500/10 text-blue-300'
                  }`}>
                    {agent.riskLevel === 'high' ? '高风险' : agent.riskLevel === 'medium' ? '中风险' : '低风险'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{agent.description}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => duplicateAgent(agent)}
                  className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                  title="复制"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openEdit(agent)}
                  className="rounded-lg border border-cyan-500/30 px-3 py-2 text-sm text-cyan-300 hover:bg-cyan-500/10"
                >
                  设置
                </button>
                <button
                  onClick={() => deleteAgent(agent.id)}
                  className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-950 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                  出现位置
                </div>
                <p className="mt-2 text-sm text-slate-400">{agent.audience === 'customer' ? '客户前台' : '管理后台'}</p>
                <p className="mt-1 font-mono text-xs text-cyan-300">{agent.entryPath}</p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Wrench className="h-3.5 w-3.5 text-cyan-300" />
                  可调用工具
                </div>
                <p className="mt-2 text-sm text-slate-400">{agent.tools.length || 0} 个工具</p>
                <p className="mt-1 text-xs text-slate-500">{agent.tools.join('、') || '未设置'}</p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Database className="h-3.5 w-3.5 text-emerald-300" />
                  知识库范围
                </div>
                <p className="mt-2 text-sm text-slate-400">{agent.ragScopes.length || 0} 个范围</p>
                <p className="mt-1 text-xs text-slate-500">{agent.ragScopes.join('、') || '未设置'}</p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
                  审核要求
                </div>
                <p className="mt-2 text-sm text-slate-400">{agent.requiresReview ? '需要管理员审核' : '可直接回复/执行'}</p>
                <p className="mt-1 text-xs text-slate-500">负责人：{agent.owner || '未设置'}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      {showForm && editing && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-3 sm:items-center sm:p-4">
          <div className="flex h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl sm:h-[calc(100dvh-2rem)]">
            <div className="shrink-0 border-b border-slate-800 bg-slate-950 px-5 py-4">
              <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{editing.id ? '设置 Agent' : '新增 Agent'}</h2>
                <p className="text-xs text-slate-400">填写后会保存为后台草稿配置。</p>
              </div>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-900">
                <X className="h-5 w-5" />
              </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [-webkit-overflow-scrolling:touch]">
              <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-300">Agent ID</span>
                    <input
                      value={editing.id}
                      onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                      placeholder="citation_checker"
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-300">名称</span>
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="文献解析 Agent"
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-300">面向对象</span>
                    <select
                      value={editing.audience}
                      onChange={(e) => setEditing({ ...editing, audience: e.target.value as AgentAudience })}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-400"
                    >
                      <option value="customer">客户前台</option>
                      <option value="admin">管理后台</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-300">状态</span>
                    <select
                      value={editing.status}
                      onChange={(e) => setEditing({ ...editing, status: e.target.value as AgentStatus })}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-400"
                    >
                      <option value="draft">草稿</option>
                      <option value="enabled">启用</option>
                      <option value="paused">暂停</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-300">风险级别</span>
                    <select
                      value={editing.riskLevel}
                      onChange={(e) => setEditing({ ...editing, riskLevel: e.target.value as RiskLevel })}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-400"
                    >
                      <option value="low">低风险</option>
                      <option value="medium">中风险</option>
                      <option value="high">高风险</option>
                    </select>
                  </label>
                </div>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-300">入口路径</span>
                  <input
                    value={editing.entryPath}
                    onChange={(e) => setEditing({ ...editing, entryPath: e.target.value })}
                    placeholder="/admin/citations"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-400"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-300">一句话说明</span>
                  <textarea
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    rows={3}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-300">职责边界</span>
                  <textarea
                    value={editing.responsibilities}
                    onChange={(e) => setEditing({ ...editing, responsibilities: e.target.value })}
                    rows={4}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-300">系统提示词</span>
                  <textarea
                    value={editing.systemPrompt}
                    onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
                    rows={6}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                  />
                </label>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                    <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
                    可调用工具
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TOOL_OPTIONS.map((tool) => (
                      <label key={tool.id} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={editing.tools.includes(tool.id)}
                          onChange={() => toggleArrayValue('tools', tool.id)}
                        />
                        {tool.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                    <Database className="h-4 w-4 text-emerald-300" />
                    知识库范围
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {RAG_SCOPE_OPTIONS.map((scope) => (
                      <label key={scope.id} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={editing.ragScopes.includes(scope.id)}
                          onChange={() => toggleArrayValue('ragScopes', scope.id)}
                        />
                        {scope.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-300">负责人</span>
                    <input
                      value={editing.owner}
                      onChange={(e) => setEditing({ ...editing, owner: e.target.value })}
                      placeholder="管理员/产品/技术支持"
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={editing.requiresReview}
                      onChange={(e) => setEditing({ ...editing, requiresReview: e.target.checked })}
                    />
                    需要管理员审核
                  </label>
                </div>
              </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-950 px-5 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                取消
              </button>
              <button
                onClick={saveAgent}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                <Save className="h-4 w-4" />
                保存 Agent
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <FileText className="h-4 w-4 text-cyan-300" />
          后期接数据库时需要的表字段
        </div>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-400">
{`agents:
  id, name, audience, status, risk_level, entry_path
  description, responsibilities, system_prompt
  tools[], rag_scopes[], requires_review, owner
  created_by, updated_by, created_at, updated_at

agent_runs:
  id, agent_id, user_id/admin_id, input, output, status
  tool_calls, sources, review_status, created_at`}
        </pre>
      </div>
    </div>
  )
}
