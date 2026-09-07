// 骨架页：验证 前端 → /api 代理 → 后端 → 种子数据 全链路。
// 页面开发（总览页/下钻页等）是后续票的事，这里只做数据连通性展示。
import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'

export default function App() {
  const [catalog, setCatalog] = useState(null)
  const [teams, setTeams] = useState(null)
  const [facts, setFacts] = useState(null)
  const [error, setError] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/catalog').then((r) => r.json()),
      fetch('/api/teams').then((r) => r.json()),
      fetch('/api/facts').then((r) => r.json()),
    ])
      .then(([c, t, f]) => {
        setCatalog(c)
        setTeams(t)
        setFacts(f)
      })
      .catch(setError)
  }, [])

  // ECharts 接线检查：各团队事实记录数条形图（骨架占位，非正式页面）
  useEffect(() => {
    if (!teams || !facts || !chartRef.current) return
    const counts = Object.entries(
      facts.reduce((acc, f) => ((acc[f.team_id] = (acc[f.team_id] ?? 0) + 1), acc), {}),
    )
    const chart = echarts.init(chartRef.current)
    chart.setOption({
      grid: { left: 80, right: 24, top: 24, bottom: 32 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: counts.map(([id]) => teams.find((t) => t.id === Number(id))?.name ?? id),
      },
      series: [{ type: 'bar', barMaxWidth: 24, data: counts.map(([, n]) => n) }],
    })
    return () => chart.dispose()
  }, [teams, facts])

  if (error) return <p style={{ color: 'crimson' }}>后端连接失败：{String(error)}</p>
  if (!catalog) return <p>加载中…</p>

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', margin: '2rem' }}>
      <h1>ai-dev-radar</h1>
      <p>
        活动 {catalog.length} 个（关键 {catalog.filter((a) => a.kind === 'key').length} / 通用{' '}
        {catalog.filter((a) => a.kind === 'general').length}）、团队 {teams.length} 个、事实记录{' '}
        {facts.length} 条。
      </p>
      <ul>
        {catalog.map((a) => (
          <li key={a.code}>
            {a.name}（{a.kind === 'key' ? '关键研发活动' : '通用研发能力'}）：
            {a.metrics.map((m) => `${m.name}[${m.type}]`).join('、')}
          </li>
        ))}
      </ul>
      <div ref={chartRef} style={{ width: '100%', height: 240 }} />
    </main>
  )
}
