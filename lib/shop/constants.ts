export const SHOP_REDEMPTION_NOTICE =
  '积分兑换时请留好快递信息，如有变动方便客服人员联系，正常发货时间为兑换后7个工作日，以沟通结果为准，积分兑换商品，兑换后不可退换货，敬请谅解！'

const LEGACY_REDEMPTION_NOTICES = [
  SHOP_REDEMPTION_NOTICE,
  '积分兑换时请留好联系方式，正常发货时间为积分兑换后7个工作日发货，如有特殊情况请跟客服人员联系，具体事宜以沟通为准',
]

export function removeShopRedemptionNotice(description: string | null | undefined) {
  let cleaned = String(description || '').replace(/\r\n/g, '\n')

  for (const notice of LEGACY_REDEMPTION_NOTICES) {
    cleaned = cleaned.split(notice).join('')
  }

  return cleaned
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
