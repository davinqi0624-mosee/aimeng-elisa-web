'use client'

import { useEffect, useState, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'

interface Agent {
  province: string
  province_code?: string
  city?: string
  company_name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
}

interface ChinaAgentMapProps {
  agents: Agent[]
  onProvinceClick?: (province: string, agents: Agent[]) => void
}

// 省份名称到 geoJSON 名称的映射（处理简称差异）
const PROVINCE_NAME_MAP: Record<string, string> = {
  '北京': '北京市',
  '天津': '天津市',
  '上海': '上海市',
  '重庆': '重庆市',
  '河北': '河北省',
  '山西': '山西省',
  '辽宁': '辽宁省',
  '吉林': '吉林省',
  '黑龙江': '黑龙江省',
  '江苏': '江苏省',
  '浙江': '浙江省',
  '安徽': '安徽省',
  '福建': '福建省',
  '江西': '江西省',
  '山东': '山东省',
  '河南': '河南省',
  '湖北': '湖北省',
  '湖南': '湖南省',
  '广东': '广东省',
  '海南': '海南省',
  '四川': '四川省',
  '贵州': '贵州省',
  '云南': '云南省',
  '陕西': '陕西省',
  '甘肃': '甘肃省',
  '青海': '青海省',
  '台湾': '台湾省',
  '内蒙古': '内蒙古自治区',
  '广西': '广西壮族自治区',
  '西藏': '西藏自治区',
  '宁夏': '宁夏回族自治区',
  '新疆': '新疆维吾尔自治区',
  '香港': '香港特别行政区',
  '澳门': '澳门特别行政区',
}

export default function ChinaAgentMap({ agents, onProvinceClick }: ChinaAgentMapProps) {
  const [geoLoaded, setGeoLoaded] = useState(false)
  const [geoError, setGeoError] = useState(false)

  // 获取有代理商的省份集合
  const agentProvinces = new Set(
    agents.map((a) => PROVINCE_NAME_MAP[a.province] || a.province)
  )

  // 加载 geoJSON
  useEffect(() => {
    if (echarts.getMap('china')) {
      setGeoLoaded(true)
      return
    }

    fetch('/geo/china.json')
      .then((res) => res.json())
      .then((geoJson) => {
        echarts.registerMap('china', geoJson)
        setGeoLoaded(true)
      })
      .catch(() => {
        setGeoError(true)
      })
  }, [])

  const handleClick = useCallback(
    (params: any) => {
      if (!onProvinceClick || !params?.name) return
      // 从 geoJSON 名称反查原始省份名称
      const provinceName = params.name
      const matchedAgents = agents.filter(
        (a) =>
          (PROVINCE_NAME_MAP[a.province] || a.province) === provinceName
      )
      if (matchedAgents.length > 0) {
        onProvinceClick(provinceName, matchedAgents)
      }
    },
    [agents, onProvinceClick]
  )

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const hasAgent = agentProvinces.has(params.name)
        const count = agents.filter(
          (a) => (PROVINCE_NAME_MAP[a.province] || a.province) === params.name
        ).length
        return `${params.name}<br/>${hasAgent ? `代理商: ${count} 家` : '暂无代理商'}`
      },
    },
    series: [
      {
        name: '代理商分布',
        type: 'map',
        map: 'china',
        roam: true,
        scaleLimit: { min: 1, max: 5 },
        zoom: 1.2,
        label: {
          show: false,
        },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 'bold' },
          itemStyle: {
            areaColor: '#10b981',
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.2)',
          },
        },
        itemStyle: {
          borderColor: '#cbd5e1',
          borderWidth: 1,
        },
        data: Array.from(agentProvinces).map((name) => ({
          name,
          value: agents.filter(
            (a) => (PROVINCE_NAME_MAP[a.province] || a.province) === name
          ).length,
          itemStyle: {
            areaColor: '#3b82f6',
          },
        })),
      },
    ],
    visualMap: {
      show: false,
      min: 0,
      max: 1,
      inRange: {
        color: ['#f1f5f9', '#e2e8f0'],
      },
    },
  }

  if (geoError) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-slate-400 text-sm">地图加载失败，请检查网络连接</p>
      </div>
    )
  }

  if (!geoLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-slate-400 text-sm">地图加载中...</p>
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      onEvents={{
        click: handleClick,
      }}
    />
  )
}
