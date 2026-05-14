import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'

const DEFAULT_PAGES = [
  {
    id: 'home',
    slug: '/',
    title: '首页',
    blocks: [],
    is_published: true,
  },
  {
    id: 'products',
    slug: '/products',
    title: '产品',
    blocks: [],
    is_published: true,
  },
  {
    id: 'ai-chat',
    slug: '/ai-chat',
    title: 'AI客服',
    blocks: [],
    is_published: true,
  },
  {
    id: 'knowledge',
    slug: '/knowledge',
    title: '每日知识',
    blocks: [],
    is_published: true,
  },
  {
    id: 'papers',
    slug: '/papers',
    title: '文献引用',
    blocks: [],
    is_published: true,
  },
  {
    id: 'points-mall',
    slug: '/points-mall',
    title: '积分商城',
    blocks: [],
    is_published: true,
  },
  {
    id: 'contact',
    slug: '/contact',
    title: '联系我们',
    blocks: [],
    is_published: true,
  },
]

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()

  // Insert pages, skipping existing slugs
  const results: Array<{ slug: string; status: string }> = []

  for (const page of DEFAULT_PAGES) {
    const { error } = await supabase.from('pages').upsert(page, {
      onConflict: 'slug',
      ignoreDuplicates: true,
    })

    if (error) {
      results.push({ slug: page.slug, status: error.message })
    } else {
      results.push({ slug: page.slug, status: 'created' })
    }
  }

  return NextResponse.json({ success: true, results })
}
