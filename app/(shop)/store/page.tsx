'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image, { type ImageLoaderProps } from 'next/image'
import { ShoppingBag, Award, ArrowLeft, Loader2, CheckCircle2, AlertCircle, ImageOff, X, Mail, ZoomIn, Filter, ArrowDownUp } from 'lucide-react'
import { getDiscountedPointCost } from '@/lib/points/ledger'
import { SHOP_REDEMPTION_NOTICE } from '@/lib/shop/constants'
import { SHOP_CATEGORIES, getShopCategoryLabel, type ShopCategory } from '@/lib/shop/categories'

interface ShopItem {
  id: string
  name: string
  image_url: string | null
  points_required: number
  stock: number
  description: string | null
  category: ShopCategory | null
}

interface RedeemForm {
  contactName: string
  contactPhone: string
  contactEmail: string
  shippingAddress: string
  shippingNote: string
}

type PointSort = 'default' | 'asc' | 'desc'

const EMPTY_REDEEM_FORM: RedeemForm = {
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  shippingAddress: '',
  shippingNote: '',
}

const DEFAULT_MEMBER_INFO = {
  totalPoints: 0,
  tierLabel: '青铜会员',
  discountLabel: '无折扣',
  discountRate: 1,
}

function mailtoHref(email: string, subject: string, body = '') {
  const params = new URLSearchParams({ subject })
  if (body) params.set('body', body)
  return `mailto:${email}?${params.toString()}`
}

function buildStoreImageUrl(src: string, width: number, quality: number) {
  try {
    const url = new URL(src)
    if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/')) {
      url.pathname = url.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
      url.searchParams.set('width', String(width))
      url.searchParams.set('quality', String(quality))
      url.searchParams.set('resize', 'contain')
      return url.toString()
    }
  } catch {
    return src
  }
  return src
}

function storeCardImageLoader({ src, width, quality }: ImageLoaderProps) {
  return buildStoreImageUrl(src, Math.min(width, 640), quality || 70)
}

function storePreviewImageLoader({ src, width, quality }: ImageLoaderProps) {
  return buildStoreImageUrl(src, Math.min(width, 1200), quality || 82)
}

function StoreItemImage({ src, alt, onPreview }: { src: string | null; alt: string; onPreview?: () => void }) {
  const [failed, setFailed] = useState(false)
  const showFallback = !src || failed

  return (
    <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50 p-4">
      {showFallback ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white/45 text-slate-300">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">暂无商品图片</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPreview}
          className="group relative flex h-full w-full items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label={`放大查看 ${alt}`}
        >
          <Image
            src={src}
            alt={alt}
            fill
            loader={storeCardImageLoader}
            quality={70}
            sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, 320px"
            className="object-contain transition duration-200 group-hover:scale-[1.03]"
            onError={() => setFailed(true)}
          />
          <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-950/65 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" />
            放大
          </span>
        </button>
      )}
    </div>
  )
}

