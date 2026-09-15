import { DATAVIZ_COLORS } from './overviewLogic'

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function pointFor(index, value, count, width, height) {
  const centerX = width / 2
  const centerY = height / 2 + 8
  const radius = Math.min(width * 0.34, height * 0.38)
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

function openSegments(values, count, width, height) {
  const segments = []
  let current = []
  values.forEach((value, index) => {
    if (numeric(value)) {
      const point = pointFor(index, value, count, width, height)
      current.push(`${point.x},${point.y}`)
    } else if (current.length) {
      segments.push(current.join(' '))
      current = []
    }
  })
  if (current.length) segments.push(current.join(' '))
  return segments
}

export default function MaturityRadar({ activities = [], series = [], ariaLabel = '成熟度雷达' }) {
  const width = 520
  const height = 320
  const count = activities.length
  if (!count) return <div className="maturity-radar maturity-radar--empty">暂无可用成熟度轴。</div>

  return (
    <div className="maturity-radar">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <g className="maturity-radar__rings" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((level) => (
            <polygon key={level} points={polygonPoints(level, count, width, height)} />
          ))}
        </g>
        <g className="maturity-radar__axes" aria-hidden="true">
          {activities.map((activity, index) => {
            const center = axisPoint(index, count, width, height, 0)
            const end = axisPoint(index, count, width, height)
            const label = axisPoint(index, count, width, height, 5.65)
            const anchor = label.x < width * 0.35 ? 'start' : label.x > width * 0.65 ? 'end' : 'middle'
            return (
              <g key={activity.activity_id}>
                <line x1={center.x} y1={center.y} x2={end.x} y2={end.y} />
                <text x={label.x} y={label.y} textAnchor={anchor}>{activity.activity_name}</text>
              </g>
            )
          })}
        </g>
        <g className="maturity-radar__levels" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((level) => <text key={level} x={width / 2 + 5} y={height / 2 + 8 - Math.min(width * 0.34, height * 0.38) * (level / 5) - 4}>{level}</text>)}
        </g>
        {series.map((entry) => (
          <g key={entry.id ?? entry.name} className="maturity-radar__series">
            {openSegments(entry.values, count, width, height).map((points, index) => (
              <polyline
                key={index}
                points={points}
                fill="none"
                stroke={entry.color}
                strokeWidth={entry.dashed ? 1.8 : 2.2}
                strokeDasharray={entry.dashed ? '5 4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {entry.values.map((value, index) => {
              if (!numeric(value)) return null
              const point = pointFor(index, value, count, width, height)
              return <circle key={index} cx={point.x} cy={point.y} r={entry.dashed ? 3.5 : 4.5} fill={entry.color} />
            })}
          </g>
        ))}
      </svg>
      <div className="maturity-radar__legend" aria-label="雷达图图例">
        {series.map((entry) => (
          <span key={entry.id ?? entry.name}>
            <i style={{ backgroundColor: entry.color, borderStyle: entry.dashed ? 'dashed' : 'solid' }} />
            {entry.name}
          </span>
        ))}
      </div>
      <p className="maturity-radar__note">未评估轴只显示已评估点，不补零、不形成完整多边形。</p>
    </div>
  )
}

export { DATAVIZ_COLORS }
