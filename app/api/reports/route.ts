import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { result, rawData } = body
    const fit = result.fit
    const standards = result.standards
    const samples = result.samples

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>ELISA 分析报告</title>
<style>
body { font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 40px; color: #333; line-height: 1.6; }
.header { border-bottom: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
.header h1 { margin: 0; font-size: 24px; color: #059669; }
.header p { margin: 4px 0 0; color: #6b7280; font-size: 14px; }
.section { margin-bottom: 24px; }
.section h2 { font-size: 16px; color: #059669; border-left: 4px solid #10b981; padding-left: 8px; margin-bottom: 12px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center; }
.stat-label { font-size: 12px; color: #6b7280; }
.stat-value { font-size: 20px; font-weight: bold; color: #059669; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: right; }
th { background: #f9fafb; text-align: center; font-weight: 600; }
tr:nth-child(even) { background: #f9fafb; }
.footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
.r2-good { color: #059669; }
.r2-ok { color: #d97706; }
.r2-bad { color: #dc2626; }
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
    <div class="stat-box">
      <div class="stat-label">R² 决定系数</div>
      <div class="stat-value ${fit.r2 >= 0.99 ? 'r2-good' : fit.r2 >= 0.95 ? 'r2-ok' : 'r2-bad'}">${fit.r2.toFixed(4)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">A (下限)</div>
      <div class="stat-value">${fit.A.toFixed(4)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">D (上限)</div>
      <div class="stat-value">${fit.D.toFixed(4)}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">C (EC50)</div>
      <div class="stat-value">${fit.C.toFixed(2)}</div>
    </div>
  </div>
  <p><strong>拟合方程：</strong>${fit.equation}</p>
</div>

<div class="section">
  <h2>标准曲线数据</h2>
  <table>
    <thead>
      <tr>
        <th>浓度 (pg/mL)</th>
        <th>实测 OD</th>
        <th>拟合 OD</th>
        <th>残差</th>
      </tr>
    </thead>
    <tbody>
      ${standards.map((s: any) => `
      <tr>
        <td>${s.concentration.toFixed(2)}</td>
        <td>${s.od.toFixed(4)}</td>
        <td>${s.predicted.toFixed(4)}</td>
        <td>${s.residual.toFixed(4)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="section">
  <h2>样本浓度计算结果</h2>
  <table>
    <thead>
      <tr>
        <th>样本编号</th>
        <th>OD值</th>
        <th>稀释倍数</th>
        <th>计算浓度 (pg/mL)</th>
        <th>最终浓度 (pg/mL)</th>
      </tr>
    </thead>
    <tbody>
      ${samples.map((s: any) => `
      <tr>
        <td style="text-align:center;font-weight:600">${s.id}</td>
        <td>${s.od.toFixed(3)}</td>
        <td>${s.dilution || 1}</td>
        <td>${s.concentration !== null ? s.concentration.toFixed(2) : '—'}</td>
        <td><strong>${s.finalConcentration !== null ? s.finalConcentration.toFixed(2) : '—'}</strong></td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="section">
  <h2>原始数据</h2>
  <pre style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:12px;overflow:auto">${rawData}</pre>
</div>

<div class="footer">
  <p>本报告由爱萌优宁 在线数据分析系统生成，仅供参考。</p>
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
