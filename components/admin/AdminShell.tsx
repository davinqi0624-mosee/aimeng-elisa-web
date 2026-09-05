'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ProLayout } from '@ant-design/pro-components'
import type { MenuDataItem, ProLayoutProps } from '@ant-design/pro-components'
import {
  DashboardOutlined,
  AppstoreOutlined,
  ExperimentOutlined,
  PictureOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  BookOutlined,
  GiftOutlined,
  OrderedListOutlined,
  TagsOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  CrownOutlined,
  SettingOutlined,
  ControlOutlined,
  KeyOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { Dropdown, Spin, Tag } from 'antd'
import { LogoutOutlined, EditOutlined, HomeOutlined, UserOutlined } from '@ant-design/icons'

interface AdminData {
  id: string
  username: string
  role: 'super' | 'admin'
  display_name: string
  permissions: string[]
}

interface AdminMenuItem extends MenuDataItem {
  roles: ('super' | 'admin')[]
  permission?: string
}

const MENU_GROUPS: { name: string; items: AdminMenuItem[] }[] = [
  {
    name: '总览',
    items: [
      { path: '/admin', name: '仪表盘', icon: <DashboardOutlined />, roles: ['super', 'admin'] },
    ],
  },
  {
    name: '产品管理',
    items: [
      { path: '/admin/products', name: '商品管理', icon: <AppstoreOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/biochemical-products', name: '生化法试剂盒', icon: <ExperimentOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/serum-products', name: '血清产品', icon: <ExperimentOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/product-assets', name: '产品图片', icon: <PictureOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/product-documents', name: '产品文档', icon: <FileTextOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/datasheet', name: '说明书生成', icon: <FileSearchOutlined />, roles: ['super', 'admin'] },
    ],
  },
  {
    name: '内容运营',
    items: [
      { path: '/admin/home-banners', name: '首页广告位', icon: <PictureOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/home-media', name: '自媒体内容', icon: <VideoCameraOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/knowledge/generate', name: '每日知识生成', icon: <BookOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/knowledge/candidates', name: '知识候选审核', icon: <BookOutlined />, roles: ['super', 'admin'] },
    ],
  },
  {
    name: '订单与积分',
    items: [
      { path: '/admin/shop', name: '积分商城', icon: <GiftOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/orders', name: '兑换订单', icon: <OrderedListOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/purchase-points', name: '购买积分审核', icon: <TagsOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/citations', name: '文献引用审核', icon: <FileSearchOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/bulk-imports', name: '批量导入记录', icon: <HistoryOutlined />, roles: ['super', 'admin'] },
    ],
  },
  {
    name: '渠道与用户',
    items: [
      { path: '/admin/agents', name: '代理商管理', icon: <EnvironmentOutlined />, roles: ['super', 'admin'] },
      { path: '/admin/users', name: '用户管理', icon: <TeamOutlined />, roles: ['super', 'admin'], permission: 'user_manage' },
      { path: '/admin/admins', name: '管理员管理', icon: <CrownOutlined />, roles: ['super'] },
    ],
  },
  {
    name: '系统',
    items: [
      { path: '/admin/ai-agents', name: 'Agent 中台', icon: <RobotOutlined />, roles: ['super'] },
      { path: '/admin/ai-keys', name: 'AI 密钥管理', icon: <KeyOutlined />, roles: ['super'] },
      { path: '/admin/maintenance', name: '运维中心', icon: <ControlOutlined />, roles: ['super'] },
      { path: '/admin/settings', name: '系统设置', icon: <SettingOutlined />, roles: ['super'] },
    ],
  },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push('/admin/login')
        } else {
          setAdmin(data)
        }
      })
      .catch(() => router.push('/admin/login'))
      .finally(() => setLoading(false))
  }, [router])

  const menuData = useMemo<MenuDataItem[]>(() => {
    if (!admin) return []
    return MENU_GROUPS.map((group) => ({
      name: group.name,
      path: `/_group/${group.name}`,
      children: group.items
        .filter((item) => {
          if (!item.roles.includes(admin.role)) return false
          if (admin.role === 'super' || !item.permission) return true
          return admin.permissions.includes(item.permission)
        })
        .map((item) => ({ path: item.path, name: item.name, icon: item.icon })),
    })).filter((group) => (group.children?.length ?? 0) > 0) as MenuDataItem[]
  }, [admin])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <Spin size="large" />
      </div>
    )
  }

  if (!admin) return null

  const isEditorRoute = pathname.startsWith('/admin/pages/') && pathname.endsWith('/editor')

  const layoutProps: ProLayoutProps = {
    title: 'AIMENG UNING',
    logo: (
      <Image
        src="/brand/admin-a-logo.svg"
        alt="AIMENG UNING"
        width={34}
        height={28}
        className="h-8 w-9 object-contain"
        priority
      />
    ),
    layout: 'side',
    fixedHeader: true,
    fixSiderbar: true,
    route: { path: '/', routes: menuData },
    location: { pathname },
    menu: { hideMenuWhenCollapsed: false },
    menuItemRender: (item, dom) => <Link href={item.path || '/admin'}>{dom}</Link>,
    avatarProps: {
      icon: <UserOutlined />,
      title: admin.display_name || admin.username,
      render: (_props, dom) => (
        <Dropdown
          menu={{
            items: [
              { key: 'role', label: admin.role === 'super' ? <Tag color="gold">超级管理员</Tag> : <Tag color="cyan">管理员</Tag>, disabled: true },
              { type: 'divider' },
              { key: 'password', icon: <EditOutlined />, label: <Link href="/admin/change-password">修改密码</Link> },
              { key: 'home', icon: <HomeOutlined />, label: <Link href="/" target="_blank">返回网站首页</Link> },
              { type: 'divider' },
              { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
            ],
          }}
        >
          {dom}
        </Dropdown>
      ),
    },
    token: {
      header: { heightLayoutHeader: 56 },
      sider: { colorMenuBackground: '#ffffff' },
      pageContainer: { paddingBlockPageContainerContent: 20, paddingInlinePageContainerContent: 24 },
    },
  }

  return (
    <div className="h-full">
      <ProLayout
        {...layoutProps}
        style={{ height: '100%' }}
        contentStyle={isEditorRoute ? { height: '100%', overflow: 'hidden' } : undefined}
      >
        <div className={isEditorRoute ? 'h-full' : ''}>{children}</div>
      </ProLayout>
    </div>
  )
}
