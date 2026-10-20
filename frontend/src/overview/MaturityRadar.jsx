import React, { useRef } from 'react'
import { DATAVIZ_COLORS } from './overviewLogic'

const CAPABILITY_RADAR_LABEL_LINES = {
  'MR-E2E能力': ['MR-E2E', '能力'],
  'CodeCheck问题修复': ['CodeCheck', '问题修复'],
  '自动化构建部署': ['自动化', '构建部署'],
  '白盒安全问题修复': ['白盒安全', '问题修复'],
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function pointFor(index, value, count, width, height) {
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width * 0.45, height * 0.48)
  const angle = -Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2
  const distance = radius * (value / 5)
  return {
    x: centerX + Math.cos(angle) * distance,
    y: centerY + Math.sin(angle) * distance,
  }
}

function axisPoint(index, count, width, height, value = 5) {
  return pointFor(index, value, count, width, height)
}

function polygonPoints(value, count, width, height) {
  return Array.from({ length: count }, (_, index) => {
    const point = axisPoint(index, count, width, height, value)
    return `${point.x},${point.y}`
  }).join(' ')
}

function openSegments(values, count, width, height, closeComplete = false) {
  const segments = []
  let current = []
  values.slice(0, count).forEach((value, index) => {
    if (numeric(value)) {
      const point = pointFor(index, value, count, width, height)
      current.push(`${point.x},${point.y}`)
    } else if (current.length) {
      segments.push(current.join(' '))
      current = []
    }
  })
  if (current.length) {
    if (closeComplete && current.length === count) current.push(current[0])
    segments.push(current.join(' '))
  }
  return segments
}

