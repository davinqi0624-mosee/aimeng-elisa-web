'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, Mail, MessageSquare, Phone, QrCode, X } from 'lucide-react'

type CustomerService = {
  service_name?: string
  phone?: string
  email?: string
  wechat_id?: string
  wechat_qr_url?: string
  work_hours?: string
  note?: string
}

type ButtonVariant = 'primary' | 'outline' | 'cyan'

type OfficialCustomerServiceButtonProps = {
  label?: string
  note?: string
  variant?: ButtonVariant
  className?: string
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#123A63] text-white hover:bg-[#0E3155]',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
  cyan: 'bg-cyan-600 text-white hover:bg-cyan-700',
}

export default function OfficialCustomerServiceButton({
  label = '转人工客服',
  note,
  variant = 'primary',
  className = '',
}: OfficialCustomerServiceButtonProps) {
  const [open, setOpen] = useState(false)
  const [customerService, setCustomerService] = useState<CustomerService | null>(null)

  useEffect(() => {
    if (!open || customerService) return

    let cancelled = false
    fetch('/api/customer-service')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCustomerService(data.service || null)
      })
      .catch(() => {
        if (!cancelled) setCustomerService(null)
      })

    return () => {
      cancelled = true
    }
  }, [open, customerService])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${variantClasses[variant]} ${className}`}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-base font-bold text-slate-900">转人工客服</p>
                <p className="text-xs text-slate-500">
                  {note || '请备注产品方向、检测指标和样本类型，方便客服快速确认。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                <p className="mt-1 text-center text-xs leading-5 text-slate-500">
                  {customerService?.note || '请发送产品方向、检测指标、样本类型和实验用途，客服会协助确认规格、库存、报价和资料。'}
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
