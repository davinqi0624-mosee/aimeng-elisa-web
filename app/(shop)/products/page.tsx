import { redirect } from 'next/navigation'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ species?: string; query?: string; q?: string }>
}) {
  const params = await searchParams
  const nextParams = new URLSearchParams()
  const keyword = params.q || params.query
  if (keyword) nextParams.set('q', keyword)
  if (params.species) nextParams.set('species', params.species)
  const suffix = nextParams.toString()
  redirect(`/products/elisa${suffix ? `?${suffix}` : ''}`)
}
