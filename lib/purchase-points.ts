export const PURCHASE_POINT_PRODUCT_OPTIONS = [
  { value: 'elisa', label: 'ELISA 试剂盒', specs: ['96T', '48T'], defaultPoints: 50 },
  { value: 'fbs', label: '胎牛血清', specs: ['500ml', '50ml*10'], defaultPoints: 50 },
  { value: 'animal_serum', label: '动物血制品', specs: ['default'], defaultPoints: 20 },
  { value: 'biochemical_reagents', label: '其他生化检测试剂', specs: ['default'], defaultPoints: 50 },
] as const

export const PURCHASE_POINT_PRODUCT_TYPES: ReadonlySet<string> = new Set(PURCHASE_POINT_PRODUCT_OPTIONS.map((item) => item.value))

export type PurchasePointProductType = (typeof PURCHASE_POINT_PRODUCT_OPTIONS)[number]['value']

export const PURCHASE_POINT_PRODUCT_LABELS: Record<string, string> = Object.fromEntries(
  PURCHASE_POINT_PRODUCT_OPTIONS.map((item) => [item.value, item.label])
)

export function getPurchasePointProductLabel(type: string) {
  return PURCHASE_POINT_PRODUCT_LABELS[type] || type
}

export function getPurchasePointProductOption(type: string) {
  return PURCHASE_POINT_PRODUCT_OPTIONS.find((item) => item.value === type) || PURCHASE_POINT_PRODUCT_OPTIONS[0]
}

export function getPurchasePointDefaultPoints(type: string) {
  return getPurchasePointProductOption(type).defaultPoints
}

export function getPurchasePointDefaultSpec(type: string) {
  return getPurchasePointProductOption(type).specs[0]
}
