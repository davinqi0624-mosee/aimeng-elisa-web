import DynamicPage from '@/components/DynamicPage'
import { FlaskConical, Microscope, Users, Award } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-full bg-gray-50">
      <DynamicPage
        pageId="about"
        fallback={
          <div>
            {/* Static Hero */}
            <section className="bg-slate-900 py-24 md:py-32">
              <div className="max-w-7xl mx-auto px-6 md:px-8 text-center">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
                  关于 Animal Union
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                  专注 ELISA 试剂盒研发与服务，为科研工作者提供高质量的产品与专业的技术支持
                </p>
              </div>
            </section>

            {/* Stats */}
            <section className="border-y border-slate-200 bg-white">
              <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                  <div>
                    <p className="text-3xl font-bold text-slate-900">3,484+</p>
                    <p className="text-sm text-slate-500 mt-1">试剂盒产品</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-900">100+</p>
                    <p className="text-sm text-slate-500 mt-1">种属覆盖</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-900">10年</p>
                    <p className="text-sm text-slate-500 mt-1">行业经验</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-900">24h</p>
                    <p className="text-sm text-slate-500 mt-1">技术支持</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Values */}
            <section className="py-24 md:py-32 bg-white">
              <div className="max-w-7xl mx-auto px-6 md:px-8">
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-4">
                    我们的优势
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { icon: <Microscope className="w-6 h-6" />, title: '专业研发', desc: '自有研发团队，持续创新' },
                    { icon: <Award className="w-6 h-6" />, title: '品质保证', desc: '严格质控，稳定可靠' },
                    { icon: <Users className="w-6 h-6" />, title: '全国服务', desc: '代理商网络覆盖全国' },
                    { icon: <FlaskConical className="w-6 h-6" />, title: '技术支持', desc: '专业团队全程支持' },
                  ].map((item) => (
                    <div key={item.title} className="bg-slate-50 rounded-xl p-8 text-center">
                      <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mx-auto mb-4 text-slate-600">
                        {item.icon}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-600">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        }
      />
    </div>
  )
}
