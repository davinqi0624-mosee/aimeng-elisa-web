'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Award,
  FileText,
  ShoppingBag,
  Trophy,
  Crown,
  Gem,
  Star,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'

interface Paper {
  id: string
  title: string
  status: string
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

const TIERS = [
  { name: 'free', label: '普通会员', min: 0, color: 'bg-gray-400', icon: Star },
  { name: 'silver', label: '银牌会员', min: 500, color: 'bg-gray-400', icon: Award },
  { name: 'gold', label: '金牌会员', min: 2000, color: 'bg-amber-400', icon: Crown },
  { name: 'platinum', label: '铂金会员', min: 5000, color: 'bg-violet-500', icon: Gem },
]

export default function DashboardPage() {
  const [points, setPoints] = useState(0)
  const [tier, setTier] = useState('free')
  const [papers, setPapers] = useState<Paper[]>([])
  const [orders, setOrders] = useState<RedeemOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/user/points').then((r) => r.json()),
      fetch('/api/papers?mine=true&status=all').then((r) => r.json()),
      fetch('/api/shop/redeem').then((r) => r.json().catch(() => ({ orders: [] }))),
    ])
      .then(([ptData, papersData, ordersData]) => {
        if (ptData.balance !== undefined) {
          setPoints(ptData.balance)
          setTier(ptData.tier)
        }
        setPapers(papersData.papers || [])
        setOrders(ordersData.orders || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const currentTierIndex = TIERS.findIndex((t) => t.name === tier)
  const currentTier = TIERS[currentTierIndex] || TIERS[0]
  const nextTier = TIERS[currentTierIndex + 1]
  const progress = nextTier ? Math.min(100, ((points - currentTier.min) / (nextTier.min - currentTier.min)) * 100) : 100

  const TierIcon = currentTier.icon

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
                <div className={`w-10 h-10 rounded-full ${currentTier.color} flex items-center justify-center text-white`}>
                  <TierIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{currentTier.label}</div>
                  <div className="text-xs text-gray-500">当前积分: {points}</div>
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
                  <span>距离 {nextTier.label} 还需 {nextTier.min - points} 积分</span>
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
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/upload"
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
            >
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">上传论文</div>
                <div className="text-xs text-gray-500">审核通过 +100 积分</div>
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

          {/* My Papers */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">我的论文</h2>
              <Link href="/papers" className="text-xs text-blue-600 hover:text-blue-700">
                查看全部
              </Link>
            </div>
            {papers.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">暂无论文</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {papers.slice(0, 5).map((p) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-gray-900 truncate">{p.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.status === 'verified' ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" />
                            已通过 +{p.points_awarded} 积分
                          </span>
                        ) : p.status === 'pending' ? (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-3 h-3" />
                            审核中
                          </span>
                        ) : (
                          <span>已拒绝</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                      <div className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('zh-CN')}</div>
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
