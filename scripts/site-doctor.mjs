import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const baseUrl = process.env.HEALTH_BASE_URL || 'http://localhost:3000'
const reportDir = path.join(process.cwd(), 'reports')
const reportPath = path.join(reportDir, 'site-doctor-latest.md')

const results = []

function nowText() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date())
}

function tail(text, maxLines = 80) {
  const lines = text.trim().split('\n')
  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n')
}

function runCommand(name, command, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })

    child.on('close', (code) => {
      resolve({
        name,
        status: code === 0 ? 'pass' : 'fail',
        code,
        stdout,
        stderr,
      })
    })
  })
}

async function canReach(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'user-agent': 'aimeng-site-doctor/1.0' },
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function suggestFixes() {
  const suggestions = []
  const build = results.find((result) => result.name === 'production build')
  const health = results.find((result) => result.name === 'public route health')
  const skippedHealth = results.find((result) => result.name === 'public route health' && result.status === 'skip')

  if (build?.status === 'fail') {
    suggestions.push('生产构建失败：优先修复 Next.js 编译、TypeScript 或依赖错误，暂缓发布。')
  }

  if (health?.status === 'fail') {
    suggestions.push('网页体检失败：根据报告中的页面路径逐个修复，重点看导航不一致、前台暴露后台入口、每日知识缺失。')
  }

  if (skippedHealth) {
    suggestions.push(`网页体检跳过：先运行 npm run dev，确认 ${baseUrl} 可访问后，再执行 HEALTH_BASE_URL=${baseUrl} npm run doctor。`)
  }

  if (suggestions.length === 0) {
    suggestions.push('当前自动体检通过，可以继续做功能迭代或发布前复查。')
  }

  return suggestions
}

async function writeReport() {
  const failed = results.some((result) => result.status === 'fail')
  const skipped = results.some((result) => result.status === 'skip')
  const status = failed ? '失败' : skipped ? '部分通过' : '通过'

  const sections = results
    .map((result) => {
      const body = result.status === 'skip'
        ? result.message
        : [
            result.stderr ? `stderr:\n\n\`\`\`text\n${tail(result.stderr)}\n\`\`\`` : '',
            result.stdout ? `stdout:\n\n\`\`\`text\n${tail(result.stdout)}\n\`\`\`` : '',
          ].filter(Boolean).join('\n\n')

      return `## ${result.name}\n\n状态：${result.status}\n\n${body || '无输出。'}`
    })
    .join('\n\n')

  const report = `# AIMENG 网站自动体检报告

生成时间：${nowText()}

总体状态：${status}

检测地址：${baseUrl}

## 修复建议

${suggestFixes().map((item) => `- ${item}`).join('\n')}

${sections}
`

  await mkdir(reportDir, { recursive: true })
  await writeFile(reportPath, report, 'utf8')
  console.log(`\nDoctor report written to ${reportPath}`)
}

console.log('AIMENG site doctor')
console.log(`Base URL: ${baseUrl}\n`)

results.push(await runCommand('production build', 'npm', ['run', 'build']))

if (await canReach(baseUrl)) {
  results.push(await runCommand('public route health', 'npm', ['run', 'health'], {
    HEALTH_BASE_URL: baseUrl,
  }))
} else {
  const message = `${baseUrl} is not reachable. Start the dev server or set HEALTH_BASE_URL to a deployed site.`
  console.warn(message)
  results.push({
    name: 'public route health',
    status: 'skip',
    message,
  })
}

await writeReport()

if (results.some((result) => result.status === 'fail')) {
  process.exit(1)
}
