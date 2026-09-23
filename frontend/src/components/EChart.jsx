import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { chartTheme } from '../charts/chartTheme'

export default function EChart({ option, height = 240, ariaLabel, onClick, onKeyActivate }) {
  const elementRef = useRef(null)
  const chartRef = useRef(null)
  const clickRef = useRef(onClick)
  const keyActivateRef = useRef(onKeyActivate)
  clickRef.current = onClick
  keyActivateRef.current = onKeyActivate

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
    if (!chartRef.current || !option) return
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const themedOption = { textStyle: { fontFamily: chartTheme.fontFamily }, ...option }
    chartRef.current.setOption(reducedMotion
      ? { ...themedOption, animation: false, animationDuration: 0, animationDurationUpdate: 0 }
      : themedOption, true)
  }, [option])

  const interactive = typeof onClick === 'function'
  function handleKeyDown(event) {
    if (!interactive || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    if (keyActivateRef.current) keyActivateRef.current()
    else clickRef.current?.({})
  }

  return <div ref={elementRef} className="overview-chart" role={interactive ? 'button' : 'img'} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? `${ariaLabel}，按 Enter 键激活` : ariaLabel} onKeyDown={handleKeyDown} style={{ height }} />
}
