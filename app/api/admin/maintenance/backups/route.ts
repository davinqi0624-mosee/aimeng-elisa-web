import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { requireSuper } from '@/lib/admin/auth'

interface BackupInfo {
  name: string
  path: string
  createdAt: string
  sizeBytes: number
}

function hasRealValue(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && !normalized.includes('your-') && !normalized.includes('placeholder')
}

function listLocalBackups(): BackupInfo[] {
  const root = process.cwd()
  const backupRoot = join(root, 'backups')
  if (!existsSync(backupRoot)) return []

  return readdirSync(backupRoot)
    .map((name) => {
      const dir = join(backupRoot, name)
      const stat = statSync(dir)
      return {
        name,
        path: relative(root, dir),
        createdAt: stat.birthtime.toISOString(),
        sizeBytes: stat.size,
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12)
}

export async function GET(request: NextRequest) {
  const { error } = await requireSuper(request)
  if (error) return error

  const localBackupReady = hasRealValue(process.env.BACKUP_DATABASE_URL) ||
    hasRealValue(process.env.SUPABASE_DB_URL) ||
    hasRealValue(process.env.DATABASE_URL)

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    status: {
      scriptExists: existsSync(join(process.cwd(), 'scripts/backup-supabase.mjs')),
      databaseUrlConfigured: localBackupReady,
      externalStorageConfigured: hasRealValue(process.env.BACKUP_STORAGE_BUCKET) || hasRealValue(process.env.S3_BUCKET),
      runningOnVercel: process.env.VERCEL === '1',
      cronConfigured: false,
    },
    localBackups: listLocalBackups(),
    notes: [
      '本地备份脚本已就绪，可导出数据库并打包关键资料目录。',
      'Vercel 生产环境文件系统是临时的，正式自动备份应写入对象存储或国内云服务器。',
      '恢复操作需要先选择干净备份，再恢复数据库、文件资产和环境变量。',
    ],
  })
}

export async function POST(request: NextRequest) {
  const { error } = await requireSuper(request)
  if (error) return error

  const scriptExists = existsSync(join(process.cwd(), 'scripts/backup-supabase.mjs'))
  const databaseUrlConfigured = hasRealValue(process.env.BACKUP_DATABASE_URL) ||
    hasRealValue(process.env.SUPABASE_DB_URL) ||
    hasRealValue(process.env.DATABASE_URL)
  const externalStorageConfigured = hasRealValue(process.env.BACKUP_STORAGE_BUCKET) || hasRealValue(process.env.S3_BUCKET)

  const lines = [
    'AIMENG backup preflight',
    `Script: ${scriptExists ? 'ready' : 'missing'}`,
    `Database URL: ${databaseUrlConfigured ? 'configured' : 'missing'}`,
    `External storage: ${externalStorageConfigured ? 'configured' : 'missing'}`,
    `Runtime: ${process.env.VERCEL === '1' ? 'vercel' : 'local/server'}`,
    '',
    databaseUrlConfigured
      ? 'Local command is available: npm run backup'
      : 'Set BACKUP_DATABASE_URL, SUPABASE_DB_URL, or DATABASE_URL before exporting database backups.',
    externalStorageConfigured
      ? 'Cloud storage target is configured.'
      : 'Production auto-backup needs object storage or a domestic server backup target.',
  ]

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    status: scriptExists ? 'pass' : 'fail',
    stdout: lines.join('\n'),
    stderr: '',
  }, { status: scriptExists ? 200 : 500 })
}
