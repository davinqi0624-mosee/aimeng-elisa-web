'use client';

import Navbar from '@/components/Navbar';
import { MessageCircle, Users, ThumbsUp, Eye, Clock, Plus } from 'lucide-react';

const discussions = [
  { name: '张博士', initial: 'Z', tag: '实验方案', title: '小鼠IL-6检测实验方案优化讨论', replies: 23, views: 156, time: '2小时前', content: '最近在做小鼠血清IL-6的检测，发现标准曲线拟合度不太理想，想请教一下大家的经验...' },
  { name: '李研究员', initial: 'L', tag: '技术交流', title: '双抗夹心法标准曲线构建经验分享', replies: 45, views: 342, time: '5小时前', content: '分享一下我们实验室构建标准曲线的一些心得，主要包括浓度梯度的设计和复孔设置...' },
  { name: '王教授', initial: 'W', tag: '常见问题', title: 'ELISA实验常见问题汇总与解决方案', replies: 89, views: 1205, time: '1天前', content: '整理了实验室这几年遇到的常见问题，包括高背景、信号弱、变异系数大等情况...' },
  { name: '陈博士', initial: 'C', tag: '产品评价', title: 'Human IL-6试剂盒使用体验分享', replies: 12, views: 98, time: '2天前', content: '使用了AE-HIL6-001试剂盒检测临床样本，灵敏度和重复性都表现不错...' },
];

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <Navbar />
      <div className="pt-20 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[#1E293B] mb-2">科研社区</h1>
              <p className="text-[#94A3B8]">与全国科研人员交流ELISA实验经验</p>
            </div>
            <button className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> 发起讨论
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: '社区成员', value: '12,580+' },
              { label: '讨论话题', value: '3,420+' },
              { label: '今日活跃', value: '286' },
              { label: '专家解答率', value: '98.5%' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                <p className="text-2xl font-bold text-blue-600">{stat.value}</p>
                <p className="text-xs text-[#94A3B8] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Discussions */}
          <div className="space-y-4">
            {discussions.map((d, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-semibold">
                    {d.initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[#1E293B]">{d.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${
                        d.tag === '实验方案' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        d.tag === '技术交流' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        d.tag === '常见问题' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-purple-50 text-purple-600 border-purple-100'
                      }`}>{d.tag}</span>
                    </div>
                    <h3 className="font-semibold text-[#1E293B] mb-2">{d.title}</h3>
                    <p className="text-sm text-[#94A3B8] mb-3 line-clamp-2">{d.content}</p>
                    <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {d.replies}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {d.views}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {d.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
