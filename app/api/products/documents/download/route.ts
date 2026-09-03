import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_HOSTS = new Set([
  'xzttqwcahwkfddzijqiu.supabase.co',
  'animaluni.com',
  'www.animaluni.com',
  'localhost',
  '127.0.0.1',
])

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function safeFileName(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'AIMENG-document.pdf'
}

function getFallbackFileName(url: URL) {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '')
  return safeFileName(last || 'AIMENG-document.pdf')
}

function resolveDocumentUrl(request: NextRequest, rawUrl: string) {
  if (rawUrl.startsWith('/')) {
    const localPort = process.env.PORT || '3000'
    return new URL(rawUrl, `http://127.0.0.1:${localPort}`)
  }
  return new URL(rawUrl)
}

export async function GET(request: NextRequest) {
  const rawUrl = clean(request.nextUrl.searchParams.get('url'))
  const rawName = clean(request.nextUrl.searchParams.get('name'))

  if (!rawUrl) {
    return NextResponse.json({ error: '缺少文档地址' }, { status: 400 })
  }

  let documentUrl: URL
  try {
    documentUrl = resolveDocumentUrl(request, rawUrl)
  } catch {
    return NextResponse.json({ error: '文档地址无效' }, { status: 400 })
  }

  if (!['https:', 'http:'].includes(documentUrl.protocol)) {
    return NextResponse.json({ error: '文档协议不支持' }, { status: 400 })
  }

  if (!ALLOWED_HOSTS.has(documentUrl.hostname)) {
    return NextResponse.json({ error: '文档来源不允许下载' }, { status: 403 })
  }

  try {
    const upstream = await fetch(documentUrl, {
      headers: { 'user-agent': 'aimeng-document-download/1.0' },
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `文档读取失败 HTTP ${upstream.status}` }, { status: 502 })
    }

    const fileName = safeFileName(rawName || getFallbackFileName(documentUrl))
    const contentType = upstream.headers.get('content-type') || 'application/pdf'
    const contentLength = upstream.headers.get('content-length')
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    })
    if (contentLength) headers.set('Content-Length', contentLength)

    return new NextResponse(upstream.body, { headers })
  } catch (error) {
    console.error('[product-document-download]', error)
    return NextResponse.json({ error: '文档下载失败，请稍后重试' }, { status: 500 })
  }
}
