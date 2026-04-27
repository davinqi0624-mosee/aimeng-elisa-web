'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FlaskConical,
  Loader2,
  Send,
  TestTube,
  Target,
  FileText,
  AlertCircle,
} from 'lucide-react'

interface Product {
  id: string
  name: string
  target: string
  detection_range: string
}

export default function ExperimentPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [sampleType, setSampleType] = useState('')
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetch('/api/experiment/products')
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products || [])
      })
      .catch(() => setError('加载产品列表失败'))
      .finally(() => setFetching(false))
  }, [])

  const handleGenerate = async () => {
    if (!productId || !sampleType || !purpose) {
      setError('请填写所有必填项')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/experiment/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, sampleType, purpose }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.detail || data.error)
      router.push(`/lab/experiment/${data.id}`)
    } catch (err: any) {
      const msg = err.message || ''
      const isApiError = msg.includes('API') || msg.includes('Key') || msg.includes('环境变量')
      setError(isApiError ? `DeepSeek API 调用失败: ${msg}\n请检查 Vercel 环境变量 DEEPSEEK_API_KEY 是否已配置。` : err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">实验方案生成器</h1>
          <p className="text-sm text-gray-500">基于 AI 的 ELISA 实验方案设计</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-1.5">
              <TestTube className="w-4 h-4 text-blue-600" />
              选择试剂盒 <span className="text-red-500">*</span>
            </span>
          </label>
          {fetching ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">请选择产品</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.target}) — 检测范围: {p.detection_range}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-600" />
              样本类型 <span className="text-red-500">*</span>
            </span>
          </label>
          <input
            value={sampleType}
            onChange={(e) => setSampleType(e.target.value)}
            placeholder="例如：小鼠血清、细胞培养上清、组织匀浆..."
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              检测目的 <span className="text-red-500">*</span>
            </span>
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="例如：检测 LPS 刺激后巨噬细胞分泌 IL-6 的水平变化，需要设置哪些对照组..."
            rows={4}
            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              AI 生成中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              生成实验方案
            </>
          )}
        </button>
      </div>
    </div>
  )
}
