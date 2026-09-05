'use client'

import type { ReactNode } from 'react'
import { Space } from 'antd'

/**
 * 后台页面统一页头：标题 + 描述 + 右侧操作区。
 * 所有 admin 页面用它替代原来手写的 Tailwind 页头。
 */
export default function PageHeader({
  icon,
  title,
  description,
  extra,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon ? (
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg text-white"
            style={{ background: '#177E97' }}
          >
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {extra ? <Space wrap>{extra}</Space> : null}
    </div>
  )
}
