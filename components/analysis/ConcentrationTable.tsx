'use client'

interface Sample {
  id: string
  od: number
  concentration: number | null
  dilution: number
  finalConcentration: number | null
}

export default function ConcentrationTable({ samples }: { samples: Sample[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">样本浓度计算结果</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">样本编号</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">OD值</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">稀释倍数</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">计算浓度 (pg/mL)</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700">最终浓度 (pg/mL)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {samples.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{s.id}</td>
                <td className="px-3 py-2 text-right text-gray-700">{s.od.toFixed(3)}</td>
                <td className="px-3 py-2 text-right text-gray-700">{s.dilution || 1}</td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {s.concentration !== null ? s.concentration.toFixed(2) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                  {s.finalConcentration !== null ? s.finalConcentration.toFixed(2) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
