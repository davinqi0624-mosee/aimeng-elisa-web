'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ChevronDown,
  FileText,
  BarChart3,
  ImageIcon,
  Info,
  BookOpen,
  Download,
} from 'lucide-react'
import { ELISA_TESTING_SERVICE_FORM } from '@/lib/downloads/service-forms'
import { buildProductDocumentDownloadUrl } from '@/lib/products/document-download'

interface Citation {
  id: string
  title: string
  authors?: string
  journal?: string
  doi?: string
  impact_factor?: number
  publication_date?: string
}

interface AccordionSection {
  id: string
  title: string
  icon: React.ReactNode
  content: React.ReactNode
}

interface ProductDocumentLink {
  id: string
  document_type: 'datasheet' | 'coa'
  file_url: string
  file_name: string | null
}

interface ProductAccordionProps {
  description?: string | null
  detectionMethod?: string | null
  assayTime?: string | null
  platform?: string | null
  sampleTypes?: string[] | string | null
  detectionRange?: string | null
  sensitivity?: string | null
  galleryImages: { url: string; type: string; label: string }[]
  citations?: Citation[]
  datasheetUrl?: string | null
  documents?: ProductDocumentLink[]
  catNo: string
}


function SectionHeader({
  id,
  title,
  icon,
  isOpen,
  onClick,
}: {
  id: string
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-controls={`${id}-panel`}
      aria-expanded={isOpen}
      className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-slate-400">{icon}</span>
        <span className="font-semibold text-slate-900">{title}</span>
      </div>
      <ChevronDown
        className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      />
    </button>
  )
}

