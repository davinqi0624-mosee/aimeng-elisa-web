'use client'

import '@ant-design/v5-patch-for-react-19'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { ReactNode } from 'react'

/**
 * 后台统一 antd 主题：主色取自 logo 蓝绿（#177E97），
 * 圆角、字号对齐 Ant Design Pro 默认观感。
 */
export const ADMIN_THEME = {
  token: {
    colorPrimary: '#177E97',
    colorInfo: '#177E97',
    colorLink: '#177E97',
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      headerBg: '#ffffff',
      bodyBg: '#f5f7fa',
    },
    Menu: {
      itemBorderRadius: 6,
      subMenuItemBorderRadius: 6,
    },
  },
}

export default function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={ADMIN_THEME} locale={zhCN}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  )
}
