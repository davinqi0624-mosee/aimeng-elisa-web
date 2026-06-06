'use client'

import { useState } from 'react'
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

interface ProductAccordionProps {
  description?: string | null
  detectionRange?: string | null
  sensitivity?: string | null
  galleryImages: { url: string; type: string; label: string }[]
  citations?: Citation[]
  datasheetUrl?: string | null
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
  detectionRange,
  sensitivity,
  galleryImages,
  citations,
  datasheetUrl,
  catNo,
}: ProductAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['details']))

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
            <ul className="list-disc list-inside space-y-1 text-slate-500">
              <li>预包被抗体酶标板（96T / 48T）</li>
              <li>标准品（冻干粉，7 点 + Blank）</li>
              <li>生物素标记检测抗体</li>
              <li>HRP-链霉亲和素结合物（SABC）</li>
              <li>样品稀释液、洗涤缓冲液、TMB 底物液、终止液</li>
              <li>封板膜、说明书</li>
            </ul>
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
            {'检测范围内线性相关系数 R² ≥ 0.99，批内变异系数 CV < 8%，批间变异系数 CV < 10%。'}
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
                  sizes="800px"
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
              sizes="800px"
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

  if (datasheetUrl) {
    sections.push({
      id: 'datasheet',
      title: '说明书下载',
      icon: <Download className="w-5 h-5" />,
      content: (
        <div className="px-5 pb-5">
          <a
            href={datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-5 py-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <FileText className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">{catNo} 说明书.pdf</p>
              <p className="text-xs text-blue-500">点击下载 / 在线预览</p>
            </div>
          </a>
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
