import { useId } from 'react'

import { sparklineSegments } from './AnalyticsComponents'

export function MetricKpiCard({ label, value, unit, detail, comparison, context, delta, deltaTone = 'neutral', trend, trendValues, trendLabel, accent = 'var(--color-brand-primary)', loading = false, error, className = '' }) {
  const id = useId().replaceAll(':', '')
  const segments = sparklineSegments(trendValues)
  return (
    <article className={`metric-card${loading ? ' metric-card--loading' : ''} ${className}`.trim()} style={{ '--metric-card-accent': accent }} aria-busy={loading || undefined}>
      <div className="metric-card__heading">
        <div className="metric-card__label">{label}</div>
        {delta && <span className={`metric-card__delta metric-card__delta--${deltaTone}`}>{delta}</span>}
      </div>
      <div className="metric-card__value">{loading ? '…' : value ?? '—'}{unit && <span className="metric-card__unit">{unit}</span>}</div>
      {comparison && <p className="metric-card__comparison">{comparison}</p>}
      {detail && <p className="metric-card__detail">{detail}</p>}
      {context && <p className="metric-card__context">{context}</p>}
      {error && <p className="metric-card__error" role="alert">{error}</p>}
      {(trend || segments.length > 0) && <div className="metric-card__footer">
        {trend}
        {!trend && segments.length > 0 && <svg className="metric-card__sparkline" viewBox="0 0 128 34" role="img" aria-label={trendLabel ?? `${label}趋势`} preserveAspectRatio="none">
          <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".24" /><stop offset="100%" stopColor="currentColor" stopOpacity=".02" /></linearGradient></defs>
          {segments.map((segment, index) => <g key={index}><path className="metric-card__sparkline-area" d={segment.area} fill={`url(#${id}-fill)`} /><path className="metric-card__sparkline-line" d={segment.line} /></g>)}
        </svg>}
      </div>}
    </article>
  )
}

export default MetricKpiCard
