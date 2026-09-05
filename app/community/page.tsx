import Link from 'next/link'
import { BookOpen, FileText, MessageCircle, Sparkles } from 'lucide-react'

const availableLinks = [
  {
    href: '/chat',
    title: 'AI 客服',
    description: '产品选型、实验问题和售后支持可先通过 AI 客服咨询。',
    icon: MessageCircle,
  },
  {
    href: '/knowledge',
    title: '每日知识',
    description: '查看 ELISA 原理、样本处理、数据分析等实验知识。',
    icon: BookOpen,
  },
  {
    href: '/citations',
    title: '文献引用',
    description: '查看客户文献成果，或提交使用爱萌产品发表的论文。',
    icon: FileText,
  },
]

export default function CommunityPage() {
  return (
    <div className="min-h-full bg-[#F2F6FA] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            aimeng.community / coming soon
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-normal text-slate-950">科研社区即将开放</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            科研社区会用于客户实验讨论、问题沉淀和经验分享。当前社区发帖、回复和专家审核功能还未正式开放，因此暂不展示模拟讨论内容，避免客户误解为真实数据。
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {availableLinks.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-teal-200 hover:bg-teal-50"
                >
                  <Icon className="h-5 w-5 text-teal-700" />
                  <h2 className="mt-3 text-sm font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
