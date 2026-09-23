export default function MetricCard({ label, value, detail, trend, className = '' }) {
  return (
    <article className={`metric-card ${className}`.trim()}>
      <div className="metric-card__label">{label}</div>
      <div className="metric-card__value">{value}</div>
      {(detail || trend) && <div className="metric-card__footer">{detail && <div className="metric-card__detail">{detail}</div>}{trend && <div className="metric-card__trend">{trend}</div>}</div>}
    </article>
  )
}
