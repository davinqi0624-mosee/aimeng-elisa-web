'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  BookOutlined,
  DashboardOutlined,
  DeleteOutlined,
  FileTextOutlined,
  GiftOutlined,
  InboxOutlined,
  OrderedListOutlined,
  RiseOutlined,
  SafetyOutlined,
  ScanOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

interface Stats {
  products: number
  shopItems: number
  orders: number
  pendingPapers: number
  todayProducts: number
  todayDatasheets: number
  inStock: number
  outOfStock: number
}

type CleanupFilter = 'all' | 'delete' | 'review'

export default function AdminDashboardPage() {
  const { message, modal } = App.useApp()
  const [stats, setStats] = useState<Stats>({
    products: 0,
    shopItems: 0,
    orders: 0,
    pendingPapers: 0,
    todayProducts: 0,
    todayDatasheets: 0,
    inStock: 0,
    outOfStock: 0,
  })
  const [loading, setLoading] = useState(true)
  const [adminRole, setAdminRole] = useState<string>('admin')

  // Storage cleanup state
  const [cleaning, setCleaning] = useState(false)
  const [cleanupFilter, setCleanupFilter] = useState<CleanupFilter>('all')
  const [cleanupResult, setCleanupResult] = useState<{
    mode: 'preview' | 'delete'
    deleteScope?: 'recommended' | 'all'
    totalFiles: number
    referencedFiles: number
    orphanedFiles: number
    recommendedDeleteFiles?: number
    reviewRequiredFiles?: number
    deletedFiles: number
    deletedByBucket: Record<string, number>
    orphanFiles?: Array<{
      bucket: string
      path: string
      publicUrl: string
      fileName: string
      riskLevel: 'low' | 'medium'
      recommendation: 'delete' | 'review'
      confidence: number
      actionLabel: string
      reason: string
    }>
    orphanPreviewLimit?: number
    checkedReferenceSources?: string[]
    warning?: string
  } | null>(null)

  // Fix slugs state
  const [fixingSlugs, setFixingSlugs] = useState(false)
  const [fixSlugsResult, setFixSlugsResult] = useState<{ fixed: number; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => setAdminRole(d.role || 'admin'))
      .catch(() => {})

    Promise.all([
      fetch('/api/admin/products?pageSize=1').then((r) => r.json()),
      fetch('/api/admin/shop').then((r) => r.json()),
      fetch('/api/admin/orders?limit=1').then((r) => r.json()),
      fetch('/api/admin/citations?status=pending').then((r) => r.json()),
      fetch('/api/admin/dashboard/stats').then((r) => r.json()).catch(() => ({
        todayProducts: 0, todayDatasheets: 0, inStock: 0, outOfStock: 0,
      })),
    ])
      .then(([products, shop, orders, papers, dash]) => {
        setStats({
          products: products.total ?? products.products?.length ?? 0,
          shopItems: shop.items?.length || 0,
          orders: orders.total ?? orders.orders?.length ?? 0,
          pendingPapers: papers.papers?.length || 0,
          todayProducts: dash.todayProducts || 0,
          todayDatasheets: dash.todayDatasheets || 0,
          inStock: dash.inStock || 0,
          outOfStock: dash.outOfStock || 0,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const mainCards = [
    { label: '商品', value: stats.products, href: '/admin/products', icon: <AppstoreOutlined className="text-lg text-blue-600" />, color: 'bg-blue-50' },
    { label: '积分奖品', value: stats.shopItems, href: '/admin/shop', icon: <GiftOutlined className="text-lg text-pink-600" />, color: 'bg-pink-50' },
    { label: '兑换订单', value: stats.orders, href: '/admin/orders', icon: <OrderedListOutlined className="text-lg text-amber-600" />, color: 'bg-amber-50' },
    { label: '待审核论文', value: stats.pendingPapers, href: '/admin/citations', icon: <FileTextOutlined className="text-lg text-emerald-600" />, color: 'bg-emerald-50' },
  ]

  const statCards = [
    { label: '今日上架', value: stats.todayProducts, icon: <RiseOutlined className="text-base text-emerald-600" />, color: 'bg-emerald-50', href: '/admin/products' },
    { label: '今日生成说明书', value: stats.todayDatasheets, icon: <BookOutlined className="text-base text-blue-600" />, color: 'bg-blue-50', href: '/datasheet' },
    { label: '现货库存', value: stats.inStock, icon: <InboxOutlined className="text-base text-sky-600" />, color: 'bg-sky-50', href: '/admin/products' },
    { label: '缺货商品', value: stats.outOfStock, icon: <WarningOutlined className="text-base text-orange-600" />, color: 'bg-orange-50', href: '/admin/products' },
  ]

  const handleCleanupScan = async () => {
    setCleaning(true)
    setCleanupFilter('all')
    try {
      const res = await fetch('/api/admin/storage-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmDelete: false }),
      })
      const data = await res.json()
      if (res.ok) {
        setCleanupResult(data)
      } else {
        message.error('清理失败: ' + (data.error || '未知错误'))
      }
    } catch {
      message.error('清理请求失败')
    } finally {
      setCleaning(false)
    }
  }

  const handleCleanupDelete = () => {
    const recommendedCount = cleanupResult?.recommendedDeleteFiles || 0
    if (!cleanupResult || recommendedCount === 0) return
    modal.confirm({
      title: '删除系统建议文件',
      content: (
        <span style={{ whiteSpace: 'pre-line' }}>
          {`即将删除系统建议可删除的 ${recommendedCount} 个低风险 Storage 文件。\n\n需要人工确认的文件会保留，不会被本次操作删除。此操作不可撤销，是否继续？`}
        </span>
      ),
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setCleaning(true)
        try {
          const res = await fetch('/api/admin/storage-cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmDelete: true, deleteScope: 'recommended' }),
          })
          const data = await res.json()
          if (res.ok) {
            setCleanupResult(data)
          } else {
            message.error('清理失败: ' + (data.error || '未知错误'))
          }
        } catch {
          message.error('清理请求失败')
        } finally {
          setCleaning(false)
        }
      },
    })
  }

  const cleanupFiles = cleanupResult?.orphanFiles || []
  const filteredCleanupFiles = cleanupFiles.filter((file) => {
    if (cleanupFilter === 'all') return true
    return file.recommendation === cleanupFilter
  })

  const handleFixSlugs = async () => {
    setFixingSlugs(true)
    setFixSlugsResult(null)
    try {
      const res = await fetch('/api/admin/products/fix-slugs', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setFixSlugsResult(data)
      } else {
        message.error('修复失败: ' + (data.error || '未知错误'))
      }
    } catch {
      message.error('修复请求失败')
    } finally {
      setFixingSlugs(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={<DashboardOutlined />} title="管理后台" description="概览与快捷入口" />

      {adminRole === 'super' && (
        <Alert
          type="warning"
          showIcon
          icon={<SafetyOutlined />}
          message="超级管理员模式"
          description="您可以访问所有功能，包括管理员管理和系统设置。"
        />
      )}

      {loading ? (
        <>
          <Row gutter={[16, 16]}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Col key={i} xs={12} md={6}>
                <Card loading />
              </Col>
            ))}
          </Row>
          <Row gutter={[16, 16]}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Col key={i} xs={12} md={6}>
                <Card loading />
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {statCards.map((card) => (
              <Col key={card.label} xs={12} md={6}>
                <Link href={card.href}>
                  <Card hoverable>
                    <div className="mb-2 flex items-center justify-between">
                      <div className={`rounded-lg p-1.5 ${card.color}`}>{card.icon}</div>
                      <span className="text-xs text-gray-400">{card.label}</span>
                    </div>
                    <Statistic value={card.value} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }} />
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]}>
            {mainCards.map((card) => (
              <Col key={card.label} xs={12} md={6}>
                <Link href={card.href}>
                  <Card hoverable>
                    <div className="mb-3 flex items-center justify-between">
                      <div className={`rounded-lg p-2 ${card.color}`}>{card.icon}</div>
                      <ArrowRightOutlined className="text-gray-300" />
                    </div>
                    <Statistic value={card.value} valueStyle={{ fontSize: 24, fontWeight: 700, color: '#1f2937' }} />
                    <div className="mt-1 text-xs text-gray-500">{card.label}</div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>

          {adminRole === 'super' && (
            <>
            <Card
              title="存储空间清理"
              extra={
                <Button type="primary" ghost icon={<ScanOutlined />} onClick={handleCleanupScan} loading={cleaning}>
                  {cleaning ? '扫描中...' : '扫描可清理文件'}
                </Button>
              }
            >
              <p className="mt-0 text-xs text-gray-500">先扫描预览，再二次确认删除。默认不会直接清理文件。</p>
              {cleanupResult && (
                <div className="mt-4 space-y-4">
                  <Row gutter={[12, 12]} className="text-center">
                    <Col xs={12} md={4}>
                      <Statistic title="Storage 总文件" value={cleanupResult.totalFiles} />
                    </Col>
                    <Col xs={12} md={4}>
                      <Statistic title="数据库引用数" value={cleanupResult.referencedFiles} valueStyle={{ color: '#059669' }} />
                    </Col>
                    <Col xs={12} md={4}>
                      <Statistic title="疑似未引用" value={cleanupResult.orphanedFiles} valueStyle={{ color: '#d97706' }} />
                    </Col>
                    <Col xs={12} md={4}>
                      <Statistic title="系统建议删除" value={cleanupResult.recommendedDeleteFiles || 0} valueStyle={{ color: '#ea580c' }} />
                    </Col>
                    <Col xs={12} md={4}>
                      <Statistic title="人工确认" value={cleanupResult.reviewRequiredFiles || 0} valueStyle={{ color: '#64748b' }} />
                    </Col>
                    <Col xs={12} md={4}>
                      <Statistic title="本次已删除" value={cleanupResult.deletedFiles} valueStyle={{ color: '#dc2626' }} />
                    </Col>
                  </Row>

                  <Alert
                    type="warning"
                    showIcon
                    message={cleanupResult.warning || '当前仅为扫描结果。'}
                    description="“系统建议删除”主要是临时文件、备份文件等低风险项；“人工确认”会保留，需要管理员确认用途后再处理。如果文件被手工写死在页面、外部链接、富文本内容或新功能字段中，系统可能无法识别。"
                  />

                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">扫描后的操作</p>
                      <p className="mt-1 text-xs text-gray-500">
                        当前可删除 {cleanupResult.recommendedDeleteFiles || 0} 个；需人工确认 {cleanupResult.reviewRequiredFiles || 0} 个。
                      </p>
                    </div>
                    <Space wrap>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={handleCleanupDelete}
                        loading={cleaning}
                        disabled={cleanupResult.mode !== 'preview' || (cleanupResult.recommendedDeleteFiles || 0) === 0}
                        title={(cleanupResult.recommendedDeleteFiles || 0) === 0 ? '当前没有系统建议删除的低风险文件' : '只删除系统建议删除的低风险文件'}
                      >
                        删除系统建议文件
                      </Button>
                      <Button
                        icon={<FileTextOutlined />}
                        onClick={() => setCleanupFilter('review')}
                        disabled={(cleanupResult.reviewRequiredFiles || 0) === 0}
                        title={(cleanupResult.reviewRequiredFiles || 0) === 0 ? '当前没有需要人工确认的文件' : '只查看需要人工确认的文件'}
                      >
                        查看人工确认文件
                      </Button>
                    </Space>
                  </div>

                  {cleanupResult.checkedReferenceSources && (
                    <Collapse
                      ghost
                      size="small"
                      items={[
                        {
                          key: 'sources',
                          label: <span className="text-xs font-medium text-gray-800">本次已检查的引用来源</span>,
                          children: (
                            <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
                              {cleanupResult.checkedReferenceSources.map((source) => (
                                <li key={source}>{source}</li>
                              ))}
                            </ul>
                          ),
                        },
                      ]}
                    />
                  )}

                  {cleanupResult.orphanFiles && cleanupResult.orphanFiles.length > 0 && (
                    <Card
                      size="small"
                      title={
                        <Space wrap>
                          <span className="text-xs font-semibold text-gray-800">疑似未引用文件预览</span>
                          <Segmented
                            size="small"
                            value={cleanupFilter}
                            onChange={(v) => setCleanupFilter(v as CleanupFilter)}
                            options={[
                              { label: '全部', value: 'all' },
                              { label: '建议删除', value: 'delete' },
                              { label: '人工确认', value: 'review' },
                            ]}
                          />
                        </Space>
                      }
                      extra={
                        <span className="text-xs text-gray-500">
                          显示 {filteredCleanupFiles.length} 条，最多返回 {cleanupResult.orphanPreviewLimit || cleanupResult.orphanFiles.length} 条
                        </span>
                      }
                    >
                      <div className="max-h-72 divide-y divide-gray-100 overflow-auto">
                        {filteredCleanupFiles.map((file) => (
                          <div key={`${file.bucket}/${file.path}`} className="py-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <Tag>{file.bucket}</Tag>
                              <Tag color={file.recommendation === 'delete' ? 'green' : 'gold'}>{file.actionLabel}</Tag>
                              <Tag>置信度 {file.confidence}%</Tag>
                              <Typography.Text code className="break-all">{file.path}</Typography.Text>
                              <Typography.Link href={file.publicUrl} target="_blank" rel="noreferrer">
                                打开文件
                              </Typography.Link>
                            </div>
                            <p className="mt-1 text-gray-500">{file.reason}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {cleanupResult.orphanedFiles === 0 && (
                    <Alert
                      type="success"
                      showIcon
                      message="本次扫描没有发现疑似未引用文件，所以删除和人工确认按钮处于不可操作状态。"
                    />
                  )}
                </div>
              )}
            </Card>

            <Card
              title="修复缺失 Slug"
              extra={
                <Popconfirm
                  title="确定为所有缺失 slug 的产品自动生成 slug 吗？"
                  onConfirm={handleFixSlugs}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button type="primary" ghost icon={<ToolOutlined />} loading={fixingSlugs}>
                    {fixingSlugs ? '修复中...' : '一键修复'}
                  </Button>
                </Popconfirm>
              }
            >
              <p className="mt-0 text-xs text-gray-500">为数据库中缺少 slug 的产品自动生成唯一 slug（修复 404）</p>
              {fixSlugsResult && (
                <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-center">
                  <Statistic
                    value={fixSlugsResult.fixed}
                    valueStyle={{ color: '#059669', fontWeight: 700 }}
                    title={<span className="text-xs text-emerald-600">{fixSlugsResult.message}</span>}
                  />
                </div>
              )}
            </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
