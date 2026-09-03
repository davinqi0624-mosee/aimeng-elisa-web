import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const host = process.env.ALIYUN_HOST || '106.14.215.238'
const user = process.env.ALIYUN_USER || 'root'
const key = process.env.ALIYUN_KEY || '/Users/moses/aimeng-elisa-web/爱萌优宁.pem'
const remoteRoot = process.env.ALIYUN_APP_ROOT || '/opt/aimeng-elisa-web'
const service = process.env.ALIYUN_SERVICE || 'aimeng-elisa-web'
const publicUrl = process.env.ALIYUN_PUBLIC_URL || 'https://animaluni.com'
const remote = `${user}@${host}`
const sshBase = ['-i', key, '-o', 'StrictHostKeyChecking=no']

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function ssh(script) {
  run('ssh', [...sshBase, remote, script])
}

function rsync(source, target) {
  run('rsync', [
    '-az',
    '--delete',
    '-e',
    `ssh ${sshBase.join(' ')}`,
    source,
    `${remote}:${target}`,
  ])
}

if (!existsSync(key)) {
  console.error(`SSH key not found: ${key}`)
  process.exit(1)
}

if (process.env.SKIP_BUILD !== 'true') {
  run('npm', ['run', 'build'])
}

if (!existsSync('.next/standalone/server.js')) {
  console.error('Missing .next/standalone/server.js. Run npm run build first.')
  process.exit(1)
}

if (!existsSync('.next/static')) {
  console.error('Missing .next/static. Run npm run build first.')
  process.exit(1)
}

ssh([
  'set -e',
  `rm -rf ${remoteRoot}/app.next`,
  `mkdir -p ${remoteRoot}/app.next/.next/static ${remoteRoot}/app.next/public`,
  `chown -R nextjs:nextjs ${remoteRoot}/app.next`,
].join('; '))

rsync('.next/standalone/', `${remoteRoot}/app.next/`)
rsync('.next/static/', `${remoteRoot}/app.next/.next/static/`)

if (existsSync('public')) {
  rsync('public/', `${remoteRoot}/app.next/public/`)
}

ssh([
  'set -e',
  'ts=$(date +%Y%m%d%H%M%S)',
  `systemctl stop ${service}`,
  `[ -d ${remoteRoot}/app ] && mv ${remoteRoot}/app ${remoteRoot}/app.prev.$ts || true`,
  `mv ${remoteRoot}/app.next ${remoteRoot}/app`,
  `chown -R nextjs:nextjs ${remoteRoot}/app`,
  `systemctl start ${service}`,
  'sleep 3',
  `systemctl status ${service} --no-pager -l | sed -n "1,80p"`,
  'ss -ltnp | grep -E ":3000|:80" || true',
  // Keep a short rollback window without allowing app.prev.* to grow forever.
  `cutoff=$(date -d "3 days ago" +%Y%m%d%H%M%S); for path in ${remoteRoot}/app.prev.*; do [ -d "$path" ] || continue; stamp=$(basename "$path" | sed "s/^app\\.prev\\.//"); if [ "$stamp" \< "$cutoff" ]; then rm -rf -- "$path"; fi; done`,
].join('; '))

const healthEnv = {
  ...process.env,
  HEALTH_BASE_URL: publicUrl,
}
run('node', [path.join('scripts', 'health-check.mjs')], { env: healthEnv })

console.log(`\nDeployment complete: ${publicUrl}`)
