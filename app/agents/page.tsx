'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  User,
  X,
} from 'lucide-react'
import ChinaAgentMap from '@/components/map/ChinaAgentMap'

interface Agent {
  id?: string
  province: string
  province_code?: string
  city?: string
  company_name: string
  contact_name?: string
  phone?: string
  email?: string
  wechat_qr?: string
  address?: string
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [agentError, setAgentError] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([])

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => {
        if (!r.ok) throw new Error('代理商数据加载失败')
        return r.json()
      })
      .then((d) => {
        setAgents(d.agents || [])
        setAgentError('')
        setLoading(false)
      })
      .catch(() => {
        setAgentError('代理商数据暂时无法加载，请稍后刷新或联系官方客服。')
        setLoading(false)
      })
  }, [])

  const handleProvinceClick = (province: string, matched: Agent[]) => {
    setSelectedProvince(province)
    setSelectedAgents(matched)
  }

  const closeModal = () => {
    setSelectedProvince(null)
    setSelectedAgents([])
  }

  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
        <div className="mb-10">
          <p className="text-sm font-semibold text-blue-600">全国服务网络</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">
            全国代理商
          </h1>
          <p className="mt-2 text-slate-500">
            查看各地区代理商联系方式；官方客服信息请进入“联系我们”页面。
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.42fr_0.58fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">代理商列表</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    按省份选择当地服务商
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {agents.length} 家
                </span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : agentError ? (
                <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
                  {agentError}
                </p>
              ) : agents.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">
                  暂无代理商数据
                </p>
              ) : (
                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {agents.map((agent) => (
                    <button
                      type="button"
                      key={agent.id || `${agent.province}-${agent.company_name}`}
                      onClick={() => handleProvinceClick(agent.province, [agent])}
                      className="w-full rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-blue-100 hover:bg-blue-50/60"
                    >
                      <div className="flex items-start gap-3">
                        <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">
                            {agent.province}
                            {agent.city ? ` · ${agent.city}` : ''}
                          </p>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {agent.company_name}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-[520px] md:h-[640px]">
              <ChinaAgentMap
                agents={agents}
                onProvinceClick={handleProvinceClick}
              />
            </div>
          </section>
        </div>
      </main>

      {selectedProvince && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                {selectedProvince} 代理商
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="关闭代理商详情"
                className="p-1 text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {selectedAgents.map((agent, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-slate-900">
                      {agent.company_name}
                    </span>
                  </div>

                  {agent.contact_name && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="h-4 w-4 text-slate-400" />
                      <span>联系人：{agent.contact_name}</span>
                    </div>
                  )}

                  {agent.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span>{agent.phone}</span>
                    </div>
                  )}

                  {agent.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span>{agent.email}</span>
                    </div>
                  )}

                  {agent.address && (
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span>{agent.address}</span>
                    </div>
                  )}

                  {agent.wechat_qr && (
                    <div className="flex flex-col items-center pt-2">
                      <img
                        src={agent.wechat_qr}
                        alt={`${agent.company_name} 微信二维码`}
                        className="h-32 w-32 rounded-lg border border-slate-200 object-contain"
                        onError={(e) => {
                          const img = e.currentTarget
                          img.style.opacity = '0.3'
                          img.alt = '二维码加载失败'
                        }}
                      />
                      <p className="mt-1 text-xs text-slate-500">微信扫码联系</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
