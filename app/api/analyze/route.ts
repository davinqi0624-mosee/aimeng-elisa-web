import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/user-auth'
import { withUser } from '@/lib/db/pg'
import { fit4PL, fourPL, fourPLInverse } from '@/lib/elisa-4pl-core'

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

    const fit = fit4PL(
      standards.map(s => s.concentration),
      standards.map(s => s.od)
    )
    const standardsOut = standards.map((s) => {
      const predicted = fourPL(s.concentration, fit.A, fit.B, fit.C, fit.D)
      return { ...s, predicted, residual: s.od - predicted }
    })

    const samplesOut = samples.map((s) => {
      const calculated = fourPLInverse(s.od, fit.A, fit.B, fit.C, fit.D)
      const conc = Number.isFinite(calculated) ? calculated : null
      return {
        ...s,
        concentration: conc,
        finalConcentration: conc !== null ? conc * s.dilution : null,
      }
    })

    const equation = `OD = ${fit.D.toFixed(4)} + (${fit.A.toFixed(4)} - ${fit.D.toFixed(4)}) / (1 + (Conc / ${fit.C.toFixed(4)}) ^ ${fit.B.toFixed(4)})`

    // Save to history if logged in (best-effort)
    const user = await getCurrentUser()
    if (user) {
      try {
        await withUser(user.id, async (tx) => {
          await tx`
            INSERT INTO analysis_reports (user_id, title, raw_data, processed_data, standard_curve)
            VALUES (
              ${user.id},
              '4PL 标准曲线分析',
              ${JSON.stringify(rawData)}::jsonb,
              ${JSON.stringify({ standards: standardsOut, samples: samplesOut })}::jsonb,
              ${JSON.stringify(fit)}::jsonb
            )
          `
        })
      } catch (historyError) {
        console.warn('[analyze] history save skipped:', historyError)
      }
    }

    return NextResponse.json({
      fit: { ...fit, equation },
      standards: standardsOut,
      samples: samplesOut,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '分析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
