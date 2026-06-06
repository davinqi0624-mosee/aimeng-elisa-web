'use client';

import Navbar from '@/components/Navbar';
import { Coins, Gift, ShoppingBag, Award, ChevronRight, CheckCircle } from 'lucide-react';

const rewards = [
  { name: 'ELISA试剂盒折扣券（8折）', points: 500, icon: ShoppingBag, hot: true, stock: '剩余 23 张' },
  { name: '定制实验记录本', points: 300, icon: Gift, hot: false, stock: '剩余 45 本' },
  { name: '品牌离心管套装（1.5mL×500支）', points: 200, icon: ShoppingBag, hot: false, stock: '剩余 67 套' },
  { name: '科研马克杯', points: 150, icon: Gift, hot: true, stock: '剩余 12 个' },
  { name: '抗体稀释液（100mL）', points: 100, icon: ShoppingBag, hot: false, stock: '剩余 89 瓶' },
  { name: '品牌笔记本', points: 80, icon: Gift, hot: false, stock: '剩余 156 本' },
];

const steps = [
  { step: 1, title: '发表论文', desc: '使用产品发表科研论文', icon: Award },
  { step: 2, title: '提交审核', desc: '上传论文信息等待审核', icon: CheckCircle },
  { step: 3, title: '获得积分', desc: '审核通过后自动发放', icon: Coins },
  { step: 4, title: '兑换礼品', desc: '积分兑换科研周边', icon: Gift },
];

export default function PointsPage() {
  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <Navbar />
      <div className="pt-20 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1E293B] mb-2">积分商城</h1>
            <p className="text-[#94A3B8]">发表论文获取积分，兑换丰富科研周边礼品</p>
          </div>

          {/* User Points Card */}
          <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-8 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">我的积分</p>
                <p className="text-4xl font-bold">0</p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm mb-1">已发表论文</p>
                <p className="text-2xl font-bold">0 篇</p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 text-center relative">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-2">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-sm text-[#1E293B] mb-1">{s.title}</h3>
                  <p className="text-xs text-[#94A3B8]">{s.desc}</p>
                  {i < 3 && <div className="hidden md:block absolute top-1/2 -right-2 text-gray-300"><ChevronRight className="w-5 h-5" /></div>}
                </div>
              );
            })}
          </div>

          {/* Rewards Grid */}
          <h2 className="text-xl font-bold text-[#1E293B] mb-4">积分兑换</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((r, i) => {
              const Icon = r.icon;
              return (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    {r.hot && (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500">
                        HOT
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-[#1E293B] mb-1">{r.name}</h3>
                  <p className="text-xs text-[#94A3B8] mb-4">{r.stock}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Coins className="w-4 h-4" />
                      <span className="font-bold">{r.points}</span>
                      <span className="text-xs text-[#94A3B8]">积分</span>
                    </div>
                    <button className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                      兑换
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
