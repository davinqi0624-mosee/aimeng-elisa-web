'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  FileText,
  ArrowLeft,
  Loader2,
  Printer,
  FlaskConical,
  BookOpen,
  AlertCircle,
  ChevronRight,
  Beaker,
  Droplets,
  Pipette,
  TestTube,
  ClipboardList,
  ShieldAlert,
  Lightbulb,
} from 'lucide-react'

interface Datasheet {
  id: string
  title: string
  target: string
  species: string
  method: string
  content: Record<string, string>
  status: string
  catalog_number: string | null
  size: string | null
  created_at: string
  updated_at: string
  antibody_catalog?: { supplier: string; catalog_number: string; target: string }
}

const SECTIONS: { key: string; label: string; numeral: string; icon: React.ReactNode }[] = [
  { key: 'principle', label: '检测原理', numeral: '一', icon: <FlaskConical className="w-4 h-4" /> },
  { key: 'kit_components', label: '试剂盒组分', numeral: '二', icon: <Beaker className="w-4 h-4" /> },
  { key: 'equipment_needed', label: '需自备器材', numeral: '※', icon: <Pipette className="w-4 h-4" /> },
  { key: 'sample_collection', label: '样本收集方法', numeral: '三', icon: <Droplets className="w-4 h-4" /> },
  { key: 'sample_notes', label: '样本收集注意事项', numeral: '四', icon: <AlertCircle className="w-4 h-4" /> },
  { key: 'sample_storage', label: '样本保存', numeral: '五', icon: <TestTube className="w-4 h-4" /> },
  { key: 'operation_notes', label: '实验操作注意事项', numeral: '六', icon: <ShieldAlert className="w-4 h-4" /> },
  { key: 'reagent_preparation', label: '检测前试剂准备', numeral: '七', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'washing_method', label: '洗板方法', numeral: '八', icon: <Droplets className="w-4 h-4" /> },
  { key: 'procedure', label: '检测程序', numeral: '九', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'procedure_summary', label: '检测程序总结', numeral: '十', icon: <ChevronRight className="w-4 h-4" /> },
  { key: 'results', label: '结果判断与计算', numeral: '十一', icon: <Lightbulb className="w-4 h-4" /> },
  { key: 'declaration', label: '声明', numeral: '十二', icon: <AlertCircle className="w-4 h-4" /> },
  { key: 'troubleshooting', label: '问题分析', numeral: '', icon: <AlertCircle className="w-4 h-4" /> },
]

export default function DatasheetDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [datasheet, setDatasheet] = useState<Datasheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('header')

  useEffect(() => {
    fetch(`/api/datasheet?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setDatasheet(d.datasheet)
      })
      .catch((err) => setError(err.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [id])

  const handlePrint = () => {
    window.print()
  }

  const methodLabel = (m: string) => {
    if (m === 'sandwich') return '夹心法 ELISA'
    if (m === 'competitive') return '竞争法 ELISA'
    if (m === 'chemiluminescence') return '化学发光法'
    return m
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !datasheet) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className="text-sm text-gray-500">{error || '说明书不存在'}</p>
        <Link href="/datasheet" className="text-sm text-blue-600 hover:underline mt-4 inline-block">
          返回列表
        </Link>
      </div>
    )
  }

  const headerContent = datasheet.content?.header || ''

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 print:px-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/datasheet" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 truncate">{datasheet.title}</h1>
            <p className="text-xs text-gray-500">
              {methodLabel(datasheet.method)} · {datasheet.target} ({datasheet.species})
              {datasheet.catalog_number && (
                <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                  货号: {datasheet.catalog_number}
                </span>
              )}
              {datasheet.antibody_catalog && (
                <span className="ml-2">
                  抗体: {datasheet.antibody_catalog.supplier} {datasheet.antibody_catalog.catalog_number}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          <Printer className="w-4 h-4" />
          打印
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <aside className="w-56 shrink-0 hidden md:block print:hidden">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden sticky top-4">
            <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
              说明书目录
            </div>
            <nav className="divide-y divide-gray-100 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <button
                onClick={() => setActiveSection('header')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors text-left ${
                  activeSection === 'header'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                封面信息
              </button>
              {SECTIONS.map((sec) => (
                <button
                  key={sec.key}
                  onClick={() => setActiveSection(sec.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors text-left ${
                    activeSection === sec.key
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {sec.icon}
                  {sec.numeral && <span className="text-xs text-gray-400 w-5">{sec.numeral}、</span>}
                  {sec.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 print:border-0">
            {/* Header / Cover */}
            <section id="header" className={`block ${activeSection === 'header' ? '' : 'md:hidden'}`}>
              <div className="text-center border-b border-gray-200 pb-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Animalunion Biotechnology Co.,Ltd</h2>
                <p className="text-sm text-gray-600 mb-4">上海爱萌优宁生物技术有限公司</p>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">{datasheet.title}</h1>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed text-left max-w-2xl mx-auto">
                  {headerContent}
                </div>
              </div>
            </section>

            {SECTIONS.map((sec, idx) => {
              const content = datasheet.content?.[sec.key] || '（该章节内容待补充）'
              const isActive = activeSection === sec.key
              return (
                <section
                  key={sec.key}
                  id={sec.key}
                  className={`block ${isActive ? '' : 'md:hidden'} ${idx === 0 && activeSection !== 'header' ? '' : 'mt-6 pt-6 border-t border-gray-100'}`}
                >
                  <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    {sec.numeral && <span className="text-blue-600">{sec.numeral}、</span>}
                    {sec.label}
                  </h2>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {content}
                  </div>
                </section>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
