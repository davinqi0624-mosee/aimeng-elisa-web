import { NextRequest } from 'next/server'

type TurnstileVerifyResponse = {
  success?: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
}

export type TurnstileVerificationResult = {
  ok: boolean
  skipped: boolean
  error?: string
  errorCodes?: string[]
}

type TurnstileOptions = {
  required?: boolean
  action?: string
  allowedHostnames?: string[]
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isTurnstileEnabled() {
  return Boolean(clean(process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY))
}

export function getRequestIp(request: NextRequest) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  )
}

export async function verifyTurnstileToken(
  request: NextRequest,
  token: unknown,
  options: TurnstileOptions = {},
): Promise<TurnstileVerificationResult> {
  const secret = clean(process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY)

  if (!secret) {
    if (options.required) {
      return { ok: false, skipped: false, error: '人机验证服务尚未配置，请联系管理员' }
    }
    return { ok: true, skipped: true }
  }

  const responseToken = clean(token)
  if (!responseToken) {
    return { ok: false, skipped: false, error: '请完成人机验证' }
  }

  const formData = new FormData()
  formData.append('secret', secret)
  formData.append('response', responseToken)

  const remoteIp = getRequestIp(request)
  if (remoteIp) formData.append('remoteip', remoteIp)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })
    const data = (await response.json()) as TurnstileVerifyResponse

    if (!response.ok || !data.success) {
      return {
        ok: false,
        skipped: false,
        error: '人机验证失败，请刷新后重试',
        errorCodes: data['error-codes'] || [],
      }
    }

    if (options.action && data.action && data.action !== options.action) {
      return { ok: false, skipped: false, error: '人机验证场景不匹配，请刷新后重试' }
    }

    const hostnames = options.allowedHostnames || ['animaluni.com', 'www.animaluni.com']
    if (data.hostname && !hostnames.includes(data.hostname)) {
      return { ok: false, skipped: false, error: '人机验证域名不匹配，请刷新后重试' }
    }

    return { ok: true, skipped: false }
  } catch (error) {
    console.error('[turnstile] verification failed', error)
    return { ok: false, skipped: false, error: '人机验证服务暂时不可用，请稍后重试' }
  }
}
