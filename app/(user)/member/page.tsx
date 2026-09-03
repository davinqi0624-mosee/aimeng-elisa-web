'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  FileText,
  ShoppingBag,
  Trophy,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Clock,
  Plus,
  Ticket,
} from 'lucide-react'

interface Paper {
  id: string
  title: string
  upload_status: string
  points_awarded: number
  created_at: string
}

interface RedeemOrder {
  id: string
  item_name: string
  points_spent: number
  status: string
  created_at: string
}

const REDEEM_STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: '待审核', className: 'bg-amber-50 text-amber-700' },
  approved: { label: '已审核待发货', className: 'bg-blue-50 text-blue-700' },
  fulfilled: { label: '已完成/已发货', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: '已取消', className: 'bg-gray-50 text-gray-600' },
}

const TIERS = [
  { name: 'bronze', label: '青铜会员', min: 0, color: 'bg-orange-500', image: '/brand/member-tiers/bronze.png', discount: '原价兑换' },
  { name: 'silver', label: '白银会员', min: 3500, color: 'bg-slate-400', image: '/brand/member-tiers/silver.png', discount: '商城兑换95折' },
  { name: 'gold', label: '黄金会员', min: 8000, color: 'bg-amber-400', image: '/brand/member-tiers/gold.png', discount: '商城兑换9折' },
  { name: 'platinum', label: '铂金会员', min: 15000, color: 'bg-blue-700', image: '/brand/member-tiers/platinum.png', discount: '商城兑换88折' },
]

function MemberTierIcon({ src, label, size = 'md' }: { src: string; label: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14'

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${sizeClass}`}>
      <Image
        src={src}
        alt={`${label}图标`}
        fill
        sizes={size === 'sm' ? '40px' : '56px'}
        className="object-cover"
      />
    </div>
  )
}

export default function DashboardPage() {
  const [points, setPoints] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [tier, setTier] = useState('bronze')
  const [papers, setPapers] = useState<Paper[]>([])
  const [orders, setOrders] = useState<RedeemOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/user/points').then((r) => r.json()),
      fetch('/api/user/citations').then((r) => r.json()),
      fetch('/api/shop/redeem').then((r) => r.json().catch(() => ({ orders: [] }))),
    ])
      .then(([ptData, papersData, ordersData]) => {
        if (ptData.balance !== undefined) {
          setPoints(ptData.balance)
          setTotalPoints(ptData.totalPoints || 0)
          setTier(ptData.tier || 'bronze')
        }
        setPapers(papersData.papers || [])
        setOrders(ordersData.orders || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const currentTierIndex = Math.max(0, TIERS.findIndex((t) => t.name === tier))
  const currentTier = TIERS[currentTierIndex] || TIERS[0]
  const nextTier = TIERS[currentTierIndex + 1]
  const progress = nextTier ? Math.min(100, ((totalPoints - currentTier.min) / (nextTier.min - currentTier.min)) * 100) : 100
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">会员中心</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Points & Tier Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <MemberTierIcon src={currentTier.image} label={currentTier.label} />
                <div>
                  <div className="text-sm font-semibold text-gray-900">{currentTier.label}</div>
                  <div className="text-xs text-gray-500">{currentTier.discount}</div>
                </div>
              </div>
              <Link
                href="/leaderboard"
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Trophy className="w-4 h-4" />
                排行榜
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {nextTier && (
              <div>
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>累计积分距离 {nextTier.label} 还需 {nextTier.min - totalPoints} 积分</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${currentTier.color} transition-all`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            {!nextTier && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                已达到最高会员等级，积分商城兑换享受88折。
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-xs text-slate-500">可用积分</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{points}</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="text-xs text-slate-500">累计积分</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{totalPoints}</div>
              </div>
            </div>
            <div className="mt-3 text-xs leading-5 text-gray-500">
              会员等级按累计获得积分计算，兑换商品只扣可用积分，不会降低会员等级。
            </div>
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">
              <div className="font-semibold">日常积分奖励</div>
              <div className="mt-1">每日首次登录签到 +1 积分；完成一次有效 4PL 分析且包含检测样本，每日首次奖励 +2 积分。同一天重复计算不重复奖励，但不影响继续使用分析功能。</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIERS.map((tierItem) => {
              const active = tierItem.name === currentTier.name
              return (
                <div
                  key={tierItem.name}
                  className={`rounded-xl border p-3 ${active ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="mb-2">
                    <MemberTierIcon src={tierItem.image} label={tierItem.label} size="sm" />
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{tierItem.label}</div>
                  <div className="mt-1 text-xs text-gray-500">累计 {tierItem.min}+ 积分</div>
                  <div className="mt-1 text-xs font-medium text-blue-700">{tierItem.discount}</div>
                </div>
              )
            })}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/member/purchase-points"
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
            >
              <Ticket className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">购买积分</div>
                <div className="text-xs text-gray-500">积分码 + 商品照片审核</div>
              </div>
            </Link>
            <Link
              href="/user/citations/submit"
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
            >
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">提交文献</div>
                <div className="text-xs text-gray-500">审核通过最高 +1500 积分</div>
              </div>
            </Link>
            <Link
              href="/store"
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
            >
              <ShoppingBag className="w-5 h-5 text-violet-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">积分商城</div>
                <div className="text-xs text-gray-500">兑换实验耗材</div>
              </div>
            </Link>
          </div>

          {/* My Citations */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">我的文献</h2>
              <Link href="/user/citations" className="text-xs text-blue-600 hover:text-blue-700">
                查看全部
              </Link>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{papers.length}</div>
                  <div className="text-xs text-gray-500">已提交</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-700">
                    {papers.filter((p) => p.upload_status === 'verified').length}
                  </div>
                  <div className="text-xs text-green-600">已通过</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-amber-700">
                    {papers.filter((p) => p.upload_status === 'pending').length}
                  </div>
                  <div className="text-xs text-amber-600">审核中</div>
                </div>
              </div>
              <Link
                href="/user/citations/submit"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                提交新文献
              </Link>
              {papers.length > 0 && (
                <div className="mt-3 divide-y divide-gray-100">
                  {papers.slice(0, 3).map((p) => (
                    <div key={p.id} className="py-2 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-900 truncate">{p.title}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {p.upload_status === 'verified' ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              已通过 +{p.points_awarded} 积分
                            </span>
                          ) : p.upload_status === 'pending' ? (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Clock className="w-3 h-3" />
                              审核中
                            </span>
                          ) : (
                            <span className="text-red-600">已拒绝</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Redeem History */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">兑换记录</h2>
            </div>
            {orders.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">暂无兑换记录</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {orders.slice(0, 5).map((o) => (
                  <div key={o.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900">{o.item_name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <span>{new Date(o.created_at).toLocaleDateString('zh-CN')}</span>
                        <span className={`rounded px-1.5 py-0.5 ${REDEEM_STATUS_MAP[o.status]?.className || 'bg-gray-50 text-gray-600'}`}>
                          {REDEEM_STATUS_MAP[o.status]?.label || o.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-amber-600">-{o.points_spent}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
