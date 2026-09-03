import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = process.cwd()
const dryRun = process.argv.includes('--dry-run')

function loadEnvFile(fileName) {
  const filePath = join(root, fileName)
  if (!existsSync(filePath)) return

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) process.env[key] = value
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function sha256(filePath) {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

async function run(bin, args) {
  const { stdout, stderr } = await execFileAsync(bin, args, { cwd: root })
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const databaseUrl =
  process.env.BACKUP_DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL

const assetDirs = [
  'project-materials',
  'data',
  'public/brand',
  'public/images',
  'supabase/migrations',
].filter((dir) => existsSync(join(root, dir)))

const backupRoot = join(root, 'backups')
const backupDir = join(backupRoot, timestamp())
const dbDumpPath = join(backupDir, 'database.dump')
const assetsPath = join(backupDir, 'assets.tgz')
const manifestPath = join(backupDir, 'manifest.json')

if (dryRun) {
  console.log('AIMENG backup dry run')
  console.log(`Database URL: ${databaseUrl ? 'configured' : 'missing'}`)
  console.log(`Asset dirs: ${assetDirs.join(', ') || 'none'}`)
  console.log(`Backup dir: ${relative(root, backupDir)}`)
  process.exit(0)
}

mkdirSync(backupDir, { recursive: true })

const manifest = {
  createdAt: new Date().toISOString(),
  databaseDump: null,
  assetsArchive: null,
  notes: [],
}

if (databaseUrl) {
  await run('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    dbDumpPath,
    databaseUrl,
  ])
  manifest.databaseDump = {
    path: relative(root, dbDumpPath),
    sha256: sha256(dbDumpPath),
  }
} else {
  manifest.notes.push(
    'Database dump skipped: set BACKUP_DATABASE_URL, SUPABASE_DB_URL, or DATABASE_URL.'
  )
}

if (assetDirs.length > 0) {
  await run('tar', ['-czf', assetsPath, ...assetDirs])
  manifest.assetsArchive = {
    path: relative(root, assetsPath),
    sha256: sha256(assetsPath),
    included: assetDirs,
  }
} else {
  manifest.notes.push('Asset archive skipped: no configured asset dirs found.')
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
console.log(`Backup created: ${relative(root, backupDir)}`)
