'use client'

import React from 'react'

interface IconProps {
  className?: string
}

const HumanIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="6" r="3" />
    <path d="M12 9v3" />
    <path d="M8 22v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" />
    <path d="M8 14l-2 3" />
    <path d="M16 14l2 3" />
  </svg>
)

const MouseIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="5" ry="4" />
    <circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M9 11c-1-2-2-3-3-3" />
    <path d="M15 11c1-2 2-3 3-3" />
    <path d="M7 15c-1.5 0-2.5 1-2.5 2.5S5.5 20 7 20" />
  </svg>
)

const RatIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="5.5" ry="4" />
    <circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M9 11c-1.2-2-2.5-3-4-3" />
    <path d="M15 11c1.2-2 2.5-3 4-3" />
    <path d="M6.5 16c-2 0-3.5 1.5-3.5 3.5" />
    <path d="M17.5 16c2 0 3.5 1.5 3.5 3.5" />
  </svg>
)

const RabbitIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="16" rx="4.5" ry="3.5" />
    <circle cx="10.5" cy="15" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="15" r="0.5" fill="currentColor" stroke="none" />
    <path d="M10 12c-1-3-1-6 0-8" />
    <path d="M14 12c1-3 1-6 0-8" />
    <path d="M9.5 18.5c-1.5 1-2 2.5-1.5 3.5" />
    <path d="M14.5 18.5c1.5 1 2 2.5 1.5 3.5" />
    <path d="M16.5 15c1.5 0 2.5 1 2.5 2" />
  </svg>
)

const ChickenIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 16c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M8 16c-2 0-3.5 1.5-3.5 3" />
    <path d="M13.5 11l-1-3" />
    <path d="M11.5 8c-1-1-1-2.5 0-3.5" />
    <path d="M12 4.5l1-1" />
    <path d="M15 13l3-1" />
    <circle cx="17" cy="11" r="0.5" fill="currentColor" stroke="none" />
  </svg>
)

const PorcineIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="5" ry="4" />
    <circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <ellipse cx="17.5" cy="13.5" rx="1.5" ry="2" />
    <path d="M8 11c-1-1-2-1-3-0.5" />
    <path d="M7 16c-1.5 0.5-2.5 2-2.5 3.5" />
    <path d="M17 16c1.5 0.5 2.5 2 2.5 3.5" />
  </svg>
)

const BovineIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="5" ry="4" />
    <circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M7.5 9c-2-1.5-3-0.5-3.5 0.5" />
    <path d="M16.5 9c2-1.5 3-0.5 3.5 0.5" />
    <path d="M7 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M17 16c1.5 0.5 2.5 2 2 3.5" />
    <path d="M10.5 10c-0.5-1-0.5-2 0-2.5" />
    <path d="M13.5 10c0.5-1 0.5-2 0-2.5" />
  </svg>
)

const MonkeyIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="4.5" ry="4" />
    <circle cx="10.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M9.5 10.5c-1-1.5-1-3.5 0.5-4.5" />
    <path d="M14.5 10.5c1-1.5 1-3.5-0.5-4.5" />
    <path d="M16.5 13c2 0.5 3 2 2.5 4" />
    <path d="M7.5 13c-2 0.5-3 2-2.5 4" />
    <path d="M16.5 16c1.5 1 2 2.5 1.5 3.5" />
  </svg>
)

const CanineIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="5" ry="3.5" />
    <circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M8 12c-1.5-1-3-0.5-3.5 0.5" />
    <path d="M8 12c-0.5-2-0.5-3.5 0.5-4" />
    <path d="M16 12c1.5-1 3-0.5 3.5 0.5" />
    <path d="M7.5 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M16.5 16c1.5 0.5 2.5 2 2 3.5" />
    <path d="M9 10.5c0-1 0.5-2 1-2.5" />
  </svg>
)

const CatIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14.5" rx="4.5" ry="3.5" />
    <circle cx="10.5" cy="13.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="13.5" r="0.5" fill="currentColor" stroke="none" />
    <path d="M9 11.5c-1-2-1-4-0.5-5" />
    <path d="M15 11.5c1-2 1-4 0.5-5" />
    <path d="M7.5 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M16.5 16c1.5 0.5 2.5 2 2 3.5" />
    <path d="M16.5 13c1.5 0 2.5 1 2.5 2" />
  </svg>
)

const SheepIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="5" ry="4" />
    <circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M7.5 9.5c-2-1-3-0.5-3.5 0" />
    <path d="M16.5 9.5c2-1 3-0.5 3.5 0" />
    <path d="M7 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M17 16c1.5 0.5 2.5 2 2 3.5" />
  </svg>
)

const HorseIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 17c0-4 2.5-7 6-7s6 3 6 7" />
    <circle cx="10.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
    <path d="M8 10c-1-1.5-1-3.5 0-4.5" />
    <path d="M16 10c1-1.5 1-3.5 0-4.5" />
    <path d="M13 6c0-1.5 0.5-2.5 1.5-3" />
    <path d="M7 17c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M17 17c1.5 0.5 2.5 2 2 3.5" />
    <path d="M13 17c0 2 0.5 3.5 1 4" />
  </svg>
)

const GuineaPigIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="5" ry="3.5" />
    <circle cx="10" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M8 12c-1.5-0.5-2.5 0-3 1" />
    <path d="M16 12c1.5-0.5 2.5 0 3 1" />
    <path d="M7.5 15.5c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M16.5 15.5c1.5 0.5 2.5 2 2 3.5" />
  </svg>
)

const HamsterIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="4.5" ry="3.5" />
    <circle cx="10.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M9.5 11c-0.5-2-0.5-3.5 0-4" />
    <path d="M14.5 11c0.5-2 0.5-3.5 0-4" />
    <path d="M8 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M16 16c1.5 0.5 2.5 2 2 3.5" />
    <path d="M9.5 10c-1-0.5-2 0-2.5 0.5" />
    <path d="M14.5 10c1-0.5 2 0 2.5 0.5" />
  </svg>
)

const FishIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 12c2-3 5-4 9-4s7 1 9 4-3 5-7 5-7-1-9-4z" />
    <circle cx="16" cy="12" r="0.5" fill="currentColor" stroke="none" />
    <path d="M4 12c-1 1-1.5 2-1 3" />
    <path d="M7 10c0-1.5 1-2.5 2-3" />
    <path d="M10 14c1 0.5 2 0.5 3 0" />
    <path d="M20 10c1-1 2-1 2.5-0.5" />
  </svg>
)

const ZebrafishIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 12c2-3 5-4 9-4s7 1 9 4-3 5-7 5-7-1-9-4z" />
    <circle cx="16" cy="12" r="0.5" fill="currentColor" stroke="none" />
    <path d="M4 12c-1 1-1.5 2-1 3" />
    <path d="M7 10c0-1.5 1-2.5 2-3" />
    <path d="M9 8c0.5-1 1.5-1.5 2.5-1.5" />
    <path d="M12 6.5c0.5-0.5 1-1 2-1" />
    <path d="M10 14c1 0.5 2 0.5 3 0" />
  </svg>
)

const DuckIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="4" ry="3.5" />
    <circle cx="10.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M9.5 11c-0.5-2 0-4 1.5-5" />
    <path d="M14 11c0.5-2 0.5-3.5-0.5-4.5" />
    <path d="M16 13c1.5 0 2.5 0.5 3 1.5" />
    <path d="M8.5 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M15.5 16c1.5 0.5 2.5 2 2 3.5" />
  </svg>
)

const PigeonIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="4" ry="3" />
    <circle cx="10.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M9 12c-1-2-0.5-4 1-5" />
    <path d="M15 12c1-2 0.5-4-1-5" />
    <path d="M16 13c2 0 3 1 3 2" />
    <path d="M8 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M16 16c1.5 0.5 2.5 2 2 3.5" />
  </svg>
)

const PlantIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 20V10" />
    <path d="M12 10c-2-2-2-4 0-6" />
    <path d="M12 10c2-2 2-4 0-6" />
    <path d="M12 14c-2.5-1-3.5-3-2.5-5" />
    <path d="M12 14c2.5-1 3.5-3 2.5-5" />
    <path d="M8 20h8" />
  </svg>
)

const GoatIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="14" rx="4.5" ry="4" />
    <circle cx="10.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="13.5" cy="13" r="0.5" fill="currentColor" stroke="none" />
    <path d="M8 10c-1-1.5-1.5-3-1-4" />
    <path d="M16 10c1-1.5 1.5-3 1-4" />
    <path d="M7 10c-1.5-0.5-2.5 0-3 0.5" />
    <path d="M17 10c1.5-0.5 2.5 0 3 0.5" />
    <path d="M7.5 16c-1.5 0.5-2.5 2-2 3.5" />
    <path d="M16.5 16c1.5 0.5 2.5 2 2 3.5" />
  </svg>
)

const GeneralIcon = ({ className }: IconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="3" />
    <path d="M12 11v3" />
    <path d="M7 22v-4a2.5 2.5 0 0 1 2.5-2.5h5A2.5 2.5 0 0 1 17 18v4" />
    <path d="M7 16l-1.5 2" />
    <path d="M17 16l1.5 2" />
  </svg>
)

export const SPECIES_ICON_MAP: Record<string, React.FC<IconProps>> = {
  Human: HumanIcon,
  Mouse: MouseIcon,
  Rat: RatIcon,
  Rabbit: RabbitIcon,
  Chicken: ChickenIcon,
  Porcine: PorcineIcon,
  Bovine: BovineIcon,
  Monkey: MonkeyIcon,
  Canine: CanineIcon,
  Cat: CatIcon,
  Sheep: SheepIcon,
  Horse: HorseIcon,
  Goat: GoatIcon,
  'Guinea Pig': GuineaPigIcon,
  Hamster: HamsterIcon,
  Fish: FishIcon,
  Zebrafish: ZebrafishIcon,
  Duck: DuckIcon,
  Pigeon: PigeonIcon,
  Plant: PlantIcon,
  General: GeneralIcon,
}

export const SPECIES_LABELS: Record<string, string> = {
  Human: '人',
  Mouse: '小鼠',
  Rat: '大鼠',
  Rabbit: '兔',
  Chicken: '鸡',
  Porcine: '猪',
  Bovine: '牛',
  Monkey: '猴',
  Canine: '狗',
  Cat: '猫',
  Sheep: '绵羊',
  Horse: '马',
  Goat: '山羊',
  'Guinea Pig': '豚鼠',
  Hamster: '仓鼠',
  Fish: '鱼',
  Zebrafish: '斑马鱼',
  Duck: '鸭',
  Pigeon: '鸽',
  Plant: '植物',
  General: '通用',
}

export const SPECIES_ORDER = [
  'Human',
  'Mouse',
  'Rat',
  'Monkey',
  'Canine',
  'Porcine',
  'Bovine',
  'Chicken',
  'Guinea Pig',
  'Sheep',
  'Zebrafish',
  'Rabbit',
  'Goat',
]

// Name patterns for fallback species matching when product_species table is incomplete
export const SPECIES_NAME_PATTERNS: Record<string, string[]> = {
  Human: ['Human', '人'],
  Mouse: ['Mouse', '小鼠'],
  Rat: ['Rat', '大鼠'],
  Rabbit: ['Rabbit', '兔'],
  Chicken: ['Chicken', '鸡'],
  Porcine: ['Porcine', '猪'],
  Bovine: ['Bovine', '牛', 'Cow'],
  Monkey: ['Monkey', '猴'],
  Canine: ['Canine', 'Dog', '犬'],
  Cat: ['Cat', '猫'],
  Sheep: ['Sheep', '羊'],
  Horse: ['Horse', '马'],
  Goat: ['Goat', '山羊'],
  'Guinea Pig': ['Guinea Pig', '豚鼠'],
  Hamster: ['Hamster', '仓鼠'],
  Fish: ['Fish', '鱼'],
  Zebrafish: ['Zebrafish', '斑马鱼'],
  Duck: ['Duck', '鸭'],
  Pigeon: ['Pigeon', '鸽'],
  Plant: ['Plant', '植物'],
  General: ['General', '通用'],
}

export function SpeciesIcon({ species, className }: { species: string; className?: string }) {
  const Icon = SPECIES_ICON_MAP[species] || GeneralIcon
  return <Icon className={className} />
}
