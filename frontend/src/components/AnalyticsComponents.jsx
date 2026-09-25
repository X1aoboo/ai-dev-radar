import { useId } from 'react'

import EChart from './EChart'

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function sparklineSegments(values = [], width = 128, height = 34) {
  const numericValues = values.filter(isNumber)
  if (numericValues.length < 2) return []

  const min = Math.min(...numericValues)
  const range = Math.max(...numericValues) - min || 1
  const inset = 2
  const point = (value, index) => ({
    x: inset + (index / Math.max(1, values.length - 1)) * (width - inset * 2),
    y: height - inset - ((value - min) / range) * (height - inset * 2),
  })
  const segments = []
  let current = []
  values.forEach((value, index) => {
    if (isNumber(value)) current.push(point(value, index))
    else if (current.length) {
      segments.push(current)
      current = []
    }
  })
  if (current.length) segments.push(current)

  return segments
    .filter((segment) => segment.length > 1)
    .map((segment) => {
      const line = segment.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
      const first = segment[0]
      const last = segment.at(-1)
      return { line, area: `${line} L${last.x.toFixed(1)},${(height - 1).toFixed(1)} L${first.x.toFixed(1)},${(height - 1).toFixed(1)} Z` }
    })
}

export function AnalyticsSection({ title, description, action, children, className = '', id }) {
  const headingId = useId()
  return (
    <section id={id} className={`analytics-section ${className}`.trim()} aria-labelledby={headingId}>
      <header className="analytics-section__header">
        <div>
          <h2 id={headingId} className="analytics-section__title">{title}</h2>
          {description && <p className="analytics-section__description">{description}</p>}
        </div>
        {action && <div className="analytics-section__action">{action}</div>}
      </header>
      {children}
    </section>
  )
}

export function ChartCard({ title, eyebrow, description, option, ariaLabel, height = 245, onClick, action, children, loading = false, error, empty, className = '' }) {
  const headingId = useId()
  const hasChart = Boolean(option) && !loading && !error
  return (
    <article className={`analytics-chart-card${hasChart ? '' : ' analytics-chart-card--empty'} ${className}`.trim()} aria-labelledby={headingId}>
      <header className="analytics-chart-card__header">
        <div>
          {eyebrow && <p className="analytics-eyebrow">{eyebrow}</p>}
          <h2 id={headingId}>{title}</h2>
          {description && <p className="analytics-chart-card__description">{description}</p>}
        </div>
        {action}
      </header>
      {children}
      {loading && <div className="feedback-state" role="status">正在加载图表数据…</div>}
      {error && <div className="feedback-state feedback-state--error" role="alert">{error}</div>}
      {!loading && !error && hasChart && <EChart option={option} height={height} ariaLabel={ariaLabel} onClick={onClick} />}
      {!loading && !error && !hasChart && !children && <div className="feedback-state" role="status">{empty ?? '当前没有可展示的数据。'}</div>}
    </article>
  )
}

export function BenchmarkLegend({ label = '全公司均值', color = 'var(--color-data-average)', dashed = true, className = '' }) {
  return (
    <span className={`benchmark-legend ${className}`.trim()}>
      <i className={dashed ? 'benchmark-legend__line benchmark-legend__line--dashed' : 'benchmark-legend__line'} style={{ '--benchmark-color': color }} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export function AnalyticsDirectory({ label, title, count, items = [], groups = [], selectedId, onSelect, orientation = 'vertical', className = '' }) {
  function renderItem(item) {
    const selected = String(item.id) === String(selectedId)
    const content = <><span>{item.label}</span>{item.meta && <small>{item.meta}</small>}</>
    if (item.href) return <a key={item.id} className="analytics-directory__item" href={item.href} aria-current={selected ? 'location' : undefined}>{content}</a>
    return <button key={item.id} className="analytics-directory__item" type="button" aria-label={item.ariaLabel} aria-pressed={selected} disabled={item.disabled} onClick={() => onSelect?.(item.id)}>{content}</button>
  }

  return (
    <nav className={`analytics-directory analytics-directory--${orientation} ${className}`.trim()} aria-label={label}>
      {title && <header className="analytics-directory__header"><h2>{title}</h2>{count !== undefined && <span>{count}</span>}</header>}
      {groups.length
        ? groups.map((group) => <section className="analytics-directory__group" key={group.id ?? group.label}><h3>{group.label}</h3>{group.items.map(renderItem)}</section>)
        : items.map(renderItem)}
    </nav>
  )
}

export function MaturityMatrix({ label = '团队成熟度矩阵', columns = [], rows = [] }) {
  return (
    <div className="maturity-matrix">
      <div className="maturity-matrix__scroll" role="region" aria-label={`${label}，可横向滚动`} tabIndex={0}>
        <table className="maturity-matrix__table">
          <caption>{label}</caption>
          <thead><tr><th scope="col">团队</th>{columns.map((column) => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => (
            <tr className={row.kind === 'average' ? 'maturity-matrix__row--average' : undefined} key={row.id}>
              <th scope="row">{row.label}</th>
              {columns.map((column, index) => {
                const cell = row.values?.[index]
                const hasValue = cell?.text !== null && cell?.text !== undefined
                const level = hasValue && Number.isInteger(cell.level) && cell.level >= 0 && cell.level <= 5 ? cell.level : null
                return <td className={level === null ? 'maturity-matrix__cell--missing' : `maturity-matrix__cell--level-${level}`} key={column.id}>{cell?.text ?? '未评估'}</td>
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

export function TeamMatrix({ label = '团队指标矩阵', columns = [], rows = [], selectedId, onSelect }) {
  return (
    <div className="team-matrix">
      <div className="team-matrix__scroll" role="region" aria-label={`${label}，可横向滚动`} tabIndex={0}>
        <table className="team-matrix__table" aria-label={label}>
          <thead><tr><th scope="col">团队</th>{columns.map((column) => <th scope="col" key={column.id}><span>{column.label}</span>{column.context && <small>{column.context}</small>}</th>)}</tr></thead>
          <tbody>{rows.map((row) => (
            <tr className={`${row.kind === 'average' ? 'team-matrix__row--average' : ''}${String(row.id) === String(selectedId) ? ' team-matrix__row--selected' : ''}`} key={row.id}>
              <th scope="row">
                {row.kind === 'team' && onSelect
                  ? <button type="button" aria-label={`选择团队：${row.label}`} aria-pressed={String(row.id) === String(selectedId)} onClick={() => onSelect(row.id)}><i style={{ '--team-matrix-color': row.color ?? 'var(--color-data-team-1)' }} aria-hidden="true" />{row.label}</button>
                  : row.label}
              </th>
              {columns.map((column, index) => <td key={column.id}>{row.values?.[index]?.text ?? '—'}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
