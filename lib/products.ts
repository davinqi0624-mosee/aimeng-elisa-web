import { randomUUID } from 'crypto'

export function generateProductSlug(name: string, target?: string, catalogNumber?: string): string {
  const base = target || name.replace(/^\S+\s+/, '')
  let slug = base
    .toLowerCase()
    .replace(/[^a-z0-9α-ωΑ-Ω-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (catalogNumber) {
    const cleanCat = catalogNumber.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-')
    slug = `${slug}-${cleanCat}`
  }

  const uniqueSuffix = randomUUID().split('-')[0]
  return `${slug}-${uniqueSuffix}`
}
