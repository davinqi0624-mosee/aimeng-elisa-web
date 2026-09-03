export type HomeMediaCategory = 'elisa' | 'cell_culture'

export type HomeMediaItem = {
  id: string
  category: HomeMediaCategory
  title: string
  summary: string
  platform: string
  external_url: string
  cover_image_url: string
  published_at: string | null
  sort_order: number
  is_featured: boolean
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export const HOME_MEDIA_CATEGORY_LABELS: Record<HomeMediaCategory, string> = {
  elisa: 'ELISA',
  cell_culture: '细胞培养',
}

function isLikelyFilesystemPath(value: string) {
  const text = value.trim()
  return (
    /^file:\/\//i.test(text) ||
    /^[a-zA-Z]:[\\/]/.test(text) ||
    /^\/users?\//i.test(text) ||
    /^\/volumes\//i.test(text)
  )
}

export function isPlayableHomeMediaUrl(value?: string) {
  const text = value?.trim()
  if (!text) return false
  if (isLikelyFilesystemPath(text)) return false
  return /\.(mp4|webm|ogg|m4v|mov)([?#].*)?$/i.test(text)
}

export function isPlayableHomeMediaItem(item: Pick<HomeMediaItem, 'external_url' | 'platform'>) {
  return isPlayableHomeMediaUrl(item.external_url)
}

export function isHttpHomeMediaUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value.trim()))
}

export function hasUsableHomeMediaLink(item: Pick<HomeMediaItem, 'external_url'>) {
  return isPlayableHomeMediaUrl(item.external_url) || isHttpHomeMediaUrl(item.external_url)
}

export function hasValidPublicHomeMediaLink(item: Pick<HomeMediaItem, 'external_url' | 'platform'>) {
  if (item.platform === '本地视频') return isPlayableHomeMediaUrl(item.external_url)
  return hasUsableHomeMediaLink(item)
}

export function getHomeMediaLaunchHref(item: HomeMediaItem) {
  if (item.external_url && isPlayableHomeMediaUrl(item.external_url)) {
    return `/videos?highlight=${encodeURIComponent(item.id)}`
  }
  if (isHttpHomeMediaUrl(item.external_url)) return item.external_url
  return '/videos'
}

export const DEFAULT_HOME_MEDIA_ITEMS: HomeMediaItem[] = [
  {
    id: 'default-elisa-1',
    category: 'elisa',
    title: '标准曲线与 4PL 拟合',
    summary: 'ELISA 数据分析与标准曲线计算内容入口。',
    platform: '小红书',
    external_url: '/videos',
    cover_image_url: '/images/elisa/elisa_sandwich_pencil.jpg',
    published_at: null,
    sort_order: 1,
    is_featured: true,
    is_active: true,
  },
  {
    id: 'default-elisa-2',
    category: 'elisa',
    title: '样本处理与稀释建议',
    summary: '常见样本处理、稀释倍数和实验注意事项。',
    platform: '小红书',
    external_url: '/videos',
    cover_image_url: '',
    published_at: null,
    sort_order: 2,
    is_featured: false,
    is_active: true,
  },
  {
    id: 'default-elisa-3',
    category: 'elisa',
    title: '说明书参数解读',
    summary: '帮助客户理解说明书中的检测范围、灵敏度和样本要求。',
    platform: '小红书',
    external_url: '/videos',
    cover_image_url: '',
    published_at: null,
    sort_order: 3,
    is_featured: false,
    is_active: true,
  },
  {
    id: 'default-cell-1',
    category: 'cell_culture',
    title: '细胞培养状态观察',
    summary: '细胞培养、血清选型和日常实验观察内容入口。',
    platform: '小红书',
    external_url: '/videos',
    cover_image_url: '/images/elisa/elisa_sandwich_lego.jpg',
    published_at: null,
    sort_order: 1,
    is_featured: true,
    is_active: true,
  },
  {
    id: 'default-cell-2',
    category: 'cell_culture',
    title: '胎牛血清批次 COA',
    summary: '血清批次、COA 和应用场景相关内容。',
    platform: '小红书',
    external_url: '/videos',
    cover_image_url: '',
    published_at: null,
    sort_order: 2,
    is_featured: false,
    is_active: true,
  },
  {
    id: 'default-cell-3',
    category: 'cell_culture',
    title: '污染与传代提醒',
    summary: '细胞污染识别、传代节奏和培养状态维护。',
    platform: '小红书',
    external_url: '/videos',
    cover_image_url: '',
    published_at: null,
    sort_order: 3,
    is_featured: false,
    is_active: true,
  },
]
