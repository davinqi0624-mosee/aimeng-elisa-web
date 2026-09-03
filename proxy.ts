import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)
  const { pathname } = request.nextUrl

  // This is only an optimistic page guard. API routes still perform the
  // authoritative JWT and active-account checks on the server.
  if (
    (pathname === '/admin' || pathname.startsWith('/admin/')) &&
    pathname !== '/admin/login' &&
    !request.cookies.get('admin_session')?.value
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/admin/login'
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
