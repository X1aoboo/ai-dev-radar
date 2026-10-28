import React, { Fragment, useId } from 'react'

import EChart from './EChart'

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function sparklineSegments(values = [], width = 128, height = 34) {
  const numericValues = values.filter(isNumber)
  if (numericValues.length < 2) return []

  const min = Math.min(...numericValues)
  const range = Math.max(...numericValues) - min
  const inset = 2
  const point = (value, index) => ({
    x: inset + (index / Math.max(1, values.length - 1)) * (width - inset * 2),
    y: range ? height - inset - ((value - min) / range) * (height - inset * 2) : height * 0.28,
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
      return { line, area: `${line} L${last.x.toFixed(1)},${(height - 1).toFixed(1)} L${first.x.toFixed(1)},${(height - 1).toFixed(1)} Z`, end: last }
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

export function ChartCard({ title, eyebrow, description, option, ariaLabel, height = 245, onClick, action, children, loading = false, error, empty, reservePlotSpace = false, className = '' }) {
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
      {!reservePlotSpace && loading && <div className="feedback-state" role="status">正在加载图表数据…</div>}
      {!reservePlotSpace && error && <div className="feedback-state feedback-state--error" role="alert">{error}</div>}
      {!loading && !error && hasChart && <EChart option={option} height={height} ariaLabel={ariaLabel} onClick={onClick} />}
      {reservePlotSpace && (loading || error || (!hasChart && !children)) && <div className="analytics-chart-card__plot-state" style={{ height }}>
        {loading && <div className="feedback-state" role="status">正在加载图表数据…</div>}
        {error && <div className="feedback-state feedback-state--error" role="alert">{error}</div>}
        {!loading && !error && <div className="feedback-state" role="status">{empty ?? '当前没有可展示的数据。'}</div>}
      </div>}
      {!reservePlotSpace && !loading && !error && !hasChart && !children && <div className="feedback-state" role="status">{empty ?? '当前没有可展示的数据。'}</div>}
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

export function AnalyticsDirectory({ label, title, count, items = [], groups = [], selectedId, pendingId, onSelect, orientation = 'vertical', className = '' }) {
  function renderItem(item) {
    const selected = String(item.id) === String(selectedId)
    const pending = String(item.id) === String(pendingId)
    const content = <><span className="analytics-directory__label">{item.icon && <span className="analytics-directory__icon" aria-hidden="true">{item.icon}</span>}<span className="analytics-directory__label-text">{item.label}</span></span>{(item.meta || pending) && <small className={pending ? 'analytics-directory__pending' : undefined} role={pending ? 'status' : undefined}>{pending ? '切换中' : item.meta}</small>}</>
    if (item.href) return <a key={item.id} className="analytics-directory__item" href={item.href} aria-current={selected ? 'location' : undefined}>{content}</a>
    return <button key={item.id} className="analytics-directory__item" type="button" aria-label={item.ariaLabel} aria-pressed={selected} aria-busy={pending || undefined} disabled={item.disabled} onClick={() => onSelect?.(item.id)}>{content}</button>
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

export function MaturityMatrix({ label = '团队成熟度矩阵', rowHeading = '团队', columns = [], rows = [] }) {
  return (
    <div className="maturity-matrix">
      <div className="maturity-matrix__scroll" role="region" aria-label={`${label}，可横向滚动`} tabIndex={0}>
        <table className="maturity-matrix__table">
          <caption>{label}</caption>
          <thead><tr><th scope="col">{rowHeading}</th>{columns.map((column) => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead>
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

export function TeamMatrix({ label = '团队指标矩阵', columns = [], columnGroups = [], rows = [], selectedId, onSelect, showChanges = false, visibleChangeHeaders = false, groupedChangeLayout = false, heatmap = false }) {
  const hasColumnGroups = columnGroups.length > 0
  return (
    <div className={`team-matrix${heatmap ? ' team-matrix--heatmap' : ''}`}>
      <div className="team-matrix__scroll" role="region" aria-label={`${label}，可横向滚动`} tabIndex={0}>
        <table className={`team-matrix__table${showChanges ? ' team-matrix__table--changes' : ''}${groupedChangeLayout ? ' team-matrix__table--grouped' : ''}`} aria-label={label}>
          {showChanges && groupedChangeLayout && <colgroup><col className="team-matrix__team-column" />{columns.flatMap((column) => [<col className="team-matrix__value-column" key={`${column.id}-value`} />, <col className="team-matrix__change-column" key={`${column.id}-change`} />])}</colgroup>}
          <thead>{showChanges
            ? <>
              {hasColumnGroups
                ? <>
                  <tr><th scope="col" rowSpan={3}>团队</th>{columnGroups.map((group) => <th scope="colgroup" colSpan={group.count * 2} key={group.id}>{group.label}</th>)}</tr>
                  <tr>{columns.map((column) => <th scope="colgroup" colSpan={2} key={column.id}><span>{column.label}</span>{column.context && <small>{column.context}</small>}</th>)}</tr>
                </>
                : <tr><th scope="col" rowSpan={2}>团队</th>{columns.map((column) => <th scope="colgroup" colSpan={2} key={column.id}><span>{column.label}</span>{column.context && <small>{column.context}</small>}</th>)}</tr>}
              <tr>{columns.map((column) => <Fragment key={column.id}><th scope="col"><span className={visibleChangeHeaders ? undefined : 'app-sr-only'}>指标值</span></th><th scope="col" title="与当前选择范围的前期相比"><span className={visibleChangeHeaders ? undefined : 'app-sr-only'}>变化</span></th></Fragment>)}</tr>
            </>
            : hasColumnGroups
              ? <>
                <tr><th scope="col" rowSpan={2}>团队</th>{columnGroups.map((group) => <th scope="colgroup" colSpan={group.count} key={group.id}>{group.label}</th>)}</tr>
                <tr>{columns.map((column) => <th scope="col" key={column.id}><span>{column.label}</span>{column.context && <small>{column.context}</small>}</th>)}</tr>
              </>
              : <tr><th scope="col">团队</th>{columns.map((column) => <th scope="col" key={column.id}><span>{column.label}</span>{column.context && <small>{column.context}</small>}</th>)}</tr>}
          </thead>
          <tbody>{rows.map((row) => (
            <tr className={`${row.kind === 'average' ? 'team-matrix__row--average' : ''}${String(row.id) === String(selectedId) ? ' team-matrix__row--selected' : ''}`} key={row.id}>
              <th scope="row">
                {row.kind === 'team' && onSelect
                  ? <button type="button" aria-label={`选择团队：${row.label}`} aria-pressed={String(row.id) === String(selectedId)} onClick={() => onSelect(row.id)}><i style={{ '--team-matrix-color': row.color ?? 'var(--color-data-team-1)' }} aria-hidden="true" />{row.label}</button>
                  : row.label}
              </th>
              {columns.map((column, index) => {
                const value = row.values?.[index]
                if (!showChanges) {
                  const relation = ['above', 'below', 'equal'].includes(value?.benchmarkRelation) ? value.benchmarkRelation : null
                  const relationLabel = relation === 'above' ? '高于全公司均值' : relation === 'below' ? '低于全公司均值' : relation === 'equal' ? '等于全公司均值' : undefined
                  const difference = value?.benchmarkDelta ? `相对全公司均值 ${value.benchmarkDelta}` : undefined
                  const cellClass = [
                    relation ? `team-matrix__cell--benchmark-${relation} team-matrix__cell--benchmark` : '',
                    value?.unconfigured ? 'team-matrix__cell--unconfigured' : '',
                  ].filter(Boolean).join(' ')
                  return <td className={cellClass || undefined} data-heatmap-level={heatmap && Number.isInteger(value?.heatmapLevel) ? value.heatmapLevel : undefined} key={column.id} title={value?.reason ?? difference ?? relationLabel}>{value?.text !== null && value?.text !== undefined ? <><span>{value.text}</span>{value.benchmarkDelta && <small className="team-matrix__benchmark-delta">{value.benchmarkDelta}</small>}</> : '—'}</td>
                }
                const tone = value?.changeTone ? ` team-matrix__change--${value.changeTone}` : ''
                return <Fragment key={column.id}><td className="team-matrix__value">{value?.text ?? '—'}</td><td className={`team-matrix__change${tone}`}>{value?.changeText ?? '—'}</td></Fragment>
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}
