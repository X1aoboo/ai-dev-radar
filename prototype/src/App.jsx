// 原型计划：总览页 3 个结构不同的变体 + 团队下钻页 2 个变体，
// 同一路由 ?variant= 切换 + 底部浮动切换器（←/→ 键循环）。一次性代码。
import { useEffect, useState } from 'react'
import { TEAMS } from './data/catalog'
import { describeSlice } from './data/compute'
import FilterBar from './components/FilterBar'
import PrototypeSwitcher from './components/PrototypeSwitcher'
import OverviewPage from './overview/OverviewPage'
import DrilldownPage from './drilldown/DrilldownPage'

export const OVERVIEW_VARIANTS = [
  { key: 'T', name: '趋势大图矩阵' },
  { key: 'C', name: '活动卡片矩阵（对照）' },
]
export const DRILL_VARIANTS = [
  { key: 'A', name: '团队概览 + 按需详情（A+B 结合）' },
  { key: 'B', name: '活动目录 + 主详情（对照）' },
]

function parseHash() {
  const h = window.location.hash.replace(/^#/, '') || '/'
  const [path, qs] = h.split('?')
  const params = new URLSearchParams(qs || '')
  const m = path.match(/^\/team\/(.+)$/)
  return { teamId: m ? decodeURIComponent(m[1]) : null, variant: params.get('variant') || 'A' }
}

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [filter, setFilter] = useState({ dim: 'time', gran: 'month', versionId: 'all', periodId: 'm8', metricSlot: 0 })

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const variants = route.teamId ? DRILL_VARIANTS : OVERVIEW_VARIANTS
  const variant = variants.some((v) => v.key === route.variant) ? route.variant : variants[0].key

  const setVariant = (key) => {
    const { teamId } = route
    window.location.hash = `#${teamId ? `/team/${teamId}` : '/'}?variant=${key}`
  }
  const nav = (teamId) => {
    window.location.hash = `#/team/${teamId}?variant=${variant}`
  }

  // ←/→ 循环切换变体（无输入框聚焦时）
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement && document.activeElement.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const idx = variants.findIndex((v) => v.key === variant)
      const next = e.key === 'ArrowRight' ? (idx + 1) % variants.length : (idx - 1 + variants.length) % variants.length
      setVariant(variants[next].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant, route.teamId])

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">ai-dev-radar</span>
        <span className="tag">一次性原型</span>
        <nav>
          <a href={`#/?variant=${variant}`} className={!route.teamId ? 'active' : ''}>总览</a>
          {TEAMS.map((t) => (
            <a key={t.id} href={`#/team/${t.id}?variant=${variant}`} className={route.teamId === t.id ? 'active' : ''}>{t.name}</a>
          ))}
        </nav>
      </header>

      <FilterBar filter={filter} setFilter={setFilter} showMetricSlot={!route.teamId} />
      <div className="page">
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 12.5, color: '#898781' }}>当前切片：{describeSlice(filter)}</p>
        {route.teamId && TEAMS.some((t) => t.id === route.teamId)
          ? <DrilldownPage teamId={route.teamId} variant={variant} filter={filter} />
          : <OverviewPage variant={variant} filter={filter} nav={nav} />}
      </div>

      <PrototypeSwitcher variants={variants} current={variant} onChange={setVariant} />
    </div>
  )
}
