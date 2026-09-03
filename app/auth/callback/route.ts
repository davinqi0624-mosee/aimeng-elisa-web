import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardRegistrationBonus } from '@/lib/points/registration-bonus'

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://animaluni.com').replace(/\/$/, '')

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = safeNextPath(requestUrl.searchParams.get('next'))
  const redirectUrl = new URL(next, SITE_ORIGIN)

  if (!code) {
    redirectUrl.searchParams.set('auth_error', 'missing_code')
    return NextResponse.redirect(redirectUrl)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    redirectUrl.searchParams.set('auth_error', error.message || 'exchange_failed')
  } else {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id && user.email_confirmed_at) {
        await awardRegistrationBonus(createAdminClient(), user.id)
      }
    } catch (bonusError) {
      console.error('[auth/callback] registration bonus failed', bonusError)
    }
  }

  return NextResponse.redirect(redirectUrl)
}
