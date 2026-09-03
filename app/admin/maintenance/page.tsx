'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  FileArchive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react'

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

function statusStyle(status: CheckStatus) {
  if (status === 'pass') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  return 'border-red-500/30 bg-red-500/10 text-red-300'
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4" />
  if (status === 'warn') return <AlertTriangle className="w-4 h-4" />
  return <XCircle className="w-4 h-4" />
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

  if (booting) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (role !== 'super') {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className="text-sm text-slate-400">仅超级管理员可访问运维中心</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-300" />
            运维中心
          </h1>
          <p className="text-sm text-slate-400 mt-1">超级管理员专用：巡检、备份预检、恢复状态</p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${statusStyle(overallStatus)}`}>
          <StatusIcon status={overallStatus} />
          {health ? `通过 ${health.summary.pass} / 警告 ${health.summary.warn} / 失败 ${health.summary.fail}` : '等待巡检'}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            权限
          </div>
          <p className="mt-3 text-xl font-semibold text-white">超级管理员</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock3 className="w-4 h-4 text-cyan-300" />
            最近巡检
          </div>
          <p className="mt-3 text-xl font-semibold text-white">{formatTime(health?.generatedAt)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <DatabaseBackup className="w-4 h-4 text-amber-300" />
            备份状态
          </div>
          <p className="mt-3 text-xl font-semibold text-white">
            {backup?.status.databaseUrlConfigured ? '本地脚本可导库' : '待配置数据库连接'}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-cyan-300" />
              一键巡检
            </h2>
            <p className="text-sm text-slate-400 mt-1">检查 AI、数据库、关键页面和知识接口</p>
          </div>
          <button
            onClick={runHealthCheck}
            disabled={runningHealth}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningHealth ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            运行巡检
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          {(health?.checks || []).map((item) => (
            <div key={item.key} className="grid gap-3 p-4 md:grid-cols-[180px_110px_1fr_90px] md:items-center">
              <div className="text-sm font-medium text-slate-200">{item.label}</div>
              <div className={`inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-xs ${statusStyle(item.status)}`}>
                <StatusIcon status={item.status} />
                {item.status === 'pass' ? '通过' : item.status === 'warn' ? '警告' : '失败'}
              </div>
              <div className="text-sm text-slate-400">{item.message}</div>
              <div className="text-xs text-slate-500">{item.latencyMs ? `${item.latencyMs} ms` : '-'}</div>
            </div>
          ))}
          {!health && (
            <div className="p-8 text-center text-sm text-slate-500">点击“运行巡检”后显示结果</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <FileArchive className="w-5 h-5 text-amber-300" />
              备份与恢复
            </h2>
            <p className="text-sm text-slate-400 mt-1">查看备份条件、预检脚本和恢复准备状态</p>
          </div>
          <button
            onClick={runBackupPreflight}
            disabled={runningBackup}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            备份预检
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="space-y-3">
            {backup && [
              ['备份脚本', backup.status.scriptExists],
              ['数据库连接', backup.status.databaseUrlConfigured],
              ['外部对象存储', backup.status.externalStorageConfigured],
              ['自动定时备份', backup.status.cronConfigured],
            ].map(([label, ok]) => (
              <div key={label as string} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
                <span className="text-sm text-slate-300">{label as string}</span>
                <span className={`inline-flex items-center gap-1 text-xs ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {ok ? '已就绪' : '待配置'}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <h3 className="text-sm font-medium text-slate-200">最近本地备份</h3>
            <div className="mt-3 space-y-2">
              {backup?.localBackups.length ? backup.localBackups.map((item) => (
                <div key={item.path} className="text-xs text-slate-400">
                  <span className="text-slate-200">{item.name}</span>
                  <span className="ml-2">{formatTime(item.createdAt)}</span>
                </div>
              )) : (
                <p className="text-sm text-slate-500">暂无本地备份记录</p>
              )}
            </div>
          </div>
        </div>

        {backupDryRun && (
          <pre className="mx-4 mb-4 max-h-44 overflow-auto rounded-md border border-slate-800 bg-black p-3 text-xs text-slate-300">
            {backupDryRun}
          </pre>
        )}

        <div className="border-t border-slate-800 p-4 text-sm text-slate-400">
          <p className="font-medium text-slate-300">恢复入口</p>
          <p className="mt-1">生产环境恢复会在这里选择干净备份，依次恢复数据库、文件资产、环境变量和健康检查。目前先显示备份准备状态，正式云备份接入后启用一键恢复流程。</p>
        </div>
      </section>
    </div>
  )
}
