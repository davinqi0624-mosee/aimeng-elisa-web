'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShoppingBag, Award, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ShopItem {
  id: string
  name: string
  image_url: string | null
  points_required: number
  stock: number
  description: string | null
}

export default function StorePage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/shop/items')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))

    fetch('/api/user/points')
      .then((r) => r.json())
      .then((d) => {
        if (d.balance !== undefined) setPoints(d.balance)
      })
      .catch(() => {})
  }, [])

  const handleRedeem = async (item: ShopItem) => {
    if (item.points_required > points) {
      setMessage('积分不足')
      return
    }
    setRedeemingId(item.id)
    setMessage('')
    try {
      const res = await fetch('/api/shop/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPoints(data.remainingPoints)
      setMessage('兑换成功！')
      // 更新库存显示
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, stock: i.stock - 1 } : i))
      )
    } catch (err: any) {
      setMessage(err.message || '兑换失败')
    } finally {
      setRedeemingId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">积分商城</h1>
            <p className="text-xs text-gray-500">使用积分兑换实验耗材与权益</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Award className="w-4 h-4" />
          <span>可用积分: {points}</span>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            message.includes('成功')
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.includes('成功') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>暂无商品</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
              <div className="h-32 bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="w-10 h-10 text-gray-300" />
                )}
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.name}</h3>
                {item.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm font-bold text-amber-600">
                    <Award className="w-4 h-4" />
                    {item.points_required}
                  </div>
                  <div className="text-xs text-gray-400">库存: {item.stock}</div>
                </div>
                <button
                  onClick={() => handleRedeem(item)}
                  disabled={redeemingId === item.id || item.stock <= 0 || item.points_required > points}
                  className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {redeemingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : item.stock <= 0 ? (
                    '已售罄'
                  ) : item.points_required > points ? (
                    '积分不足'
                  ) : (
                    '立即兑换'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
