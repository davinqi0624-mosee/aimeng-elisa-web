import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  DEFAULT_ELISA_TESTING_SERVICE_FORM,
  type ServiceDownloadFile,
} from '@/lib/downloads/service-forms'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function fetchElisaTestingServiceForm(): Promise<ServiceDownloadFile> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('site_settings')
      .select('lab_assets')
      .eq('id', 1)
      .maybeSingle()

    if (error) return DEFAULT_ELISA_TESTING_SERVICE_FORM

    const labAssets = (data?.lab_assets || {}) as {
      elisa_testing_service_form_url?: string
      elisa_testing_service_form_name?: string
    }
    const href = clean(labAssets.elisa_testing_service_form_url) || DEFAULT_ELISA_TESTING_SERVICE_FORM.href
    const fileName =
      clean(labAssets.elisa_testing_service_form_name) ||
      href.split('/').pop() ||
      DEFAULT_ELISA_TESTING_SERVICE_FORM.fileName

    return {
      ...DEFAULT_ELISA_TESTING_SERVICE_FORM,
      href,
      fileName,
    }
  } catch {
    return DEFAULT_ELISA_TESTING_SERVICE_FORM
  }
}

export const getElisaTestingServiceForm = unstable_cache(
  fetchElisaTestingServiceForm,
  ['elisa-testing-service-form'],
  { revalidate: 600 }
)
