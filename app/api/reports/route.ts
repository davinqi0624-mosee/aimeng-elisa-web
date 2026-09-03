import { NextRequest, NextResponse } from 'next/server'

type JsonRecord = Record<string, unknown>

interface ReportFit {
  model: string
  r2: number
  rmse?: number
  equation: string
  params: Record<string, number>
}

interface ReportStandard {
  well?: string
  concentration: number
  measuredOd: number
  predictedOd?: number
  residual?: number
  cv?: number
}

interface ReportSample {
  well?: string
  name: string
  od: number
  dilution: number
  calculatedConcentration?: number
  finalConcentration?: number
  status?: string
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatNumber(value: number | undefined, digits: number) {
  return value !== undefined && Number.isFinite(value) ? value.toFixed(digits) : '--'
}

function getParam(params: JsonRecord, key: string) {
  return asNumber(params[key]) ?? 0
}

function normalizeReport(rawBody: unknown): { fit: ReportFit; standards: ReportStandard[]; samples: ReportSample[]; rawData: string } {
  if (!isRecord(rawBody) || !isRecord(rawBody.result)) {
    throw new Error('报告数据为空或格式不正确')
  }

  const rawData = typeof rawBody.rawData === 'string' ? rawBody.rawData : ''
  const result = rawBody.result

  if (isRecord(result.fit)) {
    const fitRecord = result.fit
    const fit: ReportFit = {
      model: '4PL',
      r2: getParam(fitRecord, 'r2'),
      equation: typeof fitRecord.equation === 'string' ? fitRecord.equation : '',
      params: {
        A: getParam(fitRecord, 'A'),
        B: getParam(fitRecord, 'B'),
        C: getParam(fitRecord, 'C'),
        D: getParam(fitRecord, 'D'),
      },
    }

    const standards = Array.isArray(result.standards) ? result.standards.filter(isRecord).map((standard) => ({
      concentration: getParam(standard, 'concentration'),
      measuredOd: getParam(standard, 'od'),
      predictedOd: asNumber(standard.predicted),
      residual: asNumber(standard.residual),
    })) : []

    const samples = Array.isArray(result.samples) ? result.samples.filter(isRecord).map((sample) => ({
      name: String(sample.id || sample.name || ''),
      od: getParam(sample, 'od'),
      dilution: asNumber(sample.dilution) || 1,
      calculatedConcentration: asNumber(sample.concentration),
      finalConcentration: asNumber(sample.finalConcentration),
      status: asNumber(sample.finalConcentration) === undefined ? '超出量程' : '正常',
    })) : []

    return { fit, standards, samples, rawData }
  }

  const params = isRecord(result.params) ? result.params : {}
  const model = String(result.model || '4pl').toUpperCase()
  const fit: ReportFit = {
    model,
    r2: getParam(result, 'r2'),
    rmse: asNumber(result.rmse),
    equation:
      model === '4PL' || model === '5PL'
        ? `Y = ${formatNumber(asNumber(params.D), 4)} + (${formatNumber(asNumber(params.A), 4)} - ${formatNumber(asNumber(params.D), 4)}) / (1 + (X / ${formatNumber(asNumber(params.C), 4)}) ^ ${formatNumber(asNumber(params.B), 4)})`
        : '',
    params: Object.fromEntries(
      Object.entries(params)
        .map(([key, value]) => [key, asNumber(value)])
        .filter((entry): entry is [string, number] => entry[1] !== undefined)
    ),
  }

  const points = Array.isArray(result.points) ? result.points.filter(isRecord) : []
  const standards = Array.isArray(result.standards) ? result.standards.filter(isRecord).map((standard, index) => {
    const point = points[index]
    return {
      well: typeof standard.well === 'string' ? standard.well : undefined,
      concentration: getParam(standard, 'concentration'),
      measuredOd: getParam(standard, 'mean'),
      predictedOd: isRecord(point) ? asNumber(point.predicted) : undefined,
      residual: isRecord(point) ? asNumber(point.residual) : undefined,
      cv: asNumber(standard.cv),
    }
  }) : []

  const samples = Array.isArray(result.unknowns) ? result.unknowns.filter(isRecord).map((sample) => ({
    well: typeof sample.well === 'string' ? sample.well : undefined,
    name: String(sample.name || ''),
    od: getParam(sample, 'mean'),
    dilution: asNumber(sample.dilution) || 1,
    calculatedConcentration: asNumber(sample.calculatedConcentration),
    finalConcentration: asNumber(sample.concentration),
    status: String(sample.concentrationMessage || sample.concentrationStatus || '正常'),
  })) : []

  return { fit, standards, samples, rawData }
}

export async function POST(request: NextRequest) {
  try {
    const report = normalizeReport(await request.json())
    const { fit, standards, samples, rawData } = report

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>ELISA 分析报告</title>
<style>
body { font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 40px; color: #334155; line-height: 1.6; }
.header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
.header h1 { margin: 0; font-size: 24px; color: #1d4ed8; }
.header p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.section { margin-bottom: 24px; }
.section h2 { font-size: 16px; color: #1d4ed8; border-left: 4px solid #3b82f6; padding-left: 8px; margin-bottom: 12px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center; }
.stat-label { font-size: 12px; color: #64748b; }
.stat-value { font-size: 20px; font-weight: bold; color: #1d4ed8; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; }
th { background: #f8fafc; text-align: center; font-weight: 600; color: #475569; }
tr:nth-child(even) { background: #f8fafc; }
.left { text-align: left; }
.footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <h1>ELISA 定量分析报告</h1>
  <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
</div>

<div class="section">
  <h2>拟合参数</h2>
  <div class="stats">
    <div class="stat-box"><div class="stat-label">拟合模型</div><div class="stat-value">${escapeHtml(fit.model)}</div></div>
    <div class="stat-box"><div class="stat-label">R²</div><div class="stat-value">${formatNumber(fit.r2, 6)}</div></div>
    <div class="stat-box"><div class="stat-label">RMSE</div><div class="stat-value">${formatNumber(fit.rmse, 4)}</div></div>
    <div class="stat-box"><div class="stat-label">EC50 / C</div><div class="stat-value">${formatNumber(fit.params.C, 2)}</div></div>
  </div>
  ${fit.equation ? `<p><strong>拟合方程：</strong>${escapeHtml(fit.equation)}</p>` : ''}
</div>

<div class="section">
  <h2>标准曲线数据</h2>
  <table>
    <thead><tr><th>孔位</th><th>浓度 (pg/mL)</th><th>实测 OD</th><th>拟合 OD</th><th>残差</th></tr></thead>
    <tbody>
      ${standards.map((standard) => `
      <tr>
        <td>${escapeHtml(standard.well || '--')}</td>
        <td>${formatNumber(standard.concentration, 2)}</td>
        <td>${formatNumber(standard.measuredOd, 4)}</td>
        <td>${formatNumber(standard.predictedOd, 4)}</td>
        <td>${formatNumber(standard.residual, 4)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="section">
  <h2>样本浓度计算结果</h2>
  <table>
    <thead><tr><th>孔位</th><th>样本编号</th><th>OD</th><th>稀释倍数</th><th>反算浓度</th><th>最终浓度</th></tr></thead>
    <tbody>
      ${samples.map((sample) => `
      <tr>
        <td>${escapeHtml(sample.well || '--')}</td>
        <td class="left"><strong>${escapeHtml(sample.name)}</strong></td>
        <td>${formatNumber(sample.od, 4)}</td>
        <td>${formatNumber(sample.dilution, 2)}</td>
        <td>${formatNumber(sample.calculatedConcentration, 2)}</td>
        <td><strong>${formatNumber(sample.finalConcentration, 2)}</strong></td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

${rawData ? `<div class="section"><h2>原始数据</h2><pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-size:12px;overflow:auto">${escapeHtml(rawData)}</pre></div>` : ''}

<div class="footer">
  <p>本报告由 AIMENG UNING 爱萌优宁在线数据分析系统生成，仅供参考。</p>
  <p>实验决策请以实际情况和实验室 SOP 为准。</p>
</div>
</body>
</html>`

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="ELISA分析报告_${new Date().toISOString().slice(0, 10)}.html"`,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '报告生成失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
