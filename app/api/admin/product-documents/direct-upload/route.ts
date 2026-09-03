import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    {
      error: '上传令牌功能已停用。产品说明书现在统一通过网站服务器上传。',
      code: 'DIRECT_UPLOAD_DISABLED',
    },
    { status: 410 }
  )
}
