'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Trophy, Medal, Award, ArrowLeft, Loader2 } from 'lucide-react'

interface LeaderboardUser {
  user_id: string
  display_name: string
  points: number
  paper_count: number
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [myRank, setMyRank] = useState(0)

  useEffect(() => {
    fetch('/api/leaderboard?limit=20')
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.leaderboard || [])
        // 尝试找到自己的排名
        fetch('/api/user/points')
          .then((r2) => r2.json())
          .then((me) => {
            if (me.userId) {
              const idx = (d.leaderboard || []).findIndex((u: LeaderboardUser) => u.user_id === me.userId)
              if (idx >= 0) setMyRank(idx + 1)
            }
          })
          .catch(() => {})
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const rankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-500" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Award className="w-5 h-5 text-orange-600" />
    return <span className="w-5 h-5 flex items-center justify-center text-sm text-gray-400 font-medium">{rank}</span>
  }

  return (
    <div className="min-h-full bg-[#F2F6FA]">
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            aimeng.leaderboard / top 20
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950">积分排行榜</h1>
          <p className="text-xs text-slate-500">社区贡献积分 Top 20</p>
        </div>
      </div>

      {myRank > 0 && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
          恭喜！你的当前排名：<span className="font-bold">第 {myRank} 名</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Trophy className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p>暂无排名数据</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 text-xs font-medium text-slate-500 border-b border-slate-200">
            <div className="col-span-2">排名</div>
            <div className="col-span-5">用户</div>
            <div className="col-span-3 text-right">积分</div>
            <div className="col-span-2 text-right">论文</div>
          </div>
          <div className="divide-y divide-slate-100">
            {users.map((u, i) => (
              <div key={u.user_id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-2 flex items-center">{rankIcon(i + 1)}</div>
                <div className="col-span-5 text-sm font-medium text-slate-900 truncate">{u.display_name}</div>
                <div className="col-span-3 text-right text-sm font-semibold text-amber-600">{u.points}</div>
                <div className="col-span-2 text-right text-sm text-slate-500">{u.paper_count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-700">积分规则说明：</p>
        <p>• 上传论文并通过审核：+100 积分</p>
        <p>• 会员等级：Free(0) → Silver(500) → Gold(2000) → Platinum(5000)</p>
      </div>
    </div>
    </div>
  )
}
