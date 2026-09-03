import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { DATASHEET_TEMPLATE_DIR, listDatasheetTemplates } from '@/lib/datasheet/templates'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const templates = await listDatasheetTemplates()

  return NextResponse.json({
    directory: DATASHEET_TEMPLATE_DIR,
    templates,
    activeTemplate: templates.find((template) => template.role === 'work_template') || templates[0] || null,
    placeholderReady: templates.some((template) => template.hasPlaceholders && template.role === 'work_template'),
  })
}
