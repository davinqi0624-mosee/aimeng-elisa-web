const baseUrl = process.env.HEALTH_BASE_URL || 'http://localhost:3000'

const publicRoutes = [
  '/',
  '/search',
  '/products',
  '/products/elisa',
  '/products/serum',
  '/products/fbs',
  '/products/fbs/standard-fbs',
  '/products/animal-serum',
  '/products/animal-serum/horse-serum',
  '/products/biochemical-reagents',
  '/products/coa',
  '/chat',
  '/lab/analysis',
  '/lab/calculator',
  '/lab/experiment',
  '/knowledge',
  '/citations',
  '/store',
  '/points',
  '/community',
  '/contact',
  '/login',
  '/register',
]

const apiRoutes = [
  '/api/knowledge/daily?all=true',
  '/api/shop/items',
  '/api/agents',
  '/api/citations/stats',
]

const requiredHomeText = ['AI中心', '产品中心', '实验工具', '知识社区', '积分商城', '联系我们']
const requiredNavText = [
  'AI中心',
  '产品中心',
  '实验工具',
  '知识社区',
  '积分商城',
  '联系我们',
]
const forbiddenPublicText = ['生成试剂盒说明书', '仅管理员可生成说明书']

const failures = []
const warnings = []

async function fetchText(path) {
  const url = new URL(path, baseUrl)
  const response = await fetch(url, {
    headers: {
      'user-agent': 'aimeng-health-check/1.0',
    },
  })
  const text = await response.text()
  return { url: url.toString(), response, text }
}

function recordFailure(message) {
  failures.push(message)
  console.error(`✗ ${message}`)
}

function recordWarning(message) {
  warnings.push(message)
  console.warn(`! ${message}`)
}

function getShanghaiDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function currentMonthPrefix() {
  const parts = getShanghaiDateParts()
  return `${parts.year}-${parts.month}`
}

function validateDailyKnowledge(route, text) {
  let payload

  try {
    payload = JSON.parse(text)
  } catch {
    recordWarning(`${route} returned non-JSON response`)
    return
  }

  const items = Array.isArray(payload?.items) ? payload.items : []
  const monthPrefix = currentMonthPrefix()
  const currentMonthItems = items.filter((item) => {
    const date = item?.date || item?.publish_date || item?.created_at
    return typeof date === 'string' && date.startsWith(monthPrefix)
  })

  if (items.length === 0) {
    recordFailure(`${route} returned no daily knowledge items`)
    return
  }

  if (currentMonthItems.length === 0) {
    recordFailure(`${route} has no daily knowledge items for ${monthPrefix}`)
  }
}

console.log(`AIMENG health check: ${baseUrl}`)

for (const route of publicRoutes) {
  try {
    const { response, text } = await fetchText(route)

    if (!response.ok) {
      recordFailure(`${route} returned ${response.status}`)
      continue
    }

    for (const forbidden of forbiddenPublicText) {
      if (text.includes(forbidden)) {
        recordFailure(`${route} exposes forbidden public text: ${forbidden}`)
      }
    }

    for (const label of requiredNavText) {
      if (!text.includes(label)) {
        recordFailure(`${route} is missing shared navigation label: ${label}`)
      }
    }

    if (route === '/') {
      for (const label of requiredHomeText) {
        if (!text.includes(label)) {
          recordFailure(`/ is missing navigation label: ${label}`)
        }
      }
    }

    console.log(`✓ ${route}`)
  } catch (error) {
    recordFailure(`${route} failed: ${error.message}`)
  }
}

for (const route of apiRoutes) {
  try {
    const { response, text } = await fetchText(route)
    if (!response.ok) {
      recordWarning(`${route} returned ${response.status}: ${text.slice(0, 160)}`)
      continue
    }

    if (route.startsWith('/api/knowledge/daily')) {
      validateDailyKnowledge(route, text)
    }

    console.log(`✓ ${route}`)
  } catch (error) {
    recordWarning(`${route} failed: ${error.message}`)
  }
}

console.log('')
console.log(`Checked ${publicRoutes.length} pages and ${apiRoutes.length} APIs.`)

if (warnings.length > 0) {
  console.log(`${warnings.length} warning(s).`)
}

if (failures.length > 0) {
  console.error(`${failures.length} failure(s).`)
  process.exit(1)
}

console.log('Health check passed.')
