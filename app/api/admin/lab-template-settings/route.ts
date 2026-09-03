import { NextRequest, NextResponse } from 'next/server'
import { requireSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type LabAssetsSettings = {
  elisa_analysis_template_url?: string
  elisa_analysis_template_name?: string
  elisa_analysis_template_uploaded_at?: string
  elisa_testing_service_form_url?: string
  elisa_testing_service_form_name?: string
  elisa_testing_service_form_uploaded_at?: string
}

const DEFAULT_SETTINGS = {
  id: 1,
  lab_assets: {
    elisa_analysis_template_url: '/downloads/AM-ELISA数据分析模板.xlsx',
    elisa_analysis_template_name: 'AM-ELISA数据分析模板.xlsx',
    elisa_testing_service_form_url: '/downloads/AMUN-ELISA-testing-service-form.docx',
    elisa_testing_service_form_name: 'AMUN Elisa实验代测表.docx',
  },
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isMissingLabAssets(message?: string) {
  return Boolean(
    message?.includes('site_settings') &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('lab_assets'))
  )
}

function normalizeSettings(value: unknown): LabAssetsSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS.lab_assets
  const settings = value as LabAssetsSettings
  const templateUrl = clean(settings.elisa_analysis_template_url) || DEFAULT_SETTINGS.lab_assets.elisa_analysis_template_url
  const serviceFormUrl = clean(settings.elisa_testing_service_form_url) || DEFAULT_SETTINGS.lab_assets.elisa_testing_service_form_url
  return {
    elisa_analysis_template_url: templateUrl,
    elisa_analysis_template_name:
      clean(settings.elisa_analysis_template_name) ||
      templateUrl.split('/').pop() ||
      DEFAULT_SETTINGS.lab_assets.elisa_analysis_template_name,
    elisa_analysis_template_uploaded_at: clean(settings.elisa_analysis_template_uploaded_at),
    elisa_testing_service_form_url: serviceFormUrl,
    elisa_testing_service_form_name:
      clean(settings.elisa_testing_service_form_name) ||
      serviceFormUrl.split('/').pop() ||
      DEFAULT_SETTINGS.lab_assets.elisa_testing_service_form_name,
    elisa_testing_service_form_uploaded_at: clean(settings.elisa_testing_service_form_uploaded_at),
  }
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('id, lab_assets')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (isMissingLabAssets(error.message)) {
      return NextResponse.json({
        settings: DEFAULT_SETTINGS.lab_assets,
        needsSetup: true,
        error: '实验室下载模板配置尚未初始化，请先执行 supabase/migrations/052_lab_template_settings.sql。',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: normalizeSettings(data?.lab_assets) })
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const body = (await request.json().catch(() => ({}))) as LabAssetsSettings
  const supabase = createAdminClient()
  const { data: currentData } = await supabase
    .from('site_settings')
    .select('lab_assets')
    .eq('id', 1)
    .maybeSingle()

  const currentSettings = normalizeSettings(currentData?.lab_assets)
  const templateUrl =
    clean(body.elisa_analysis_template_url) ||
    currentSettings.elisa_analysis_template_url ||
    DEFAULT_SETTINGS.lab_assets.elisa_analysis_template_url
  const serviceFormUrl =
    clean(body.elisa_testing_service_form_url) ||
    currentSettings.elisa_testing_service_form_url ||
    DEFAULT_SETTINGS.lab_assets.elisa_testing_service_form_url

  const payload = {
    id: 1,
    lab_assets: {
      elisa_analysis_template_url: templateUrl,
      elisa_analysis_template_name:
        clean(body.elisa_analysis_template_name) ||
        currentSettings.elisa_analysis_template_name ||
        templateUrl.split('/').pop() ||
        DEFAULT_SETTINGS.lab_assets.elisa_analysis_template_name,
      elisa_analysis_template_uploaded_at:
        clean(body.elisa_analysis_template_uploaded_at) || currentSettings.elisa_analysis_template_uploaded_at,
      elisa_testing_service_form_url: serviceFormUrl,
      elisa_testing_service_form_name:
        clean(body.elisa_testing_service_form_name) ||
        currentSettings.elisa_testing_service_form_name ||
        serviceFormUrl.split('/').pop() ||
        DEFAULT_SETTINGS.lab_assets.elisa_testing_service_form_name,
      elisa_testing_service_form_uploaded_at:
        clean(body.elisa_testing_service_form_uploaded_at) || currentSettings.elisa_testing_service_form_uploaded_at,
    },
  }

  const { data, error } = await supabase
    .from('site_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('lab_assets')
    .single()

  if (error) {
    if (isMissingLabAssets(error.message)) {
      return NextResponse.json(
        { error: '实验室下载模板配置尚未初始化，请先执行 supabase/migrations/052_lab_template_settings.sql。' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    settings: normalizeSettings(data?.lab_assets),
    message: '常用下载文件配置已更新',
  })
}
