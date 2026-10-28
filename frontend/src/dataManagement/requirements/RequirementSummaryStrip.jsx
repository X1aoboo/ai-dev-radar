import React from 'react'

import { formatRequirementNumber } from './requirementProfiles'

const SEGMENT_COLORS = {
  todo: '#d0d5dd',
  doing: '#84adff',
  done: '#12b76a',
  closed: '#98a2b3',
  pending: '#e4e7ec',
}

export default function RequirementSummaryStrip({ profile, summary, loading }) {
  const cells = profile.summaryCells(summary ?? {})
  return (
    <section className={`ir-summary${loading ? ' is-loading' : ''}`} aria-label={`${profile.tabLabel}需求概览`}>
      {cells.map((cell) => {
        const hasSecondary = cell.secondaryValue !== undefined
        return (
          <div key={cell.key} className={`ir-summary__cell${cell.tone ? ` ir-summary__cell--${cell.tone}` : ''}`}>
            <div className="ir-summary__label">{cell.label}</div>
            <div className="ir-summary__value">
              <strong>{typeof cell.value === 'number' ? formatRequirementNumber(cell.value) : cell.value}</strong>
              {hasSecondary
                ? <span>/ {formatRequirementNumber(cell.secondaryValue)} 人天</span>
                : cell.unit ? <span>{cell.unit}</span> : null}
            </div>
            <div className="ir-summary__note">{cell.note}</div>
            {cell.breakdown && <div className="ir-summary__breakdown">{cell.breakdown}</div>}
            {cell.segments && (
              <div className="ir-summary__progress" aria-hidden="true">
                {cell.segments.length && cell.total
                  ? cell.segments.map((segment) => (
                    <span
                      key={segment.label}
                      style={{
                        background: SEGMENT_COLORS[segment.tone] ?? SEGMENT_COLORS.pending,
                        width: `${(segment.value / cell.total) * 100}%`,
                      }}
                    />
                  ))
                  : <span style={{ background: 'var(--color-border-default)', width: '100%' }} />}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
