import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_TEMPLATE = {
  url: '/downloads/AM-ELISA数据分析模板.xlsx',
  name: 'AM-ELISA数据分析模板.xlsx',
}

const TEMPLATE_VERSION = '20260722-input-template-5-columns'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function withTemplateVersion(url: string) {
  if (!url.startsWith('/downloads/AM-ELISA数据分析模板.xlsx')) return url
  const separator = url.includes('?') ? '&' : '?'
  return encodeURI(`${url}${separator}v=${TEMPLATE_VERSION}`)
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('site_settings')
      .select('lab_assets')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      console.warn('[lab/analysis/template] fallback to static template:', error.message)
      return NextResponse.json({
        template: { ...DEFAULT_TEMPLATE, url: withTemplateVersion(DEFAULT_TEMPLATE.url) },
        fallback: true,
      })
    }

    const labAssets = (data?.lab_assets || {}) as {
      elisa_analysis_template_url?: string
      elisa_analysis_template_name?: string
    }
    const url = clean(labAssets.elisa_analysis_template_url) || DEFAULT_TEMPLATE.url
    const name = clean(labAssets.elisa_analysis_template_name) || url.split('/').pop() || DEFAULT_TEMPLATE.name

    return NextResponse.json({ template: { url: withTemplateVersion(url), name } })
  } catch (error) {
    console.warn('[lab/analysis/template] fallback to static template:', error)
    return NextResponse.json({
      template: { ...DEFAULT_TEMPLATE, url: withTemplateVersion(DEFAULT_TEMPLATE.url) },
      fallback: true,
    })
  }
}
