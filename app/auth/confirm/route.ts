import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardRegistrationBonus } from '@/lib/points/registration-bonus'

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://animaluni.com').replace(/\/$/, '')

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

function safeOtpType(value: string | null): EmailOtpType | null {
  if (
    value === 'signup' ||
    value === 'invite' ||
    value === 'magiclink' ||
    value === 'recovery' ||
    value === 'email_change' ||
    value === 'email'
  ) {
    return value
  }
  return null
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = safeOtpType(requestUrl.searchParams.get('type'))
  const next = safeNextPath(requestUrl.searchParams.get('next'))
  const redirectUrl = new URL(next, SITE_ORIGIN)

  if (!tokenHash || !type) {
    redirectUrl.searchParams.set('auth_error', 'missing_token')
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = await createClient()
  const { data: verifiedData, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (!error && type === 'signup' && verifiedData.user?.id) {
    try {
      await awardRegistrationBonus(createAdminClient(), verifiedData.user.id)
    } catch (bonusError) {
      console.error('[auth/confirm] registration bonus failed', bonusError)
    }
  }

  if (error) {
    redirectUrl.searchParams.set('auth_error', error.message || 'verify_failed')
  }

  return NextResponse.redirect(redirectUrl)
}
