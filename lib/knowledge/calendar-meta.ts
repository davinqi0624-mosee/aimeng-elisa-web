import { Solar } from 'lunar-typescript'

export type CalendarSeason = 'spring' | 'summer' | 'autumn' | 'winter'

export interface CalendarDayMeta {
  solarTerm?: string
  festival?: string
  lunarDay?: string
}

export function getCalendarSeason(month: number): CalendarSeason {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function getCalendarDayMeta(dateStr: string): CalendarDayMeta {
  const [year, month, day] = dateStr.split('-').map(Number)
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const lunarFestivals = lunar.getFestivals()
  const solarFestivals = solar.getFestivals()

  return {
    solarTerm: lunar.getJieQi() || undefined,
    festival: lunarFestivals[0] || solarFestivals[0] || undefined,
    lunarDay: lunar.getDayInChinese(),
  }
}
