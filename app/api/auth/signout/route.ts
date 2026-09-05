import { NextResponse } from 'next/server'
import { clearUserCookie } from '@/lib/user-auth'

export async function POST() {
  await clearUserCookie()
  return NextResponse.json({ success: true })
}
