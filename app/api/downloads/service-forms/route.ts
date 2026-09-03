import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_ELISA_TESTING_SERVICE_FORM } from '@/lib/downloads/service-forms'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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
      console.warn('[downloads/service-forms] fallback to static service form:', error.message)
      return NextResponse.json({ elisaTestingServiceForm: DEFAULT_ELISA_TESTING_SERVICE_FORM, fallback: true })
    }

    const labAssets = (data?.lab_assets || {}) as {
      elisa_testing_service_form_url?: string
      elisa_testing_service_form_name?: string
    }
    const href = clean(labAssets.elisa_testing_service_form_url) || DEFAULT_ELISA_TESTING_SERVICE_FORM.href
    const fileName =
      clean(labAssets.elisa_testing_service_form_name) ||
      href.split('/').pop() ||
      DEFAULT_ELISA_TESTING_SERVICE_FORM.fileName

    return NextResponse.json({
      elisaTestingServiceForm: {
        ...DEFAULT_ELISA_TESTING_SERVICE_FORM,
        href,
        fileName,
      },
    })
  } catch (error) {
    console.warn('[downloads/service-forms] fallback to static service form:', error)
    return NextResponse.json({ elisaTestingServiceForm: DEFAULT_ELISA_TESTING_SERVICE_FORM, fallback: true })
  }
}
