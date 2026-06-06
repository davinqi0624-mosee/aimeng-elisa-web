'use client';

import Navbar from '@/components/Navbar';
import { BookOpen, Award, ExternalLink, Quote, FileText } from 'lucide-react';

const publications = [
  {
    title: 'Serum IL-6 levels as a prognostic biomarker in patients with sepsis',
    journal: 'Journal of Immunology Research',
    year: '2025',
    authors: 'Zhang L., Wang H., et al.',
    product: 'Human IL-6 ELISA Kit (AE-HIL6-001)',
    citations: 12,
  },
  {
    title: 'TNF-α signaling pathway in inflammatory bowel disease',
    journal: 'Gastroenterology',
    year: '2025',
    authors: 'Li M., Chen X., et al.',
    product: 'Mouse TNF-α ELISA Kit (AE-MTNF-003)',
    citations: 8,
  },
  {
    title: 'VEGF expression in tumor microenvironment',
    journal: 'Cancer Research',
    year: '2024',
    authors: 'Liu J., Zhao Y., et al.',
    product: 'Rat VEGF ELISA Kit (AE-RVEGF-002)',
    citations: 15,
  },
  {
    title: 'IFN-γ response in viral infection models',
    journal: 'Virology Journal',
    year: '2024',
    authors: 'Wu S., Huang P., et al.',
    product: 'Human IFN-γ ELISA Kit (AE-HIFNG-005)',
    citations: 6,
  },
];

export default function PublicationsPage() {
  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <Navbar />
      <div className="pt-20 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1E293B] mb-2">文献引用</h1>
            <p className="text-[#94A3B8]">发表文献引用 Animal Union 产品，即可获得积分奖励</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: '已发表文献', value: '128+', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: '总引用次数', value: '2,450+', icon: Quote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: '合作课题组', value: '86', icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1E293B]">{stat.value}</p>
                    <p className="text-sm text-[#94A3B8]">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Publications List */}
          <div className="space-y-4">
            {publications.map((pub, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1E293B] mb-1">{pub.title}</h3>
                    <p className="text-sm text-[#94A3B8] mb-2">{pub.authors}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 font-medium">{pub.journal}</span>
                      <span className="text-[#94A3B8]">{pub.year}</span>
                      <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-600">引用 {pub.citations} 次</span>
                      <span className="px-2 py-1 rounded bg-amber-50 text-amber-600">{pub.product}</span>
                    </div>
                  </div>
                  <a href="#" className="shrink-0 p-2 rounded-lg hover:bg-blue-50 text-[#94A3B8] hover:text-blue-600 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Submit CTA */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100 p-8 text-center">
            <Award className="w-10 h-10 text-blue-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#1E293B] mb-2">发表文献获取积分</h3>
            <p className="text-sm text-[#94A3B8] mb-4">使用 Animal Union 产品发表 SCI 论文，每篇可获得 100-500 积分</p>
            <button className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              提交文献信息
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
