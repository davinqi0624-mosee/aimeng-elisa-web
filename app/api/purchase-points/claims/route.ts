import { getCurrentUser } from '@/lib/user-auth'
import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPurchasePointDefaultPoints, getPurchasePointDefaultSpec, PURCHASE_POINT_PRODUCT_TYPES } from '@/lib/purchase-points'

const PHOTO_TYPES = new Set(['product_front', 'catalog_batch', 'outer_package', 'usage_scene', 'other'])
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const MAX_PHOTOS = 3
const MAX_TOTAL_SIZE = 20 * 1024 * 1024

interface PointRuleRow {
  points: number
}

interface CampaignRow {
  id: string
  name: string
  product_types: string[] | null
  product_specs: string[] | null
  multiplier: number
  bonus_points: number
}

interface PhotoUpload {
  file: File
  photoType: string
  hash: string
  buffer: Buffer
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCode(value: string) {
  return value.replace(/\s+/g, '').trim().toUpperCase()
}

function claimCredential(catalogNumber: string, batchNumber: string) {
  return [
    'CATBATCH',
    normalizeCode(catalogNumber),
    normalizeCode(batchNumber),
  ].join(':')
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '-').slice(-120) || 'photo.jpg'
}

function extFromFile(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'
  return 'jpg'
}

function isSupportedImage(file: File) {
  if (IMAGE_TYPES.has(file.type)) return true
  const extension = file.name.split('.').pop()?.toLowerCase()
  return Boolean(extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(extension))
}

function activeCampaigns(campaigns: CampaignRow[], productType: string, productSpec: string) {
  return campaigns.filter((campaign) => {
    const types = campaign.product_types || []
    const specs = campaign.product_specs || []
    const typeMatches = types.length === 0 || types.includes(productType)
    const specMatches = specs.length === 0 || specs.includes(productSpec)
    return typeMatches && specMatches
  })
}

function bestCampaign(campaigns: CampaignRow[], basePoints: number) {
  return campaigns
    .map((campaign) => {
      const multiplier = Number(campaign.multiplier || 1)
      const bonusPoints = Number(campaign.bonus_points || 0)
      const totalAfterCampaign = Math.round(basePoints * multiplier) + bonusPoints
      return { campaign, totalAfterCampaign, campaignBonus: Math.max(0, totalAfterCampaign - basePoints) }
    })
    .sort((a, b) => b.totalAfterCampaign - a.totalAfterCampaign)[0] || null
}