export default function MaturityRadar({ activities = [], series = [], ariaLabel = '成熟度雷达', layout = 'standard' }) {
  const dataDialogRef = useRef(null)
  const width = layout === 'capability' ? 670 : 420
  const height = layout === 'overview' ? 420 : layout === 'capability' ? 460 : 320
  const radarClass = `maturity-radar${layout === 'overview' ? ' maturity-radar--overview' : ''}${layout === 'capability' ? ' maturity-radar--capability' : ''}`
  const count = activities.length
  if (!count) return <div className={`${radarClass} maturity-radar--empty`}>暂无可用成熟度轴。</div>
  if (!series.some((entry) => entry.values.some(numeric))) return <div className={`${radarClass} maturity-radar--empty`}>当前月暂无已评估成熟度；未评估值保持为空。</div>
  const dataTable = (
    <div className="maturity-table-wrap">
      <table className="maturity-table">
        <thead><tr><th scope="col">能力点</th>{series.map((entry) => <th scope="col" key={entry.id ?? entry.name}>{entry.name}</th>)}</tr></thead>
        <tbody>{activities.map((activity, index) => <tr key={activity.activity_id}><th scope="row">{activity.activity_name}</th>{series.map((entry) => <td key={entry.id ?? entry.name}>{numeric(entry.values[index]) ? entry.values[index].toFixed(2) : '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
  const renderedSeries = series.map((entry) => {
    const values = entry.values.slice(0, count)
    const complete = values.length === count && values.every(numeric)
    const closeComplete = (layout === 'overview' || layout === 'capability') && complete
    return { entry, values, complete, segments: openSegments(values, count, width, height, closeComplete) }
  })

  return (
    <div className={radarClass}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <g className="maturity-radar__rings" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((level) => (
            <polygon key={level} points={polygonPoints(level, count, width, height)} />
          ))}
        </g>
        {layout === 'overview' && <g className="maturity-radar__areas" aria-hidden="true">
          {renderedSeries.filter(({ entry, complete }) => complete && !entry.dashed).map(({ entry, segments }) => (
            <polygon key={entry.id ?? entry.name} className="maturity-radar__area" data-series-name={entry.name} points={segments[0]} fill={entry.color} fillOpacity="0.08" stroke="none" />
          ))}
        </g>}
        <g className="maturity-radar__axes" aria-hidden="true">
          {activities.map((activity, index) => {
            const center = axisPoint(index, count, width, height, 0)
            const end = axisPoint(index, count, width, height)
            const label = axisPoint(index, count, width, height, 4.8)
            const anchor = layout === 'capability'
              ? activity.activity_name === 'CodeCheck问题修复'
                ? 'end'
                : label.x < width * 0.4 ? 'end' : label.x > width * 0.6 ? 'start' : 'middle'
              : label.x < width * 0.35 ? 'start' : label.x > width * 0.65 ? 'end' : 'middle'
            const labelLines = layout === 'capability' ? CAPABILITY_RADAR_LABEL_LINES[activity.activity_name] ?? [activity.activity_name] : [activity.activity_name]
            return (
              <g key={activity.activity_id}>
                <line x1={center.x} y1={center.y} x2={end.x} y2={end.y} />
                <text x={label.x} y={label.y} textAnchor={anchor}>{labelLines.length === 1 ? labelLines[0] : labelLines.map((line, lineIndex) => <tspan key={line} x={label.x} dy={lineIndex === 0 ? '-.55em' : '1.1em'}>{line}</tspan>)}</text>
              </g>
            )
          })}
        </g>
        <g className="maturity-radar__levels" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((level) => <text key={level} x={width / 2 + 5} y={height / 2 + 8 - Math.min(width * 0.34, height * 0.36) * (level / 5) - 4}>{level}</text>)}
        </g>
        {renderedSeries.map(({ entry, values, complete, segments }) => {
          return <g key={entry.id ?? entry.name} className="maturity-radar__series" data-series-name={entry.name} data-series-complete={complete} data-series-prior={Boolean(entry.dashed)}>
            {segments.map((points, index) => (
              <polyline
                key={index}
                points={points}
                fill="none"
                stroke={entry.color}
                strokeWidth={layout === 'overview' ? (entry.dashed ? 2 : 2.8) : (entry.dashed ? 1.8 : 2.2)}
                strokeDasharray={entry.dashed ? '5 4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {values.map((value, index) => {
              if (!numeric(value)) return null
              const point = pointFor(index, value, count, width, height)
              if (layout === 'overview' && entry.dashed) {
                const radius = 5
                const diamond = `M ${point.x} ${point.y - radius} L ${point.x + radius} ${point.y} L ${point.x} ${point.y + radius} L ${point.x - radius} ${point.y} Z`
                return <path key={index} data-marker-kind="hollow-diamond" d={diamond} fill="none" stroke={entry.color} strokeWidth="1.6" strokeLinejoin="round" />
              }
              return <circle key={index} data-marker-kind="circle" cx={point.x} cy={point.y} r={layout === 'overview' ? 5.5 : (entry.dashed ? 3.5 : 4.5)} fill={entry.color} stroke={layout === 'overview' ? 'white' : 'none'} strokeWidth={layout === 'overview' ? 1.5 : 0} />
            })}
          </g>
        })}
      </svg>
      <div className="maturity-radar__legend" aria-label="雷达图图例">
        {series.map((entry) => (
          <span key={entry.id ?? entry.name} className={`maturity-radar__legend-item${entry.dashed ? ' maturity-radar__legend-item--prior' : ' maturity-radar__legend-item--current'}`} style={layout === 'overview' ? { '--maturity-series-color': entry.color } : undefined}>
            <i style={layout === 'overview' ? undefined : { backgroundColor: entry.color, borderStyle: entry.dashed ? 'dashed' : 'solid' }} />
            {entry.name}
          </span>
        ))}
      </div>
      {layout === 'overview' ? (
        <>
          <button className="maturity-radar__data-trigger" type="button" aria-haspopup="dialog" aria-controls="maturity-radar-data-dialog" onClick={() => dataDialogRef.current?.showModal()}>查看雷达数据表</button>
          <dialog ref={dataDialogRef} className="maturity-radar__dialog" aria-labelledby="maturity-radar-data-title">
            <header><h2 id="maturity-radar-data-title">雷达数据表</h2><button type="button" onClick={() => dataDialogRef.current?.close()}>关闭</button></header>
            {dataTable}
          </dialog>
        </>
      ) : (
        <details className="maturity-radar__data">
          <summary>查看雷达数据表</summary>
          {dataTable}
        </details>
      )}
      <p className="maturity-radar__note">未评估轴只显示已评估点，不补零、不形成完整多边形。</p>
    </div>
  )
}

export { DATAVIZ_COLORS }