export default function StorePage() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [points, setPoints] = useState(0)
  const [memberInfo, setMemberInfo] = useState(DEFAULT_MEMBER_INFO)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null)
  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null)
  const [redeemForm, setRedeemForm] = useState<RedeemForm>(EMPTY_REDEEM_FORM)
  const [message, setMessage] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory | 'all'>('all')
  const [pointSort, setPointSort] = useState<PointSort>('default')
  const isSuccessMessage = message.includes('成功') || message.includes('已提交')

  useEffect(() => {
    fetch('/api/shop/items')
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))

    fetch('/api/user/points')
      .then((r) => {
        if (r.status === 401) {
          setIsLoggedIn(false)
          return null
        }
        setIsLoggedIn(true)
        return r.json()
      })
      .then((d) => {
        if (d.balance !== undefined) {
          setPoints(d.balance)
          setMemberInfo({
            totalPoints: d.totalPoints || 0,
            tierLabel: d.tierLabel || DEFAULT_MEMBER_INFO.tierLabel,
            discountLabel: d.discountLabel || DEFAULT_MEMBER_INFO.discountLabel,
            discountRate: d.discountRate || DEFAULT_MEMBER_INFO.discountRate,
          })
        }
      })
      .catch(() => setIsLoggedIn(false))
  }, [])

  const getItemCost = (item: ShopItem) => getDiscountedPointCost(item.points_required, memberInfo.totalPoints)
  const categoryCounts = SHOP_CATEGORIES.reduce<Record<string, number>>((counts, category) => {
    counts[category.code] = items.filter((item) => item.category === category.code).length
    return counts
  }, {})
  const uncategorizedCount = items.filter((item) => !item.category).length
  const categoryFilteredItems = selectedCategory === 'all'
    ? items
    : selectedCategory === 'other'
      ? items.filter((item) => item.category === 'other' || !item.category)
      : items.filter((item) => item.category === selectedCategory)
  const filteredItems = pointSort === 'default'
    ? categoryFilteredItems
    : [...categoryFilteredItems].sort((left, right) => {
        const pointDifference = getItemCost(left).discountedPoints - getItemCost(right).discountedPoints
        if (pointDifference !== 0) return pointSort === 'asc' ? pointDifference : -pointDifference
        return left.name.localeCompare(right.name, 'zh-CN')
      })

  const openRedeemForm = (item: ShopItem) => {
    if (isLoggedIn === false) {
      setMessage('请先登录后再兑换商品。')
      return
    }
    const cost = getItemCost(item)
    if (cost.discountedPoints > points) {
      setMessage(`积分不足，需要 ${cost.discountedPoints} 积分，当前 ${points} 积分。`)
      return
    }
    setSelectedItem(item)
    setMessage('')
    setRedeemForm((current) => ({
      ...EMPTY_REDEEM_FORM,
      contactEmail: current.contactEmail,
    }))
  }

  const handleRedeem = async () => {
    if (!selectedItem) return
    const payload = {
      ...redeemForm,
      contactName: redeemForm.contactName.trim(),
      contactPhone: redeemForm.contactPhone.trim(),
      contactEmail: redeemForm.contactEmail.trim(),
      shippingAddress: redeemForm.shippingAddress.trim(),
      shippingNote: redeemForm.shippingNote.trim(),
    }
    if (!payload.contactName || !payload.contactPhone || !payload.contactEmail || !payload.shippingAddress) {
      setMessage('请完整填写收件人、联系电话、邮箱和收货地址。')
      return
    }
    setRedeemingId(selectedItem.id)
    setMessage('')
    try {
      const res = await fetch('/api/shop/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: selectedItem.id, ...payload }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPoints(data.remainingPoints)
      setMessage(data.message || '兑换申请已提交，后台审核通过后工作人员会联系您确认发货信息。')
      setSelectedItem(null)
      setRedeemForm(EMPTY_REDEEM_FORM)
      // 更新库存显示
      setItems((prev) =>
        prev.map((i) => (i.id === selectedItem.id ? { ...i, stock: i.stock - 1 } : i))
      )
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : '兑换失败')
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <a
            href={mailtoHref('service@animaluni.com', '积分商城兑换咨询', '您好，我想咨询积分商城兑换相关问题：')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
          >
            <Mail className="h-4 w-4" />
            兑换咨询
          </a>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <Award className="w-4 h-4" />
            <span>{isLoggedIn === false ? '登录后查看积分' : `${memberInfo.tierLabel} · ${memberInfo.discountLabel} · 可用积分: ${points}`}</span>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            isSuccessMessage
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {isSuccessMessage ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message}
        </div>
      )}
      {isLoggedIn === false && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
          登录后可以查看积分余额并兑换商品。
          <Link href="/login?next=/store" className="ml-2 font-semibold text-blue-700 hover:underline">
            去登录
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <section className="mb-6" aria-label="商品筛选与排序">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Filter className="h-4 w-4 text-blue-600" />
              <span>按类别浏览</span>
              <span className="text-xs font-normal text-slate-400">共 {items.length} 件商品</span>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <ArrowDownUp className="h-4 w-4 text-blue-600" />
              <span className="whitespace-nowrap">积分排序</span>
              <select
                value={pointSort}
                onChange={(event) => setPointSort(event.target.value as PointSort)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                aria-label="积分排序"
              >
                <option value="default">默认顺序</option>
                <option value="asc">积分从低到高</option>
                <option value="desc">积分从高到低</option>
              </select>
            </label>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${selectedCategory === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}
            >
              全部商品 <span className="ml-1 text-xs opacity-75">{items.length}</span>
            </button>
            {SHOP_CATEGORIES.map((category) => {
              const count = categoryCounts[category.code] || 0
              if (!count && category.code !== 'other') return null
              return (
                <button
                  key={category.code}
                  type="button"
                  onClick={() => setSelectedCategory(category.code)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${selectedCategory === category.code ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}
                >
                  {category.label} <span className="ml-1 text-xs opacity-75">{count + (category.code === 'other' ? uncategorizedCount : 0)}</span>
                </button>
              )
            })}
          </div>
        </section>
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
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-14 text-center text-slate-500">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm">这个类别暂时没有可兑换商品</p>
          <button type="button" onClick={() => setSelectedCategory('all')} className="mt-3 text-sm font-semibold text-blue-600 hover:underline">
            查看全部商品
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const cost = getItemCost(item)
            const hasDiscount = isLoggedIn !== false && cost.savedPoints > 0
            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                <StoreItemImage src={item.image_url} alt={item.name} onPreview={() => setPreviewItem(item)} />
                <div className="p-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-semibold text-gray-900">{item.name}</h3>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {getShopCategoryLabel(item.category === 'other' || !item.category ? 'other' : item.category)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1 text-sm font-bold text-amber-600">
                        <Award className="w-4 h-4" />
                        {hasDiscount ? cost.discountedPoints : item.points_required}
                        <span className="text-xs font-normal text-amber-500">积分</span>
                      </div>
                      {hasDiscount ? (
                        <div className="mt-1 text-xs text-gray-400">
                          原价 <span className="line-through">{item.points_required}</span>，已省 {cost.savedPoints} 积分
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-400">
                          {isLoggedIn === false ? '登录后按会员等级显示折扣' : memberInfo.discountLabel}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">库存: {item.stock}</div>
                  </div>
                  <button
                    onClick={() => openRedeemForm(item)}
                    disabled={redeemingId === item.id || item.stock <= 0 || isLoggedIn === false || cost.discountedPoints > points}
                    className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {redeemingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : item.stock <= 0 ? (
                      '已售罄'
                    ) : isLoggedIn === false ? (
                      '登录后兑换'
                    ) : cost.discountedPoints > points ? (
                      '积分不足'
                    ) : (
                      '立即兑换'
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">提交兑换申请</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedItem.name} · 需扣 {getItemCost(selectedItem).discountedPoints} 积分
                  {getItemCost(selectedItem).savedPoints > 0 ? `（${memberInfo.discountLabel}，原价 ${selectedItem.points_required}）` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">收件人</span>
                  <input
                    value={redeemForm.contactName}
                    onChange={(event) => setRedeemForm((form) => ({ ...form, contactName: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    placeholder="姓名"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">联系电话</span>
                  <input
                    value={redeemForm.contactPhone}
                    onChange={(event) => setRedeemForm((form) => ({ ...form, contactPhone: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    placeholder="手机号"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">发货通知邮箱</span>
                <input
                  value={redeemForm.contactEmail}
                  onChange={(event) => setRedeemForm((form) => ({ ...form, contactEmail: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="邮箱"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">收货地址</span>
                <textarea
                  value={redeemForm.shippingAddress}
                  onChange={(event) => setRedeemForm((form) => ({ ...form, shippingAddress: event.target.value }))}
                  className="mt-1 min-h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="省市区、详细地址"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">备注</span>
                <textarea
                  value={redeemForm.shippingNote}
                  onChange={(event) => setRedeemForm((form) => ({ ...form, shippingNote: event.target.value }))}
                  className="mt-1 min-h-16 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  placeholder="颜色、型号、方便联系时间等"
                />
              </label>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                提交后订单进入后台待审核。审核通过后工作人员会按您填写的信息联系确认并安排发货。
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-sm leading-6 text-orange-800">
                <p className="font-semibold">兑换须知</p>
                <p className="mt-1">{SHOP_REDEMPTION_NOTICE}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleRedeem}
                disabled={redeemingId === selectedItem.id}
                className="inline-flex min-w-28 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {redeemingId === selectedItem.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewItem?.image_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{previewItem.name}</h2>
                <p className="text-xs text-slate-500">完整商品信息 · 点击图片外区域可关闭</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭图片预览"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-[78vh] gap-5 overflow-y-auto rounded-xl bg-slate-50 p-4 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] md:overflow-hidden">
              <div className="relative flex min-h-64 items-center justify-center rounded-xl bg-white p-4 md:min-h-[62vh]">
                <Image
                  src={previewItem.image_url}
                  alt={previewItem.name}
                  fill
                  loader={storePreviewImageLoader}
                  quality={82}
                  sizes="(max-width: 767px) calc(100vw - 64px), 60vw"
                  className="object-contain p-4"
                />
              </div>
              <div className="min-w-0 rounded-xl bg-white p-5">
                <h3 className="text-base font-bold leading-6 text-slate-900">{previewItem.name}</h3>
                <div className="mt-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-1.5 text-lg font-bold text-amber-600">
                    <Award className="h-5 w-5" />
                    {getItemCost(previewItem).discountedPoints}
                    <span className="text-sm font-normal text-amber-500">积分</span>
                  </div>
                  <span className="text-sm text-slate-500">库存：{previewItem.stock}</span>
                </div>
                <div className="mt-4 max-h-[38vh] overflow-y-auto whitespace-pre-wrap break-words pr-2 text-sm leading-7 text-slate-600">
                  {previewItem.description?.trim() || '暂无商品详细介绍。'}
                </div>
                <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-sm leading-6 text-orange-800">
                  <p className="font-semibold">兑换须知</p>
                  <p className="mt-1">{SHOP_REDEMPTION_NOTICE}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