async function fileToUpload(file: File, photoType: string): Promise<PhotoUpload> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const hash = createHash('sha256').update(buffer).digest('hex')
  return { file, photoType, hash, buffer }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('purchase_point_claims')
    .select('*, purchase_point_claim_photos(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ claims: data || [] })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: '请先登录后再申请积分' }, { status: 401 })
    const supabase = createAdminClient()

    const formData = await request.formData()
    const productType = normalizeText(formData.get('product_type'))
    const inputSpec = normalizeText(formData.get('product_spec'))
    const catalogNumber = normalizeText(formData.get('catalog_number'))
    const batchNumber = normalizeText(formData.get('batch_number'))
    const purchaseChannel = normalizeText(formData.get('purchase_channel'))
    const notes = normalizeText(formData.get('notes'))
    const photoConsent = normalizeText(formData.get('photo_consent')) === 'true'
    const photoTypes = formData.getAll('photo_types').map((value) => normalizeText(value)).filter(Boolean)
    const photos = formData.getAll('photos').filter((value): value is File => value instanceof File && value.size > 0)

    if (!PURCHASE_POINT_PRODUCT_TYPES.has(productType)) {
      return NextResponse.json({ error: '请选择有效的产品类型' }, { status: 400 })
    }
    if (!catalogNumber) {
      return NextResponse.json({ error: '请填写产品货号' }, { status: 400 })
    }
    if (!batchNumber) {
      return NextResponse.json({ error: '请填写产品批号' }, { status: 400 })
    }
    if (photos.length === 0) {
      return NextResponse.json({ error: '请至少上传 1 张商品照片' }, { status: 400 })
    }
    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `最多上传 ${MAX_PHOTOS} 张照片` }, { status: 400 })
    }
    const totalSize = photos.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json({ error: '本次上传照片总大小不能超过 20MB，可先提交 1 张核心照片' }, { status: 400 })
    }
    const unsupported = photos.find((file) => !isSupportedImage(file))
    if (unsupported) {
      return NextResponse.json({ error: '照片格式暂支持 JPG、PNG、WebP、GIF、HEIC/HEIF' }, { status: 400 })
    }

    const admin = createAdminClient()
    const productSpec = productType === 'biochemical_reagents'
      ? getPurchasePointDefaultSpec(productType)
      : inputSpec || getPurchasePointDefaultSpec(productType)
    const productClaimCredential = claimCredential(catalogNumber, batchNumber)
    const { data: activeClaim, error: activeClaimError } = await admin
      .from('purchase_point_claims')
      .select('id, status')
      .eq('point_code', productClaimCredential)
      .in('status', ['pending', 'needs_more_info', 'approved'])
      .maybeSingle()
    if (activeClaimError) throw new Error(`检查重复申请失败: ${activeClaimError.message}`)
    if (activeClaim) {
      return NextResponse.json({ error: '该货号和批号已有申请记录，不能重复提交' }, { status: 409 })
    }

    const uploads = await Promise.all(photos.map((file, index) => {
      const selectedType = photoTypes[index] || 'product_front'
      return fileToUpload(file, PHOTO_TYPES.has(selectedType) ? selectedType : 'other')
    }))

    const duplicateWarnings: Array<Record<string, string | number>> = []
    const hashes = uploads.map((item) => item.hash)
    if (hashes.length > 0) {
      const { data: duplicatePhotos } = await admin
        .from('purchase_point_claim_photos')
        .select('file_hash, claim_id, created_at')
        .in('file_hash', hashes)
      for (const duplicate of duplicatePhotos || []) {
        duplicateWarnings.push({
          type: 'photo_hash',
          message: '发现历史相同照片，后台需确认是否重复使用照片。',
          file_hash: duplicate.file_hash,
          claim_id: duplicate.claim_id,
        })
      }
    }

    const now = new Date().toISOString()
    const { data: campaigns, error: campaignError } = await admin
      .from('purchase_point_campaigns')
      .select('*')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
    if (campaignError) throw new Error(`读取积分活动失败: ${campaignError.message}`)

    const { data: ruleRow, error: ruleError } = await admin
      .from('purchase_point_rules')
      .select('points')
      .eq('product_type', productType)
      .eq('product_spec', productSpec)
      .eq('is_active', true)
      .maybeSingle<PointRuleRow>()
    if (ruleError) throw new Error(`读取积分基础规则失败: ${ruleError.message}`)

    const basePoints = Number(ruleRow?.points ?? getPurchasePointDefaultPoints(productType))
    const matchedCampaign = bestCampaign(activeCampaigns((campaigns || []) as CampaignRow[], productType, productSpec), basePoints)
    const campaignBonusPoints = matchedCampaign?.campaignBonus || 0
    const campaignMultiplier = matchedCampaign ? Number(matchedCampaign.campaign.multiplier || 1) : 1
    const totalPoints = basePoints + campaignBonusPoints
    const claimId = randomUUID()
    const photoRows = []
    for (const [index, upload] of uploads.entries()) {
      const extension = extFromFile(upload.file)
      const fileName = safeFileName(upload.file.name)
      const path = `purchase-claims/${user.id}/${claimId}/${index + 1}-${Date.now()}.${extension}`
      const { data: storageData, error: uploadError } = await admin.storage
        .from('product-assets')
        .upload(path, upload.buffer, {
          contentType: upload.file.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        })
      if (uploadError) throw new Error(`照片上传失败: ${uploadError.message}`)
      const { data: urlData } = admin.storage.from('product-assets').getPublicUrl(storageData.path)
      photoRows.push({
        claim_id: claimId,
        user_id: user.id,
        photo_type: upload.photoType,
        file_url: urlData.publicUrl,
        file_path: storageData.path,
        file_name: fileName,
        file_size: upload.file.size,
        mime_type: upload.file.type,
        file_hash: upload.hash,
      })
    }

    const { error: claimError } = await admin.from('purchase_point_claims').insert({
      id: claimId,
      user_id: user.id,
      product_type: productType,
      product_spec: productSpec,
      point_code: productClaimCredential,
      point_code_id: null,
      catalog_number: catalogNumber,
      batch_number: batchNumber,
      purchase_channel: purchaseChannel,
      photo_consent: photoConsent,
      notes,
      base_points: basePoints,
      campaign_id: matchedCampaign?.campaign.id || null,
      campaign_name: matchedCampaign?.campaign.name || null,
      campaign_multiplier: campaignMultiplier,
      campaign_bonus_points: campaignBonusPoints,
      photo_bonus_points: 0,
      total_points: totalPoints,
      duplicate_warnings: duplicateWarnings,
      status: 'pending',
    })
    if (claimError) throw new Error(`创建积分申请失败: ${claimError.message}`)

    const { error: photoError } = await admin.from('purchase_point_claim_photos').insert(photoRows)
    if (photoError) {
      await admin.from('purchase_point_claims').delete().eq('id', claimId)
      throw new Error(`保存照片记录失败: ${photoError.message}`)
    }

    return NextResponse.json({
      success: true,
      claimId,
      expectedPoints: totalPoints,
      duplicateWarnings,
      message: '购买积分申请已提交，等待管理员审核。',
    })
  } catch (err: unknown) {
    console.error('[purchase-points/claims]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '提交失败' }, { status: 500 })
  }
}
