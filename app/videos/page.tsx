'use client';

import Navbar from '@/components/Navbar';
import { Video, ExternalLink, Play, Clock, Eye } from 'lucide-react';

const videos = [
  { title: 'ELISA实验基础操作', duration: '15:30', views: '2.3k', category: '基础操作', platform: '小红书' },
  { title: '双抗夹心法详解', duration: '22:15', views: '1.8k', category: '方法学', platform: '小红书' },
  { title: '实验数据分析入门', duration: '18:45', views: '3.1k', category: '数据分析', platform: '小红书' },
  { title: '样本处理与保存技巧', duration: '12:20', views: '1.5k', category: '样本处理', platform: '小红书' },
  { title: '标准曲线构建指南', duration: '25:00', views: '2.1k', category: '数据分析', platform: '小红书' },
  { title: '常见问题排查', duration: '30:10', views: '4.2k', category: ' troubleshooting', platform: '小红书' },
];

export default function VideosPage() {
  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <Navbar />
      <div className="pt-20 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1E293B] mb-2">视频教程</h1>
            <p className="text-[#94A3B8]">详细的实验操作视频，从准备到结果分析全流程指导</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((v, i) => (
              <a
                key={i}
                href="https://www.xiaohongshu.com/"
                target="_blank"
                className="group bg-white rounded-2xl overflow-hidden border border-gray-200 hover:shadow-lg transition-all block"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center relative">
                  <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 text-blue-600 ml-1" />
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {v.duration}
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 rounded bg-red-500 text-xs text-white flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> {v.platform}
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs">{v.category}</span>
                  </div>
                  <h3 className="font-semibold text-[#1E293B] mb-2">{v.title}</h3>
                  <div className="flex items-center gap-4 text-[#94A3B8] text-xs">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {v.views}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {v.duration}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
