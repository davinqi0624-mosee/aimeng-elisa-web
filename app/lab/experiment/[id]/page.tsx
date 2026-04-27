import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ArrowLeft,
  FlaskConical,
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle2,
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ExperimentDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: exp } = await supabase
    .from('experiments')
    .select('*, products(name, target, detection_range)')
    .eq('id', id)
    .maybeSingle()

  if (!exp) return notFound()

  const product = exp.products as any

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/lab/experiment"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回方案生成
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">AI 生成实验方案</span>
          </div>
          <h1 className="text-xl font-bold">{exp.title || 'ELISA 实验方案'}</h1>
        </div>

        <div className="p-6 space-y-6">
          {/* Meta Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">试剂盒</div>
              <div className="text-sm font-medium text-gray-900">{product?.name || '-'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">靶标</div>
              <div className="text-sm font-medium text-gray-900">{product?.target || '-'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">样本类型</div>
              <div className="text-sm font-medium text-gray-900">{exp.sample_type}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">检测范围</div>
              <div className="text-sm font-medium text-gray-900">{product?.detection_range || '-'}</div>
            </div>
          </div>

          {/* Protocol Content */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">实验方案</h2>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-5">
              {exp.protocol_content}
            </div>
          </div>

          {/* Checklist */}
          {exp.checklist && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-gray-900">准备清单</h2>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-5">
                <ul className="space-y-2">
                  {(exp.checklist as string[]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 text-xs text-gray-400 pt-4 border-t border-gray-100">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(exp.created_at).toLocaleDateString('zh-CN')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(exp.created_at).toLocaleTimeString('zh-CN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
