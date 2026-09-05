'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Checkbox, Input, Modal, Popconfirm, Select, Space, Tag } from 'antd'
import {
  CheckCircleOutlined,
  ControlOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  KeyOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  StarOutlined,
  ToolOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

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

function getStatusTag(status: AgentStatus) {
  if (status === 'enabled') return <Tag color="green">已启用</Tag>
  if (status === 'paused') return <Tag color="gold">已暂停</Tag>
  return <Tag>草稿</Tag>
}

function getRiskTag(level: RiskLevel) {
  if (level === 'high') return <Tag color="volcano">高风险</Tag>
  if (level === 'medium') return <Tag color="gold">中风险</Tag>
  return <Tag color="blue">低风险</Tag>
}

export default function AdminAiAgentsPage() {
  const { message } = App.useApp()
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
      message.error('请填写 Agent ID 和名称')
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
    setAgents((prev) => prev.filter((agent) => agent.id !== id))
  }

  const resetDefaults = () => {
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
    <div>
      <PageHeader
        icon={<RobotOutlined />}
        title="Agent 中台"
        description="管理网站里的 AI 工作岗位：在哪里出现、能调用什么工具、能读哪些知识库、是否需要审核。"
        extra={
          <>
            <Popconfirm
              title="确定恢复默认 6 个 Agent 配置吗？"
              description="当前浏览器草稿会被覆盖。"
              onConfirm={resetDefaults}
            >
              <Button icon={<UndoOutlined />}>恢复默认</Button>
            </Popconfirm>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增 Agent
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Agent 总数', value: stats.total, icon: <RobotOutlined className="text-cyan-600" /> },
          { label: '已启用', value: stats.enabled, icon: <CheckCircleOutlined className="text-emerald-600" /> },
          { label: '需审核', value: stats.review, icon: <SafetyCertificateOutlined className="text-amber-500" /> },
          { label: '客户可见', value: stats.customer, icon: <StarOutlined className="text-blue-600" /> },
        ].map((item) => (
          <Card key={item.label} size="small">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{item.label}</span>
              {item.icon}
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <Alert
        className="mt-4"
        type="warning"
        showIcon
        message="当前版本说明"
        description={
          <>
            <p>
              这里已经是后台新增 Agent 的可视化入口。当前配置先保存为本机浏览器草稿，方便确定“在哪里加、怎么加、加什么、怎么设置”。
              后续接入数据库后，会把这些字段保存到 `agents` 表，并支持全站生效、版本记录和管理员审核。
            </p>
            {savedAt && <p className="mt-2">最近保存：{savedAt}</p>}
          </>
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card size="small" title={<Space><PlusOutlined className="text-cyan-600" />怎么加？</Space>}>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-500">
            <li>点击右上角“新增 Agent”。</li>
            <li>填写 ID、名称、出现入口和职责。</li>
            <li>勾选可调用工具和知识库范围。</li>
            <li>设置客户可见或后台可见。</li>
            <li>高风险 Agent 必须开启管理员审核。</li>
          </ol>
        </Card>
        <Card size="small" title={<Space><ToolOutlined className="text-cyan-600" />加什么？</Space>}>
          <p className="text-sm leading-6 text-slate-500">
            适合新增的 Agent 包括：文献解析、COA 导入、产品数据清洗、客户运营推送、网站巡检、备份恢复。
            不建议把同一职责拆得太碎。
          </p>
        </Card>
        <Card size="small" title={<Space><KeyOutlined className="text-cyan-600" />怎么设置？</Space>}>
          <p className="text-sm leading-6 text-slate-500">
            前台 Agent 权限要小，主要读产品库和知识库；后台 Agent 可以调用生成、导入、审核工具；
            涉及发布、积分、备份恢复的操作必须走管理员确认。
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4">
        {agents.map((agent) => (
          <Card
            key={agent.id}
            title={
              <Space wrap size={[8, 8]}>
                <span className="text-base font-bold text-slate-900">{agent.name}</span>
                <Tag className="font-mono">{agent.id}</Tag>
                {getStatusTag(agent.status)}
                {getRiskTag(agent.riskLevel)}
              </Space>
            }
            extra={
              <Space>
                <Button icon={<CopyOutlined />} title="复制" onClick={() => duplicateAgent(agent)} />
                <Button onClick={() => openEdit(agent)}>设置</Button>
                <Popconfirm title="确定删除这个 Agent 草稿吗？" onConfirm={() => deleteAgent(agent.id)}>
                  <Button danger icon={<DeleteOutlined />} title="删除" />
                </Popconfirm>
              </Space>
            }
          >
            <p className="text-sm leading-6 text-slate-500">{agent.description}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <StarOutlined className="text-blue-500" />
                  出现位置
                </div>
                <p className="mt-2 text-sm text-slate-600">{agent.audience === 'customer' ? '客户前台' : '管理后台'}</p>
                <p className="mt-1 font-mono text-xs text-cyan-700">{agent.entryPath}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <ToolOutlined className="text-cyan-600" />
                  可调用工具
                </div>
                <p className="mt-2 text-sm text-slate-600">{agent.tools.length || 0} 个工具</p>
                <p className="mt-1 text-xs text-slate-400">{agent.tools.join('、') || '未设置'}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <DatabaseOutlined className="text-emerald-600" />
                  知识库范围
                </div>
                <p className="mt-2 text-sm text-slate-600">{agent.ragScopes.length || 0} 个范围</p>
                <p className="mt-1 text-xs text-slate-400">{agent.ragScopes.join('、') || '未设置'}</p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <SafetyCertificateOutlined className="text-amber-500" />
                  审核要求
                </div>
                <p className="mt-2 text-sm text-slate-600">{agent.requiresReview ? '需要管理员审核' : '可直接回复/执行'}</p>
                <p className="mt-1 text-xs text-slate-400">负责人：{agent.owner || '未设置'}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          open={showForm}
          onCancel={() => setShowForm(false)}
          width={1000}
          title={
            <div>
              <div>{editing.id ? '设置 Agent' : '新增 Agent'}</div>
              <div className="text-xs font-normal text-slate-500">填写后会保存为后台草稿配置。</div>
            </div>
          }
          footer={[
            <Button key="cancel" onClick={() => setShowForm(false)}>
              取消
            </Button>,
            <Button key="save" type="primary" icon={<SaveOutlined />} onClick={saveAgent}>
              保存 Agent
            </Button>,
          ]}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-600">Agent ID</span>
                  <Input
                    value={editing.id}
                    onChange={(e) => setEditing({ ...editing, id: e.target.value })}
                    placeholder="citation_checker"
                  />
                </div>
                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-600">名称</span>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="文献解析 Agent"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-600">面向对象</span>
                  <Select<AgentAudience>
                    className="w-full"
                    value={editing.audience}
                    onChange={(value) => setEditing({ ...editing, audience: value })}
                    options={[
                      { value: 'customer', label: '客户前台' },
                      { value: 'admin', label: '管理后台' },
                    ]}
                  />
                </div>
                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-600">状态</span>
                  <Select<AgentStatus>
                    className="w-full"
                    value={editing.status}
                    onChange={(value) => setEditing({ ...editing, status: value })}
                    options={[
                      { value: 'draft', label: '草稿' },
                      { value: 'enabled', label: '启用' },
                      { value: 'paused', label: '暂停' },
                    ]}
                  />
                </div>
                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-600">风险级别</span>
                  <Select<RiskLevel>
                    className="w-full"
                    value={editing.riskLevel}
                    onChange={(value) => setEditing({ ...editing, riskLevel: value })}
                    options={[
                      { value: 'low', label: '低风险' },
                      { value: 'medium', label: '中风险' },
                      { value: 'high', label: '高风险' },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">入口路径</span>
                <Input
                  value={editing.entryPath}
                  onChange={(e) => setEditing({ ...editing, entryPath: e.target.value })}
                  placeholder="/admin/citations"
                />
              </div>

              <div className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">一句话说明</span>
                <Input.TextArea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">职责边界</span>
                <Input.TextArea
                  value={editing.responsibilities}
                  onChange={(e) => setEditing({ ...editing, responsibilities: e.target.value })}
                  rows={4}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">系统提示词</span>
                <Input.TextArea
                  value={editing.systemPrompt}
                  onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })}
                  rows={6}
                />
              </div>

              <Card size="small" title={<Space><ControlOutlined className="text-cyan-600" />可调用工具</Space>}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TOOL_OPTIONS.map((tool) => (
                    <Checkbox
                      key={tool.id}
                      checked={editing.tools.includes(tool.id)}
                      onChange={() => toggleArrayValue('tools', tool.id)}
                    >
                      {tool.label}
                    </Checkbox>
                  ))}
                </div>
              </Card>

              <Card size="small" title={<Space><DatabaseOutlined className="text-emerald-600" />知识库范围</Space>}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {RAG_SCOPE_OPTIONS.map((scope) => (
                    <Checkbox
                      key={scope.id}
                      checked={editing.ragScopes.includes(scope.id)}
                      onChange={() => toggleArrayValue('ragScopes', scope.id)}
                    >
                      {scope.label}
                    </Checkbox>
                  ))}
                </div>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-600">负责人</span>
                  <Input
                    value={editing.owner}
                    onChange={(e) => setEditing({ ...editing, owner: e.target.value })}
                    placeholder="管理员/产品/技术支持"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <Checkbox
                    checked={editing.requiresReview}
                    onChange={(e) => setEditing({ ...editing, requiresReview: e.target.checked })}
                  >
                    需要管理员审核
                  </Checkbox>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <Card
        className="mt-4"
        size="small"
        title={<Space><FileTextOutlined className="text-cyan-600" />后期接数据库时需要的表字段</Space>}
      >
        <pre className="overflow-x-auto rounded-md bg-slate-50 p-4 text-xs leading-6 text-slate-500">
{`agents:
  id, name, audience, status, risk_level, entry_path
  description, responsibilities, system_prompt
  tools[], rag_scopes[], requires_review, owner
  created_by, updated_by, created_at, updated_at

agent_runs:
  id, agent_id, user_id/admin_id, input, output, status
  tool_calls, sources, review_status, created_at`}
        </pre>
      </Card>
    </div>
  )
}
