import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: '旧论文审核接口已停用，请使用后台“文献引用审核”流程。' },
    { status: 410 }
  )
}
