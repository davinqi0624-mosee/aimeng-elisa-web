'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  ArrowLeft,
  Loader2,
  FlaskConical,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Package,
  X,
  Eye,
  Tag,
  Beaker,
  DollarSign,
  ArrowRight,
} from 'lucide-react'

interface Antibody {
  id: string
  supplier: string
  catalog_number: string
  target: string
  species: string
  host: string
}

interface PreviewData {
  preview: boolean
  name: string
  slug: string
  target: string
  species: string
  method: string
  catalogNumber: string
  detectionRange: string
  sensitivity: string
  description: string
  price: number
  size: string
}

export default function DatasheetGeneratePage() {
  const router = useRouter()
  const [target, setTarget] = useState('')
  const [species, setSpecies] = useState('Human')
  const [method, setMethod] = useState('sandwich')
  const [size, setSize] = useState('96T')
  const [antibodyId, setAntibodyId] = useState('')
  const [antibodies, setAntibodies] = useState<Antibody[]>([])
  const [loadingAbs, setLoadingAbs] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [publishPrice, setPublishPrice] = useState(2800)

  const [customSupplier, setCustomSupplier] = useState('')
  const [customCatalog, setCustomCatalog] = useState('')
  const [customHost, setCustomHost] = useState('')
  const [customClone, setCustomClone] = useState('')
  const [useCustomAb, setUseCustomAb] = useState(false)

  useEffect(() => {
    fetch('/api/user/points')
      .then((r) => r.json())
      .then((d) => setRole(d.role || null))
      .catch(() => setRole(null))
  }, [])

  useEffect(() => {
    if (!target) return
    setLoadingAbs(true)
    fetch(`/api/antibodies?target=${encodeURIComponent(target)}`)
      .then((r) => r.json())
      .then((d) => setAntibodies(d.antibodies || []))
      .catch(() => setAntibodies([]))
      .finally(() => setLoadingAbs(false))
  }, [target])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !species || !method) {
      setError('请填写靶标、种属和实验方法')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const body: any = { target, species, method, size, antibodyId: antibodyId || undefined }
      if (useCustomAb || (!antibodyId && antibodies.length === 0)) {
        body.customAntibody = {
          supplier: customSupplier || '自定义',
          catalog_number: customCatalog || 'N/A',
          host: customHost || '未知',
          clone_number: customClone || 'N/A',
          target,
          species,
        }
      }
      const res = await fetch('/api/datasheet/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
      setError(err.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const openPreview = async () => {
    setPublishing(true)
    setPublishError('')
    try {
      const res = await fetch('/api/admin/products/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasheetId: result.id, preview: true }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPreviewData(data)
      setPublishPrice(data.price || 2800)
      setPreviewOpen(true)
    } catch (err: any) {
      setPublishError(err.message || '预览失败')
    } finally {
      setPublishing(false)
    }
  }

  const confirmPublish = async () => {
    setPublishing(true)
    try {
      const res = await fetch('/api/admin/products/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasheetId: result.id, price: publishPrice }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPreviewOpen(false)
      router.push(`/products/${data.slug}`)
    } catch (err: any) {
      setPublishError(err.message || '上架失败')
    } finally {
      setPublishing(false)
    }
  }

  const methodLabel = (m: string) => {
    if (m === 'sandwich') return '夹心法 ELISA'
    if (m === 'competitive') return '竞争法 ELISA'
    if (m === 'chemiluminescence') return '化学发光法'
    return m
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/datasheet" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">生成试剂盒说明书</h1>
          <p className="text-xs text-gray-500">AI 辅助生成专业 ELISA 试剂盒说明书</p>
        </div>
      </div>

      {role === null && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {role !== 'super' && role !== 'level1' && role !== 'level2' && role !== null && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">无权访问</p>
            <p className="mt-1">仅管理员可生成说明书。如需访问，请联系管理员开通权限。</p>
            <Link
              href="/datasheet"
              className="inline-flex items-center gap-1 mt-3 text-blue-600 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回说明书列表
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {result ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">说明书生成成功</p>
              <p className="text-xs text-emerald-600">{result.title}</p>
              {result.catalogNumber && (
                <p className="text-xs text-emerald-600 mt-1">货号：{result.catalogNumber}</p>
              )}
            </div>
          </div>

          {publishError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4" />
              {publishError}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push(`/datasheet/${result.id}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              查看完整说明书
            </button>
            <button
              onClick={openPreview}
              disabled={publishing}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {publishing && previewOpen === false ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载预览...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  预览并上架
                </>
              )}
            </button>
            <button
              onClick={() => {
                setResult(null)
                setError('')
                setPublishError('')
                setPreviewOpen(false)
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              再生成一份
            </button>
          </div>
        </div>
      ) : (role === 'super' || role === 'level1' || role === 'level2') ? (
        <form onSubmit={handleGenerate} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                检测靶标 <span className="text-red-500">*</span>
              </label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="例如：IL-6, TNF-α, IFN-γ"
                required
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                适用种属 <span className="text-red-500">*</span>
              </label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Human">Human（人）</option>
                <option value="Mouse">Mouse（小鼠）</option>
                <option value="Rat">Rat（大鼠）</option>
                <option value="Rabbit">Rabbit（兔）</option>
                <option value="Monkey">Monkey（猴）</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              实验方法 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'sandwich', label: '夹心法 ELISA', desc: '双抗体夹心，高灵敏度' },
                { value: 'competitive', label: '竞争法 ELISA', desc: '小分子检测，特异性强' },
                { value: 'chemiluminescence', label: '化学发光法', desc: '超灵敏，宽线性范围' },
              ].map((m) => (
                <label
                  key={m.value}
                  className={`cursor-pointer border rounded-lg p-3 transition-colors ${
                    method === m.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.value}
                    checked={method === m.value}
                    onChange={(e) => setMethod(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">{m.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              规格 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: '96T', label: '96T', suffix: 'M' },
                { value: '48T', label: '48T', suffix: 'S' },
              ].map((s) => (
                <label
                  key={s.value}
                  className={`cursor-pointer border rounded-lg p-3 transition-colors text-center ${
                    size === s.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="size"
                    value={s.value}
                    checked={size === s.value}
                    onChange={(e) => setSize(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900">{s.label}</span>
                  <p className="text-xs text-gray-500 mt-1">货号后缀 {s.suffix}</p>
                </label>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">选择抗体（可选）</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomAb}
                  onChange={(e) => {
                    setUseCustomAb(e.target.checked)
                    if (!e.target.checked) {
                      setCustomSupplier('')
                      setCustomCatalog('')
                      setCustomHost('')
                      setCustomClone('')
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                手动填写抗体信息
              </label>
            </div>

            {!useCustomAb ? (
              <div className="relative">
                <select
                  value={antibodyId}
                  onChange={(e) => setAntibodyId(e.target.value)}
                  disabled={loadingAbs}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                >
                  <option value="">
                    {loadingAbs ? '搜索抗体中...' : antibodies.length === 0 ? '未找到匹配抗体（可留空）' : '请选择抗体'}
                  </option>
                  {antibodies.map((ab) => (
                    <option key={ab.id} value={ab.id}>
                      {ab.supplier} | {ab.catalog_number} | {ab.target} ({ab.species}) | 宿主: {ab.host}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                {target && antibodies.length === 0 && !loadingAbs && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    未在目录中找到「{target}」相关抗体，可勾选上方"手动填写"或留空生成。
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">供应商</label>
                  <input
                    value={customSupplier}
                    onChange={(e) => setCustomSupplier(e.target.value)}
                    placeholder="例如：Abcam, R&D Systems"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">货号</label>
                  <input
                    value={customCatalog}
                    onChange={(e) => setCustomCatalog(e.target.value)}
                    placeholder="例如：ab9324"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">宿主</label>
                  <input
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    placeholder="例如：Mouse, Rabbit"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">克隆号</label>
                  <input
                    value={customClone}
                    onChange={(e) => setCustomClone(e.target.value)}
                    placeholder="例如：2A5, POLY"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI 正在生成说明书...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                生成说明书
              </>
            )}
          </button>
        </form>
      ) : null}

      {/* Preview Modal */}
      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                商品上架预览
              </h2>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Tag className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">商品名称</p>
                    <p className="text-sm font-medium text-gray-900">{previewData.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Beaker className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">货号</p>
                    <p className="text-sm font-medium text-gray-900">{previewData.catalogNumber}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">检测范围</p>
                    <p className="text-sm font-medium text-gray-900">{previewData.detectionRange}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FlaskConical className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">灵敏度</p>
                    <p className="text-sm font-medium text-gray-900">{previewData.sensitivity}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <DollarSign className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">价格（元）</p>
                    <input
                      type="number"
                      value={publishPrice}
                      onChange={(e) => setPublishPrice(Number(e.target.value))}
                      className="w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>Slug: <code className="text-gray-700 bg-gray-100 px-1 py-0.5 rounded">{previewData.slug}</code></p>
                <p>规格: {previewData.size}</p>
                <p>方法: {methodLabel(previewData.method)}</p>
                <p>种属: {previewData.species}</p>
              </div>

              {publishError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  {publishError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmPublish}
                disabled={publishing}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {publishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    上架中...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    确认上架
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
