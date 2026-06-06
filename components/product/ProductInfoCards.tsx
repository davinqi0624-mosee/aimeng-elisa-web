import { FlaskConical, Droplets, Gauge, Ruler } from 'lucide-react'
import { SpeciesIcon, SPECIES_LABELS } from '@/components/icons/SpeciesIcons'

interface ProductInfoCardsProps {
  detectionMethod?: string | null
  speciesList: string[]
  sensitivity?: string | null
  detectionRange?: string | null
}

export default function ProductInfoCards({
  detectionMethod,
  speciesList,
  sensitivity,
  detectionRange,
}: ProductInfoCardsProps) {
  const items = [
    {
      icon: <FlaskConical className="w-5 h-5 text-blue-600" />,
      label: '检测方法',
      value: detectionMethod || '双抗夹心法',
    },
    {
      icon: <SpeciesIcon species={speciesList[0] || 'human'} className="w-5 h-5 text-emerald-600" />,
      label: '反应种属',
      value: speciesList.map((s) => SPECIES_LABELS[s] || s).join(' / ') || '-',
    },
    {
      icon: <Droplets className="w-5 h-5 text-sky-600" />,
      label: '样本类型',
      value: '体液、组织、细胞样本',
    },
    {
      icon: <Gauge className="w-5 h-5 text-violet-600" />,
      label: '灵敏度',
      value: sensitivity || '-',
    },
    {
      icon: <Ruler className="w-5 h-5 text-amber-600" />,
      label: '检测范围',
      value: detectionRange || '-',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center text-center gap-2 hover:border-slate-300 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
            {item.icon}
          </div>
          <div>
            <p className="text-[11px] text-slate-400 mb-0.5">{item.label}</p>
            <p className="text-sm font-semibold text-slate-900 leading-tight">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
