import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

// 最小 ECharts 包装：setOption 全量替换 + 自适应尺寸 + click 事件
export default function EChart({ option, height = 200, onClick }) {
  const ref = useRef(null)
  const chartRef = useRef(null)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    const chart = echarts.init(ref.current)
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    chart.on('click', (p) => clickRef.current && clickRef.current(p))
    return () => { ro.disconnect(); chart.dispose() }
  }, [])

  useEffect(() => {
    chartRef.current && chartRef.current.setOption(option, true)
  }, [option])

  return <div ref={ref} style={{ height, width: '100%' }} />
}
