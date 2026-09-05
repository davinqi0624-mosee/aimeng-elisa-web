'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Empty, Row, Spin, Statistic, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FileZipOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

type CheckStatus = 'pass' | 'warn' | 'fail'

interface CheckResult {
  key: string
  label: string
  status: CheckStatus
  message: string
  latencyMs?: number
}

interface HealthPayload {
  generatedAt: string
  summary: { pass: number; warn: number; fail: number }
  checks: CheckResult[]
}

interface BackupPayload {
  generatedAt: string
  status: {
    scriptExists: boolean
    databaseUrlConfigured: boolean
    externalStorageConfigured: boolean
    runningOnVercel: boolean
    cronConfigured: boolean
  }
  localBackups: Array<{
    name: string
    path: string
    createdAt: string
    sizeBytes: number
  }>
  notes: string[]
}

const STATUS_META: Record<CheckStatus, { color: string; label: string }> = {
  pass: { color: 'green', label: '通过' },
  warn: { color: 'gold', label: '警告' },
  fail: { color: 'volcano', label: '失败' },
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircleOutlined />
  if (status === 'warn') return <ExclamationCircleOutlined />
  return <CloseCircleOutlined />
}

function formatTime(value?: string) {
  if (!value) return '尚未运行'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value))
}

export default function AdminMaintenancePage() {
  const [role, setRole] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [backup, setBackup] = useState<BackupPayload | null>(null)
  const [runningHealth, setRunningHealth] = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)
  const [backupDryRun, setBackupDryRun] = useState<string | null>(null)

  const overallStatus = useMemo<CheckStatus>(() => {
    if (!health) return 'warn'
    if (health.summary.fail > 0) return 'fail'
    if (health.summary.warn > 0) return 'warn'
    return 'pass'
  }, [health])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/me').then((r) => r.json()),
      fetch('/api/admin/maintenance/backups').then((r) => r.json()),
    ])
      .then(([me, backupData]) => {
        setRole(me.role || null)
        if (!backupData.error) setBackup(backupData)
      })
      .finally(() => setBooting(false))
  }, [])

  async function runHealthCheck() {
    setRunningHealth(true)
    try {
      const response = await fetch('/api/admin/maintenance/health', { method: 'POST' })
      const data = await response.json()
      setHealth(data)
    } finally {
      setRunningHealth(false)
    }
  }

  async function refreshBackups() {
    const response = await fetch('/api/admin/maintenance/backups')
    const data = await response.json()
    if (!data.error) setBackup(data)
  }

  async function runBackupPreflight() {
    setRunningBackup(true)
    setBackupDryRun(null)
    try {
      const response = await fetch('/api/admin/maintenance/backups', { method: 'POST' })
      const data = await response.json()
      setBackupDryRun([data.stdout, data.stderr].filter(Boolean).join('\n') || '备份预检完成。')
      await refreshBackups()
    } finally {
      setRunningBackup(false)
    }
  }

  const checkColumns: ColumnsType<CheckResult> = [
    {
      title: '检查项',
      dataIndex: 'label',
      key: 'label',
      width: 180,
      render: (label: string) => <span className="font-medium text-slate-700">{label}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: CheckStatus) => (
        <Tag color={STATUS_META[status].color} icon={<StatusIcon status={status} />}>
          {STATUS_META[status].label}
        </Tag>
      ),
    },
    {
      title: '详情',
      dataIndex: 'message',
      key: 'message',
      render: (msg: string) => <span className="text-slate-500">{msg}</span>,
    },
    {
      title: '耗时',
      dataIndex: 'latencyMs',
      key: 'latencyMs',
      width: 90,
      render: (latencyMs?: number) => (
        <span className="text-xs text-slate-500">{latencyMs ? `${latencyMs} ms` : '-'}</span>
      ),
    },
  ]

  if (booting) {
    return (
      <div className="flex justify-center py-12">
        <Spin />
      </div>
    )
  }

  if (role !== 'super') {
    return (
      <div className="py-12">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="仅超级管理员可访问运维中心" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        icon={<ToolOutlined />}
        title="运维中心"
        description="超级管理员专用：巡检、备份预检、恢复状态"
        extra={
          <Tag
            color={STATUS_META[overallStatus].color}
            icon={<StatusIcon status={overallStatus} />}
            style={{ fontSize: 14, lineHeight: '26px', padding: '0 10px' }}
          >
            {health
              ? `通过 ${health.summary.pass} / 警告 ${health.summary.warn} / 失败 ${health.summary.fail}`
              : '等待巡检'}
          </Tag>
        }
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic
              title="权限"
              value="超级管理员"
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic
              title="最近巡检"
              value={formatTime(health?.generatedAt)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic
              title="备份状态"
              value={backup?.status.databaseUrlConfigured ? '本地脚本可导库' : '待配置数据库连接'}
              prefix={<DatabaseOutlined />}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className="mb-6"
        title={
          <div className="flex items-center gap-2">
            <ToolOutlined />
            一键巡检
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={runningHealth}
            onClick={runHealthCheck}
          >
            运行巡检
          </Button>
        }
      >
        <p className="mb-4 text-sm text-slate-500">检查 AI、数据库、关键页面和知识接口</p>
        <Table<CheckResult>
          rowKey="key"
          columns={checkColumns}
          dataSource={health?.checks || []}
          loading={runningHealth}
          pagination={false}
          locale={{ emptyText: '点击“运行巡检”后显示结果' }}
        />
      </Card>

      <Card
        title={
          <div className="flex items-center gap-2">
            <FileZipOutlined />
            备份与恢复
          </div>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            loading={runningBackup}
            onClick={runBackupPreflight}
          >
            备份预检
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div className="space-y-3">
              {backup && [
                ['备份脚本', backup.status.scriptExists],
                ['数据库连接', backup.status.databaseUrlConfigured],
                ['外部对象存储', backup.status.externalStorageConfigured],
                ['自动定时备份', backup.status.cronConfigured],
              ].map(([label, ok]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <span className="text-sm text-slate-700">{label as string}</span>
                  <Tag color={ok ? 'green' : 'gold'} icon={ok ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}>
                    {ok ? '已就绪' : '待配置'}
                  </Tag>
                </div>
              ))}
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div className="h-full rounded-md border border-gray-100 p-3">
              <h3 className="text-sm font-medium text-slate-700">最近本地备份</h3>
              <div className="mt-3 space-y-2">
                {backup?.localBackups.length ? backup.localBackups.map((item) => (
                  <div key={item.path} className="text-xs text-slate-500">
                    <span className="text-slate-700">{item.name}</span>
                    <span className="ml-2">{formatTime(item.createdAt)}</span>
                  </div>
                )) : (
                  <p className="text-sm text-slate-400">暂无本地备份记录</p>
                )}
              </div>
            </div>
          </Col>
        </Row>

        {backupDryRun && (
          <pre className="mt-4 max-h-44 overflow-auto rounded-md border border-gray-100 bg-gray-50 p-3 text-xs text-slate-600">
            {backupDryRun}
          </pre>
        )}

        <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-slate-500">
          <p className="font-medium text-slate-700">恢复入口</p>
          <p className="mt-1">生产环境恢复会在这里选择干净备份，依次恢复数据库、文件资产、环境变量和健康检查。目前先显示备份准备状态，正式云备份接入后启用一键恢复流程。</p>
        </div>
      </Card>
    </div>
  )
}
