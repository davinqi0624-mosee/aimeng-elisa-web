'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X, Check } from 'lucide-react'
import { SpeciesIcon, SPECIES_ORDER, SPECIES_LABELS } from '@/components/icons/SpeciesIcons'

const GREEK_CHARS = [
  { char: 'α', name: 'alpha' },
  { char: 'β', name: 'beta' },
  { char: 'γ', name: 'gamma' },
  { char: 'δ', name: 'delta' },
  { char: 'ε', name: 'epsilon' },
  { char: 'ζ', name: 'zeta' },
  { char: 'η', name: 'eta' },
  { char: 'θ', name: 'theta' },
  { char: 'ι', name: 'iota' },
  { char: 'κ', name: 'kappa' },
  { char: 'λ', name: 'lambda' },
  { char: 'μ', name: 'mu' },
  { char: 'ν', name: 'nu' },
  { char: 'ξ', name: 'xi' },
  { char: 'ο', name: 'omicron' },
  { char: 'π', name: 'pi' },
  { char: 'ρ', name: 'rho' },
  { char: 'σ', name: 'sigma' },
  { char: 'τ', name: 'tau' },
  { char: 'υ', name: 'upsilon' },
  { char: 'φ', name: 'phi' },
  { char: 'χ', name: 'chi' },
  { char: 'ψ', name: 'psi' },
  { char: 'ω', name: 'omega' },
]

const ROMAN_NUMERALS = [
  { char: 'Ⅰ', name: 'I', value: 1 },
  { char: 'Ⅱ', name: 'II', value: 2 },
  { char: 'Ⅲ', name: 'III', value: 3 },
  { char: 'Ⅳ', name: 'IV', value: 4 },
  { char: 'Ⅴ', name: 'V', value: 5 },
  { char: 'Ⅵ', name: 'VI', value: 6 },
  { char: 'Ⅶ', name: 'VII', value: 7 },
  { char: 'Ⅷ', name: 'VIII', value: 8 },
  { char: 'Ⅸ', name: 'IX', value: 9 },
  { char: 'Ⅹ', name: 'X', value: 10 },
]

interface AdvancedSearchProps {
  availableSpecies?: string[]
  targetPath?: string
  queryParamName?: string
}

export default function AdvancedSearch({
  availableSpecies = SPECIES_ORDER,
  targetPath = '/products',
  queryParamName = 'query',
}: AdvancedSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [showGreekPanel, setShowGreekPanel] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cursorPos, setCursorPos] = useState(0)

  // Initialize from URL params
  useEffect(() => {
    const speciesParam = searchParams.get('species')
    const queryParam = searchParams.get(queryParamName)

    if (speciesParam) {
      setSelectedSpecies(speciesParam.split(',').filter(Boolean))
    }
    if (queryParam) {
      setQuery(queryParam)
    }
  }, [searchParams, queryParamName])

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
    if (query.trim()) {
      params.set(queryParamName, query.trim())
    }
    router.push(`${targetPath}?${params.toString()}`)
  }, [selectedSpecies, query, router, targetPath, queryParamName])

  const removeTag = useCallback((type: string, value: string) => {
    if (type === 'species') {
      setSelectedSpecies((prev) => prev.filter((s) => s !== value))
    } else if (type === 'query') {
      setQuery('')
    }
  }, [])

  const insertGreekChar = useCallback((char: string) => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart || cursorPos
    const end = input.selectionEnd || cursorPos
    const before = query.slice(0, start)
    const after = query.slice(end)
    const newQuery = before + char + after
    setQuery(newQuery)
    const newPos = start + char.length
    setCursorPos(newPos)
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(newPos, newPos)
    })
    setShowGreekPanel(false)
  }, [query, cursorPos])

  const handleInputFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
    setShowGreekPanel(true)
  }, [])

  const handleInputBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setShowGreekPanel(false)
    }, 200)
  }, [])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    } else if (e.key === 'Escape') {
      setShowGreekPanel(false)
    }
  }, [handleSearch])

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  const hasFilters = selectedSpecies.length > 0 || query.trim()

  const displayedSpecies = SPECIES_ORDER

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      {/* Species Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-3">
          常用种属筛选 <span className="text-xs font-normal text-slate-400">（可多选）</span>
        </label>
        <div className="space-y-2">
          {/* Row 1: first 7 species */}
          <div className="grid grid-cols-7 gap-2">
            {displayedSpecies.slice(0, 7).map((species) => {
              const isSelected = selectedSpecies.includes(species)
              return (
                <button
                  key={species}
                  onClick={() => toggleSpecies(species)}
                  className={`relative flex flex-col items-center gap-1 px-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50/60 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-0.5 right-0.5">
                      <Check className="w-3 h-3 text-blue-500" />
                    </span>
                  )}
                  <SpeciesIcon species={species} className="w-4 h-4" />
                  <span className="truncate w-full text-center">{SPECIES_LABELS[species] || species}</span>
                </button>
              )
            })}
          </div>
          {/* Row 2: remaining species */}
          <div className="grid grid-cols-7 gap-2">
            {displayedSpecies.slice(7).map((species) => {
              const isSelected = selectedSpecies.includes(species)
              return (
                <button
                  key={species}
                  onClick={() => toggleSpecies(species)}
                  className={`relative flex flex-col items-center gap-1 px-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50/60 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-0.5 right-0.5">
                      <Check className="w-3 h-3 text-blue-500" />
                    </span>
                  )}
                  <SpeciesIcon species={species} className="w-4 h-4" />
                  <span className="truncate w-full text-center">{SPECIES_LABELS[species] || species}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Query Input with Greek Letter Panel */}
      <div className="relative">
        <label className="block text-sm font-semibold text-slate-900 mb-2">检测指标</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursorPos(e.target.selectionStart || 0)
            }}
            onKeyDown={handleInputKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="输入指标名称，如 IL-6、TNF-α、IFN-γ..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Greek & Roman Panel */}
        {showGreekPanel && (
          <div
            className="absolute z-20 mt-2 left-0 right-0 md:left-auto md:right-auto md:w-full bg-white rounded-xl shadow-lg border border-slate-200 p-3 max-h-64 overflow-y-auto"
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Triangle */}
            <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45" />
            <div className="relative space-y-2">
              <p className="text-xs font-semibold text-slate-500">特殊符号</p>

              {/* Greek Letters */}
              <div>
                <p className="text-[10px] text-slate-400 mb-1">希腊字母</p>
                <div className="grid grid-cols-12 gap-1">
                  {GREEK_CHARS.map((g) => (
                    <button
                      key={g.char}
                      title={g.name}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        insertGreekChar(g.char)
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded border border-slate-100 bg-slate-50 hover:bg-blue-600 hover:text-white hover:border-transparent transition-all text-xs"
                    >
                      {g.char}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roman Numerals */}
              <div>
                <p className="text-[10px] text-slate-400 mb-1">罗马数字</p>
                <div className="grid grid-cols-10 gap-1">
                  {ROMAN_NUMERALS.map((r) => (
                    <button
                      key={r.char}
                      title={r.name}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        insertGreekChar(r.char)
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded border border-slate-100 bg-slate-50 hover:bg-blue-600 hover:text-white hover:border-transparent transition-all text-xs"
                    >
                      {r.char}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 text-center pt-0.5">
                点击插入：IL-1β、TNF-α、IFN-γ、IL-Ⅱ…
              </p>
            </div>
          </div>
        )}
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
