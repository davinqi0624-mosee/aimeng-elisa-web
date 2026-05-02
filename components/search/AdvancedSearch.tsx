'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X, ChevronDown, Check } from 'lucide-react'
import { SpeciesIcon, SPECIES_ORDER, SPECIES_LABELS } from '@/components/icons/SpeciesIcons'

const SAMPLE_TYPES = [
  '全部',
  '组织',
  '组织匀浆',
  '血液',
  '血清',
  '血浆',
  '尿液',
  '精液',
  '脑脊液',
  '唾液',
  '粪便',
  '细胞',
  '细胞上清液',
]

interface AdvancedSearchProps {
  availableSpecies?: string[]
}

export default function AdvancedSearch({ availableSpecies = SPECIES_ORDER }: AdvancedSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([])
  const [sampleType, setSampleType] = useState('全部')
  const [query, setQuery] = useState('')
  const [sampleDropdownOpen, setSampleDropdownOpen] = useState(false)

  // Initialize from URL params
  useEffect(() => {
    const speciesParam = searchParams.get('species')
    const sampleParam = searchParams.get('sampleType')
    const queryParam = searchParams.get('query')

    if (speciesParam) {
      setSelectedSpecies(speciesParam.split(',').filter(Boolean))
    }
    if (sampleParam) {
      setSampleType(sampleParam)
    }
    if (queryParam) {
      setQuery(queryParam)
    }
  }, [searchParams])

  const toggleSpecies = useCallback((species: string) => {
    setSelectedSpecies((prev) =>
      prev.includes(species)
        ? prev.filter((s) => s !== species)
        : [...prev, species]
    )
  }, [])

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedSpecies.length > 0) {
      params.set('species', selectedSpecies.join(','))
    }
    if (sampleType && sampleType !== '全部') {
      params.set('sampleType', sampleType)
    }
    if (query.trim()) {
      params.set('query', query.trim())
    }
    router.push(`/products?${params.toString()}`)
  }, [selectedSpecies, sampleType, query, router])

  const removeTag = useCallback((type: string, value: string) => {
    if (type === 'species') {
      setSelectedSpecies((prev) => prev.filter((s) => s !== value))
    } else if (type === 'sampleType') {
      setSampleType('全部')
    } else if (type === 'query') {
      setQuery('')
    }
  }, [])

  const hasFilters = selectedSpecies.length > 0 || sampleType !== '全部' || query.trim()

  const displayedSpecies = SPECIES_ORDER.filter((s) => availableSpecies.includes(s))

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      {/* Species Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-3">
          种属筛选 <span className="text-xs font-normal text-slate-400">（可多选）</span>
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {displayedSpecies.map((species) => {
            const isSelected = selectedSpecies.includes(species)
            return (
              <button
                key={species}
                onClick={() => toggleSpecies(species)}
                className={`relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50/60 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1 right-1">
                    <Check className="w-3 h-3 text-blue-500" />
                  </span>
                )}
                <SpeciesIcon species={species} className="w-5 h-5" />
                <span className="truncate w-full text-center">{SPECIES_LABELS[species] || species}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sample Type + Query Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sample Type Dropdown */}
        <div className="relative">
          <label className="block text-sm font-semibold text-slate-900 mb-2">样本类型</label>
          <button
            onClick={() => setSampleDropdownOpen(!sampleDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-left hover:border-slate-300 transition-colors"
          >
            <span className={sampleType === '全部' ? 'text-slate-400' : 'text-slate-900'}>
              {sampleType}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${sampleDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {sampleDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSampleDropdownOpen(false)} />
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {SAMPLE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSampleType(type)
                      setSampleDropdownOpen(false)
                    }}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${
                      sampleType === type ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Target Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">检测指标</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入指标名称，如 IL-6、TNF-α、IFN-γ..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Selected Tags */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">已选条件：</span>
          {selectedSpecies.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100"
            >
              {SPECIES_LABELS[s] || s}
              <button onClick={() => removeTag('species', s)} className="hover:text-blue-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {sampleType !== '全部' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-100">
              {sampleType}
              <button onClick={() => removeTag('sampleType', sampleType)} className="hover:text-emerald-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {query.trim() && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 text-xs rounded-full border border-violet-100">
              {query.trim()}
              <button onClick={() => removeTag('query', query)} className="hover:text-violet-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSelectedSpecies([])
              setSampleType('全部')
              setQuery('')
            }}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            清空全部
          </button>
        </div>
      )}

      {/* Search Button */}
      <button
        onClick={handleSearch}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
      >
        <Search className="w-4 h-4" />
        搜索试剂盒
      </button>
    </div>
  )
}
