import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseCSV(raw: string): Array<Record<string, string>> {
  const lines = raw.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) throw new Error('数据格式错误：至少需要标题行和一行数据')
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => (row[h] = values[i] || ''))
    return row
  })
}

// Four-parameter logistic regression (4-PL)
// y = D + (A - D) / (1 + (x / C) ^ B)
function fit4PL(
  standards: Array<{ concentration: number; od: number }>
): { A: number; B: number; C: number; D: number; r2: number } {
  // Initial guesses
  const ods = standards.map((s) => s.od)
  const concs = standards.map((s) => s.concentration)
  let A = Math.min(...ods) * 0.95
  let D = Math.max(...ods) * 1.05
  let C = concs[Math.floor(concs.length / 2)]
  let B = 1.0

  // Simple iterative optimization (gradient descent-ish)
  const lr = 0.01
  for (let iter = 0; iter < 5000; iter++) {
    let dA = 0, dB = 0, dC = 0, dD = 0
    let sse = 0
    for (const s of standards) {
      const x = s.concentration
      const yObs = s.od
      const denom = 1 + Math.pow(x / C, B)
      const yPred = D + (A - D) / denom
      const err = yObs - yPred
      sse += err * err

      dA += err / denom
      dD += err * (1 - 1 / denom)
      const inner = Math.pow(x / C, B)
      if (inner > 0) {
        const dDenom_dB = inner * Math.log(x / C)
        dB += err * ((D - A) / (denom * denom)) * dDenom_dB
        const dDenom_dC = -B * inner / C
        dC += err * ((D - A) / (denom * denom)) * dDenom_dC
      }
    }
    A += dA * lr
    D += dD * lr
    B += dB * lr * 0.1
    C += dC * lr * 0.1
    // Constrain
    if (B < 0.1) B = 0.1
    if (C <= 0) C = 0.01
  }

  // Compute R²
  const meanY = ods.reduce((a, b) => a + b, 0) / ods.length
  let ssTot = 0, ssRes = 0
  for (const s of standards) {
    const denom = 1 + Math.pow(s.concentration / C, B)
    const yPred = D + (A - D) / denom
    ssTot += Math.pow(s.od - meanY, 2)
    ssRes += Math.pow(s.od - yPred, 2)
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { A, B, C, D, r2 }
}

function predictConcentration(od: number, A: number, B: number, C: number, D: number): number | null {
  if (od <= A || od >= D) return null
  // Inverse: x = C * ((A - D) / (y - D) - 1) ^ (1 / B)
  const inner = (A - D) / (od - D) - 1
  if (inner <= 0) return null
  return C * Math.pow(inner, 1 / B)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rawData } = body
    if (!rawData) return NextResponse.json({ error: '数据为空' }, { status: 400 })

    const rows = parseCSV(rawData)

    const standards: Array<{ concentration: number; od: number }> = []
    const samples: Array<{
      id: string
      od: number
      dilution: number
      concentration: number | null
      finalConcentration: number | null
    }> = []

    for (const row of rows) {
      const type = (row['类型'] || row['type'] || '').toLowerCase()
      const odStr = row['OD值'] || row['od'] || row['OD'] || ''
      const od = parseFloat(odStr)
      if (Number.isNaN(od)) continue

      if (type.includes('标准') || type.includes('std')) {
        const concStr = row['浓度'] || row['concentration'] || ''
        const concentration = parseFloat(concStr)
        if (!Number.isNaN(concentration)) {
          standards.push({ concentration, od })
        }
      } else if (type.includes('样本') || type.includes('sample')) {
        const id = row['编号'] || row['id'] || row['name'] || ''
        const dilStr = row['稀释倍数'] || row['dilution'] || '1'
        const dilution = parseFloat(dilStr) || 1
        samples.push({ id, od, dilution, concentration: null, finalConcentration: null })
      }
    }

    if (standards.length < 4) {
      return NextResponse.json({ error: `标准品数据不足，至少需要 4 个浓度点，当前 ${standards.length} 个` }, { status: 400 })
    }

    const fit = fit4PL(standards)
    const standardsOut = standards.map((s) => {
      const denom = 1 + Math.pow(s.concentration / fit.C, fit.B)
      const predicted = fit.D + (fit.A - fit.D) / denom
      return { ...s, predicted, residual: s.od - predicted }
    })

    const samplesOut = samples.map((s) => {
      const conc = predictConcentration(s.od, fit.A, fit.B, fit.C, fit.D)
      return {
        ...s,
        concentration: conc,
        finalConcentration: conc !== null ? conc * s.dilution : null,
      }
    })

    const equation = `OD = ${fit.D.toFixed(4)} + (${fit.A.toFixed(4)} - ${fit.D.toFixed(4)}) / (1 + (Conc / ${fit.C.toFixed(4)}) ^ ${fit.B.toFixed(4)})`

    // Save to history if logged in
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const setupSql = `
        CREATE TABLE IF NOT EXISTS analysis_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          raw_data TEXT,
          fit_params JSONB,
          standards JSONB,
          samples JSONB,
          created_at TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow all analysis" ON analysis_reports;
        CREATE POLICY "Allow all analysis" ON analysis_reports FOR ALL USING (true) WITH CHECK (true);
      `
      try { await supabase.rpc('exec_sql', { sql: setupSql }) } catch { /* ignore */ }
      await supabase.from('analysis_reports').insert({
        user_id: user.id,
        raw_data: rawData,
        fit_params: fit,
        standards: standardsOut,
        samples: samplesOut,
      })
    }

    return NextResponse.json({
      fit: { ...fit, equation },
      standards: standardsOut,
      samples: samplesOut,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