export default function ProductAccordion({
  description,
  detectionMethod,
  assayTime,
  platform,
  sampleTypes,
  detectionRange,
  sensitivity,
  galleryImages,
  citations,
  datasheetUrl,
  documents = [],
  catNo,
}: ProductAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['details']))
  const [serviceForm, setServiceForm] = useState(ELISA_TESTING_SERVICE_FORM)

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

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const standardCurveImage = galleryImages.find((img) => img.type === 'standard_curve')
  const productImages = galleryImages.filter((img) =>
    ['product', 'validation', 'additional'].includes(img.type)
  )
  const sampleTypeText = Array.isArray(sampleTypes)
    ? sampleTypes.filter(Boolean).join('、')
    : sampleTypes?.trim()
  const documentLinks = [
    ...documents,
    ...(datasheetUrl && !documents.some((doc) => doc.file_url === datasheetUrl)
      ? [
          {
            id: 'legacy-datasheet',
            document_type: 'datasheet' as const,
            file_url: datasheetUrl,
            file_name: `${catNo} 说明书.pdf`,
          },
        ]
      : []),
  ]

  const sections: AccordionSection[] = [
    {
      id: 'details',
      title: '产品详情',
      icon: <Info className="w-5 h-5" />,
      content: (
        <div className="px-5 pb-5 space-y-4">
          {description ? (
            <p className="text-slate-700 leading-relaxed">{description}</p>
          ) : (
            <p className="text-slate-400">暂无产品描述</p>
          )}
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600 space-y-2">
            <p className="font-medium text-slate-900">试剂盒组成</p>
            <p className="text-xs text-slate-400">以下为常见配置，具体以该货号说明书和实物标签为准。</p>
            <ul className="list-disc list-inside space-y-1 text-slate-500">
              <li>预包被抗体酶标板（96T / 48T）</li>
              <li>标准品</li>
              <li>生物素标记检测抗体</li>
              <li>HRP-链霉亲和素结合物（SABC）</li>
              <li>样品稀释液、洗涤缓冲液、TMB 底物液、终止液</li>
              <li>封板膜、说明书</li>
            </ul>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">检测方法</p>
              <p className="font-semibold text-slate-900">{detectionMethod || '待确认'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">检测平台</p>
              <p className="font-semibold text-slate-900">{platform || 'ELISA'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">操作时长</p>
              <p className="font-semibold text-slate-900">{assayTime || '4h'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">样本类型</p>
              <p className="font-semibold text-slate-900">{sampleTypeText || '待确认'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">有效期</p>
              <p className="font-semibold text-slate-900">6个月</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">保存温度</p>
              <p className="font-semibold text-slate-900">2-8℃</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'range',
      title: '检测范围与灵敏度',
      icon: <BarChart3 className="w-5 h-5" />,
      content: (
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">检测范围</p>
              <p className="font-semibold text-slate-900">{detectionRange || '未提供'}</p>
              <p className="text-xs text-slate-400 mt-1">覆盖低、中、高浓度样本</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">灵敏度</p>
              <p className="font-semibold text-slate-900">{sensitivity || '未提供'}</p>
              <p className="text-xs text-slate-400 mt-1">最低可检测浓度</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            灵敏度定义为可与零标准品区分的最低检测浓度（LOD），通常按平均值 + 2 倍标准差计算。
            标准曲线、CV、回收率和线性范围需以该货号说明书或对应批次质检数据为准。
          </p>
        </div>
      ),
    },
  ]

  if (productImages.length > 0) {
    sections.push({
      id: 'images',
      title: '产品图片',
      icon: <ImageIcon className="w-5 h-5" />,
      content: (
        <div className="px-5 pb-5 space-y-4">
          {productImages.map((img) => (
            <div key={img.type} className="space-y-2">
              <p className="text-sm font-medium text-slate-700">{img.label}</p>
              <div className="relative h-64 md:h-80 rounded-xl overflow-hidden border border-slate-200 bg-white">
                <Image
                  src={img.url}
                  alt={img.label}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 92vw, 760px"
                />
              </div>
            </div>
          ))}
        </div>
      ),
    })
  }

  if (standardCurveImage) {
    sections.push({
      id: 'curve',
      title: '标准曲线示例',
      icon: <BarChart3 className="w-5 h-5" />,
      content: (
        <div className="px-5 pb-5">
          <div className="relative h-64 md:h-80 rounded-xl overflow-hidden border border-slate-200 bg-white">
            <Image
              src={standardCurveImage.url}
              alt="标准曲线示例"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 92vw, 760px"
            />
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">
            典型标准曲线（以对数-线性拟合为例），实际数据请以实验为准
          </p>
        </div>
      ),
    })
  }

  sections.push({
    id: 'citations',
    title: `引用文献 (${citations?.length || 0})`,
    icon: <BookOpen className="w-5 h-5" />,
    content: (
      <div className="px-5 pb-5 space-y-3">
        {citations && citations.length > 0 ? (
          citations.map((c) => (
            <div
              key={c.id}
              className="border border-slate-200 rounded-xl p-4 hover:border-indigo-200 transition-colors"
            >
              <h4 className="font-semibold text-slate-900 text-sm mb-1">{c.title}</h4>
              <p className="text-xs text-slate-500 mb-2">{c.authors}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-slate-600">{c.journal}</span>
                <span>IF: {c.impact_factor || '-'}</span>
                <span>
                  {c.publication_date ? new Date(c.publication_date).getFullYear() : '-'}
                </span>
                {c.doi && (
                  <a
                    href={`https://doi.org/${c.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    DOI: {c.doi}
                  </a>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-2">暂无引用文献</p>
            <p className="text-sm text-slate-500">
              使用本产品发表论文？
              <Link href="/user/citations/submit" className="text-blue-600 hover:underline ml-1">
                提交引用文献获得积分奖励 →
              </Link>
            </p>
          </div>
        )}
      </div>
    ),
  })

  if (documentLinks.length > 0 || serviceForm.href) {
    sections.push({
      id: 'documents',
      title: '产品资料下载',
      icon: <Download className="w-5 h-5" />,
      content: (
        <div className="px-5 pb-5 grid gap-3 sm:grid-cols-2">
          <a
            href={serviceForm.href}
            download={serviceForm.fileName}
            className="inline-flex items-center gap-3 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            <FileText className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{serviceForm.title}</p>
              <p className="text-xs text-emerald-600">通用代测文件 · 点击下载</p>
            </div>
          </a>
          {documentLinks.map((doc) => {
            const label = doc.document_type === 'coa' ? 'COA' : '说明书'
            const fileName = doc.file_name || `${catNo} ${label}.pdf`
            return (
              <div key={doc.id} className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <FileText className="w-5 h-5 shrink-0" />
                <div className="mt-2 min-w-0">
                  <p className="truncate text-sm font-semibold text-blue-800">{fileName}</p>
                  <p className="mt-1 text-xs text-blue-500">{label} · 支持在线预览和直接下载</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    在线预览
                  </a>
                  <a
                    href={buildProductDocumentDownloadUrl(doc.file_url, fileName)}
                    className="inline-flex flex-1 items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    下载文件
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ),
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {sections.map((section) => {
        const isOpen = openSections.has(section.id)
        return (
          <div key={section.id}>
            <SectionHeader
              id={section.id}
              title={section.title}
              icon={section.icon}
              isOpen={isOpen}
              onClick={() => toggleSection(section.id)}
            />
            <div
              id={`${section.id}-panel`}
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              {section.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
