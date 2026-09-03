'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check, Clock, Copy, ExternalLink, FileText, Mail, MessageSquare, Phone, QrCode, X } from 'lucide-react'
import { ELISA_TESTING_SERVICE_FORM } from '@/lib/downloads/service-forms'
import { buildProductDocumentDownloadUrl } from '@/lib/products/document-download'
import { getCatalogDisplayNumber } from '@/lib/products/catalog'
import { getSpeciesLabel } from '@/lib/products/species'

interface OrderPanelProps {
  catNo: string
  name: string
  target: string
  species?: string | null
  price48t?: number | null
  price96t?: number | null
  stockStatus: string
  datasheetUrl?: string | null
}

type CustomerService = {
  service_name?: string
  phone?: string
  email?: string
  wechat_id?: string
  wechat_qr_url?: string
  work_hours?: string
  note?: string
}

export default function OrderPanel({
  catNo,
  name,
  target,
  species,
  price48t,
  price96t,
  stockStatus,
  datasheetUrl,
}: OrderPanelProps) {
  const availableSizes = ['48T', '96T']
  const [selectedSize, setSelectedSize] = useState<string>('96T')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'failed'>('idle')
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [customerService, setCustomerService] = useState<CustomerService | null>(null)
  const [serviceForm, setServiceForm] = useState(ELISA_TESTING_SERVICE_FORM)

  const sizePrices: Record<string, number | undefined> = {
    '48T': price48t ?? 1800,
    '96T': price96t ?? 2400,
  }

  const currentPrice = sizePrices[selectedSize]
  const inStock = stockStatus === 'in_stock'
  const normalizedCatNo = getCatalogDisplayNumber(catNo)
  const hasRealCatNo = !!normalizedCatNo && !['-', 'KIT', 'N/A', 'NA', '待确认'].includes(normalizedCatNo.toUpperCase())
  const speciesLabel = getSpeciesLabel(species)
  const datasheetFileName = `${normalizedCatNo || catNo || 'AIMENG'}-${name || '产品说明书'}.pdf`

  const fallbackCopyText = (text: string) => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    } finally {
      document.body.removeChild(textarea)
    }
    return copied
  }

  const copyCatNo = async () => {
    if (!hasRealCatNo) return
    let success = false
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(normalizedCatNo)
        success = true
      }
    } catch {
      success = false
    }

    if (!success) {
      success = fallbackCopyText(normalizedCatNo)
    }

    setCopyStatus(success ? 'success' : 'failed')
    window.setTimeout(() => setCopyStatus('idle'), success ? 1400 : 2200)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/downloads/service-forms')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.elisaTestingServiceForm?.href) {
          setServiceForm({ ...ELISA_TESTING_SERVICE_FORM, ...data.elisaTestingServiceForm })
        }
      })
      .catch(() => {
        if (!cancelled) setServiceForm(ELISA_TESTING_SERVICE_FORM)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!showServiceModal || customerService) return

    let cancelled = false
    fetch('/api/customer-service')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setCustomerService(data.service || null)
      })
      .catch(() => {
        if (!cancelled) setCustomerService(null)
      })

    return () => {
      cancelled = true
    }
  }, [showServiceModal, customerService])

  return (
    <>
    <div className="bg-blue-50 rounded-xl border border-blue-100 p-6 space-y-6">
      {/* Product Info */}
      <div>
        <p className="text-lg font-bold text-slate-900">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>货号: {hasRealCatNo ? normalizedCatNo : '待确认'}</span>
          {hasRealCatNo && (
            <button
              type="button"
              onClick={copyCatNo}
              className={`inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs font-medium hover:bg-blue-50 ${
                copyStatus === 'failed'
                  ? 'border-red-100 text-red-600'
                  : copyStatus === 'success'
                    ? 'border-emerald-100 text-emerald-600'
                    : 'border-blue-100 text-blue-600'
              }`}
              aria-live="polite"
            >
              {copyStatus === 'success' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copyStatus === 'success' ? '已复制' : copyStatus === 'failed' ? '请手动复制' : '复制'}
            </button>
          )}
        </div>
        {speciesLabel && (
          <p className="text-sm text-slate-500 mt-1">种属: {speciesLabel}</p>
        )}
        {target && (
          <p className="text-sm text-slate-500 mt-1">靶标: {target}</p>
        )}
      </div>

      {/* Size Selector */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">规格选择</p>
        <div className="flex gap-3">
          {availableSizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                selectedSize === size
                  ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                  : 'border-blue-200 bg-white/60 text-slate-600 hover:bg-white'
              }`}
            >
              <span className="block text-base font-bold">{size}</span>
              <span className="text-xs text-slate-400">
                {sizePrices[size] ? `¥${sizePrices[size]}` : '询价'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Price & Stock */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">价格</p>
          <p className="text-3xl font-bold text-blue-600">
            {currentPrice ? `¥${currentPrice}` : '询价'}
            <span className="text-sm font-normal text-slate-400 ml-1">/ {selectedSize}</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
            inStock
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {inStock ? (
            <>
              <Check className="w-3.5 h-3.5" />
              现货
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5" />
              预订
            </>
          )}
        </span>
      </div>

      {/* CTA Buttons */}
      <div className="space-y-3">
        {datasheetUrl ? (
          <a
            href={buildProductDocumentDownloadUrl(datasheetUrl, datasheetFileName)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            下载说明书
          </a>
        ) : (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-200 text-slate-400 rounded-lg font-semibold cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            说明书暂缺
          </button>
        )}
        <a
          href={serviceForm.href}
          download={serviceForm.fileName}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-700 rounded-lg border border-blue-200 font-semibold hover:bg-blue-50 transition-colors"
        >
          <FileText className="w-4 h-4" />
          下载代测申请表
        </a>
        <div className="mt-3 space-y-2">
          {/* 联系客服按钮 */}
          <button
             type="button"
             onClick={() => setShowServiceModal(true)}
             className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
         >
             <MessageSquare className="w-4 h-4" />
             联系客服咨询
           </button>

           {/* 新增提示文字 */}
           <p className="text-center text-xs text-orange-500 font-medium mt-2">
             {inStock ? '今日 15:00 前确认，预计次日发出' : '请联系客服确认货期和库存'}
           </p>
         </div>
       </div> 
     </div>
     {showServiceModal && (
       <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
         <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
           <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
             <div>
               <p className="text-base font-bold text-slate-900">联系客服咨询</p>
               <p className="text-xs text-slate-500">添加客服时可备注产品货号，方便快速确认库存和报价。</p>
             </div>
             <button
               type="button"
               onClick={() => setShowServiceModal(false)}
               className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
               aria-label="关闭客服弹窗"
             >
               <X className="h-5 w-5" />
             </button>
           </div>

           <div className="space-y-4 p-5">
             <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-4">
               {customerService?.wechat_qr_url ? (
                 <Image
                   src={customerService.wechat_qr_url}
                   alt="官方客服微信二维码"
                   width={176}
                   height={176}
                   className="h-44 w-44 rounded-lg border border-white bg-white object-contain shadow-sm"
                 />
               ) : (
                 <div className="flex h-44 w-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-400">
                   <QrCode className="mb-2 h-10 w-10" />
                   <span className="text-xs">客服二维码待配置</span>
                 </div>
               )}
               <p className="mt-3 text-sm font-semibold text-slate-900">
                 {customerService?.service_name || '爱萌优宁官方客服'}
               </p>
               <p className="mt-1 text-center text-xs text-slate-500">
                 {customerService?.note || `请发送货号 ${hasRealCatNo ? normalizedCatNo : '和产品名称'}，客服会协助确认规格、价格、货期和资料。`}
               </p>
             </div>

             <div className="grid gap-2 text-sm text-slate-700">
               <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                 <Phone className="h-4 w-4 text-emerald-600" />
                 <span>电话：{customerService?.phone || '400-888-0123'}</span>
               </div>
               <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                 <Mail className="h-4 w-4 text-blue-600" />
                 <span>邮箱：{customerService?.email || 'service@animaluni.com'}</span>
               </div>
               {customerService?.wechat_id && (
                 <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                   <MessageSquare className="h-4 w-4 text-cyan-600" />
                   <span>微信：{customerService.wechat_id}</span>
                 </div>
               )}
               {customerService?.work_hours && (
                 <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                   工作时间：{customerService.work_hours}
                 </div>
               )}
             </div>

             <a
               href="/contact"
               className="flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
             >
               查看更多联系方式
               <ExternalLink className="h-4 w-4" />
             </a>
           </div>
         </div>
       </div>
     )}
    </>
  )
}
