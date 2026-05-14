'use client'

import { useState } from 'react'

interface PrincipleTabProps {
  description?: string
}

const TABS = [
  { id: 'description', label: '产品描述' },
  { id: 'principle', label: '检测原理' },
]

export default function PrincipleTab({ description }: PrincipleTabProps) {
  const [activeTab, setActiveTab] = useState('description')

  return (
    <div>
      {/* Tab Headers */}
      <div className="flex gap-6 border-b mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'description' && (
        <div>
          {description ? (
            <p className="text-gray-700 leading-relaxed">{description}</p>
          ) : (
            <p className="text-gray-400">暂无产品描述</p>
          )}
        </div>
      )}

      {activeTab === 'principle' && (
        <div className="space-y-4">
          <img
            src="/images/elisa/elisa_full_workflow_vertical.jpg"
            alt="双抗夹心法（Sandwich ELISA）原理示意图"
            className="w-full max-w-lg mx-auto rounded-lg border border-gray-200"
          />
          <p className="text-center text-sm text-gray-500">
            双抗夹心法（Sandwich ELISA）原理示意图
          </p>
        </div>
      )}
    </div>
  )
}
