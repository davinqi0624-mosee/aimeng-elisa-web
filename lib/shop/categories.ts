export const SHOP_CATEGORIES = [
  { code: 'digital', label: '数码通信' },
  { code: 'computer', label: '电脑配件' },
  { code: 'office', label: '文具办公' },
  { code: 'sports_outdoor', label: '运动户外' },
  { code: 'daily_life', label: '生活用品' },
  { code: 'food_drink', label: '食品饮料' },
  { code: 'beauty', label: '个护美妆' },
  { code: 'home_appliance', label: '家居家电' },
  { code: 'travel', label: '旅行用品' },
  { code: 'disposable', label: '一次性用品' },
  { code: 'research', label: '实验科研' },
  { code: 'gift_card', label: '礼品卡券' },
  { code: 'clothing', label: '服饰配件' },
  { code: 'other', label: '其他' },
] as const

export type ShopCategory = (typeof SHOP_CATEGORIES)[number]['code']

export const SHOP_CATEGORY_CODES = SHOP_CATEGORIES.map(({ code }) => code) as ShopCategory[]

export function isShopCategory(value: unknown): value is ShopCategory {
  return typeof value === 'string' && SHOP_CATEGORY_CODES.includes(value as ShopCategory)
}

export function getShopCategoryLabel(value: string | null | undefined) {
  return SHOP_CATEGORIES.find((category) => category.code === value)?.label || '待分类'
}
