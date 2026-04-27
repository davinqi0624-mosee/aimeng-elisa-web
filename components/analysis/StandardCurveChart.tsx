'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
} from 'recharts'

interface StandardPoint {
  concentration: number
  od: number
  predicted: number
}

export default function StandardCurveChart({ standards }: { standards: StandardPoint[] }) {
  const data = standards.map((s) => ({
    x: s.concentration,
    y: s.od,
    predicted: s.predicted,
  }))

  const fitData = standards.map((s) => ({
    x: s.concentration,
    y: s.predicted,
  }))

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">标准曲线</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="x"
            type="number"
            scale="log"
            domain={['auto', 'auto']}
            tick={{ fontSize: 12 }}
            label={{ value: '浓度 (pg/mL)', position: 'insideBottom', offset: -2, fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            label={{ value: 'OD值', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: any, name: any) => [Number(value).toFixed(3), name === 'y' ? '实测 OD' : '拟合曲线']}
            labelFormatter={(label: any) => `浓度: ${Number(label).toFixed(2)}`}
          />
          <Scatter data={data} fill="#10b981" />
          <Line type="monotone" data={fitData} dataKey="y" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
