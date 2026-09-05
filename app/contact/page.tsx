'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
} from 'lucide-react'
import DynamicPage from '@/components/DynamicPage'

interface CustomerService {
  service_name: string
  phone: string
  email: string
  wechat_id: string
  wechat_qr_url: string
  work_hours: string
  address: string
  note: string
}

const FALLBACK_SERVICE: CustomerService = {
  service_name: '爱萌优宁官方客服',
  phone: '400-888-0123',
  email: 'service@animaluni.com',
  wechat_id: '',
  wechat_qr_url: '',
  work_hours: '周一至周五 9:00 - 18:00',
  address: '上海市浦东新区张江高科技园区科苑路88号',
  note: '添加客服时请备注产品货号或产品名称，方便快速确认库存、报价、货期和资料。',
}

const BUSINESS_EMAILS = [
  {
    label: '客服咨询 / 售前售后',
    email: 'service@animaluni.com',
    subject: '爱萌优宁客服咨询',
    description: '产品咨询、报价、货期、说明书、COA、售后支持',
  },
  {
    label: '意见反馈',
    email: 'aimeng@animaluni.com',
    subject: '爱萌优宁网站意见反馈',
    description: '网站体验、AI客服回答、功能建议和问题反馈',
  },
  {
    label: '文献积分 / 文章提交',
    email: 'uning@animaluni.com',
    subject: '爱萌优宁文献积分咨询',
    description: '文献引用、影响因子、积分审核和文章提交咨询',
  },
]

function mailtoHref(email: string, subject: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`
}

export default function ContactPage() {
  const [service, setService] = useState<CustomerService>(FALLBACK_SERVICE)

  useEffect(() => {
    fetch('/api/customer-service')
      .then((r) => r.json())
      .then((data) => {
        if (data.service) setService({ ...FALLBACK_SERVICE, ...data.service })
      })
      .catch(() => {
        setService(FALLBACK_SERVICE)
      })
  }, [])

  return (
    <div className="min-h-full bg-[#F2F6FA]">
      <DynamicPage pageId="contact" />

      <main
        id="contact-info"
        className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 md:py-16"
      >
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
              aimeng.contact / reach us
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950 md:text-4xl">
              联系我们
            </h1>
            <p className="mt-2 text-slate-500">
              官方客服、售前咨询、售后支持与公司联系方式
            </p>
          </div>
          <Link
            href="/agents"
            className="inline-flex w-fit items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-200 hover:text-teal-800"
          >
            查看全国代理商
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-8">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">AIMENG UNING</p>
              <h2 className="mt-2 text-2xl font-black tracking-normal text-slate-950">
                {service.service_name || '爱萌优宁官方客服'}
              </h2>
              <p className="mt-2 text-slate-500">上海爱萌优宁生物技术有限公司</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                  <Phone className="h-4 w-4 text-teal-700" />
                </span>
                <div>
                  <p className="text-xs text-slate-400">客服电话</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {service.phone || '400-888-0123'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                  <Mail className="h-4 w-4 text-teal-700" />
                </span>
                <div>
                  <p className="text-xs text-slate-400">客服邮箱</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {service.email || 'service@animaluni.com'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                  <MessageCircle className="h-4 w-4 text-teal-700" />
                </span>
                <div>
                  <p className="text-xs text-slate-400">客服微信</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {service.wechat_id || '后台待配置'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                  <Clock className="h-4 w-4 text-teal-700" />
                </span>
                <div>
                  <p className="text-xs text-slate-400">工作时间</p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {service.work_hours || '周一至周五 9:00 - 18:00'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
                <MapPin className="h-4 w-4 text-teal-700" />
              </span>
              <div>
                <p className="text-xs text-slate-400">公司地址</p>
                <p className="mt-1 font-semibold text-slate-800">
                  {service.address || FALLBACK_SERVICE.address}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/chat"
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-slate-950 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-700"
              >
                在线客服咨询
              </Link>
              <Link
                href="/agents"
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-200 hover:text-teal-800"
              >
                查询当地代理商
              </Link>
            </div>

            <div className="mt-8 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-900">邮件联系入口</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {BUSINESS_EMAILS.map((item) => (
                  <a
                    key={item.email}
                    href={mailtoHref(item.email, item.subject)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-teal-200 hover:shadow-md"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs font-medium text-teal-700">{item.email}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50">
                <QrCode className="h-5 w-5 text-teal-700" />
              </span>
              <div>
                <h2 className="text-xl font-black tracking-normal text-slate-950">官方客服二维码</h2>
                <p className="text-sm text-slate-500">用于官方售前、售后与资料咨询</p>
              </div>
            </div>

            <div className="flex flex-col gap-6 md:flex-row lg:flex-col xl:flex-row">
              <div className="flex w-full max-w-xs shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-4">
                {service.wechat_qr_url ? (
                  <img
                    src={service.wechat_qr_url}
                    alt="爱萌优宁官方客服二维码"
                    className="aspect-square w-full rounded-xl object-contain"
                    onError={(e) => {
                      const img = e.currentTarget
                      img.style.opacity = '0.25'
                      img.alt = '二维码加载失败'
                    }}
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center text-sm text-slate-400">
                    后台待上传
                    <br />
                    官方二维码
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="text-sm leading-7 text-slate-600">
                  {service.note || FALLBACK_SERVICE.note}
                </p>
                <div className="mt-5 rounded-lg bg-teal-50 p-4 text-sm leading-7 text-teal-900">
                  官方客服适合咨询产品货号、库存、报价、货期、说明书、COA、实验方案和售后问题。
                  代理商信息请进入“全国代理商”页面查看。
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
