import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export default function EChart({ option, height = 240, ariaLabel, onClick }) {
  const elementRef = useRef(null)
  const chartRef = useRef(null)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    if (!elementRef.current) return undefined

    const chart = echarts.init(elementRef.current)
    chartRef.current = chart
    const resizeObserver = new ResizeObserver(() => chart.resize())
    resizeObserver.observe(elementRef.current)
    chart.on('click', (params) => clickRef.current?.(params))

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  return <div ref={elementRef} className="overview-chart" role="img" aria-label={ariaLabel} style={{ height }} />
}
