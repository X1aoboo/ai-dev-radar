import React from 'react'
import { IR_PROGRESS_OPTIONS } from './irFields'

const SEGMENT_COLORS = {
  未开始: '#d0d5dd',
  进行中: '#84adff',
  完成: '#12b76a',
  已关闭: '#98a2b3',
  待维护: '#e4e7ec',
}

function formatNumber(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
}

export default function IRSummaryStrip({ summary, loading }) {
  const byProgress = summary?.by_progress ?? {}
  const total = summary?.total ?? 0
  const segments = IR_PROGRESS_OPTIONS
    .map((option) => ({ label: option.label, value: byProgress[option.label] ?? 0, color: SEGMENT_COLORS[option.label] }))
    .filter((segment) => segment.value > 0)
  const pending = byProgress['待维护'] ?? 0
  if (pending > 0) segments.push({ label: '待维护', value: pending, color: SEGMENT_COLORS['待维护'] })
  const usage = summary?.ai_usage_rate

  return (
    <section className={`ir-summary${loading ? ' is-loading' : ''}`} aria-label="IR 需求概览">
      <div className="ir-summary__cell ir-summary__cell--accent">
        <div className="ir-summary__label">需求总数</div>
        <div className="ir-summary__value"><strong>{formatNumber(total)}</strong><span>条</span></div>
        <div className="ir-summary__note">当前筛选范围</div>
      </div>
      <div className="ir-summary__cell">
        <div className="ir-summary__label">进行中</div>
        <div className="ir-summary__value"><strong>{formatNumber(byProgress['进行中'] ?? 0)}</strong><span>条</span></div>
        <div className="ir-summary__note">{total ? `${(((byProgress['进行中'] ?? 0) / total) * 100).toFixed(1)}%` : '—'}</div>
      </div>
      <div className="ir-summary__cell ir-summary__cell--success">
        <div className="ir-summary__label">已完成</div>
        <div className="ir-summary__value"><strong>{formatNumber(byProgress['完成'] ?? 0)}</strong><span>条</span></div>
        <div className="ir-summary__note">{total ? `${(((byProgress['完成'] ?? 0) / total) * 100).toFixed(1)}%` : '—'}</div>
      </div>
      <div className="ir-summary__cell">
        <div className="ir-summary__label">AI 使用率</div>
        <div className="ir-summary__value"><strong>{usage === null || usage === undefined ? '—' : Math.round(usage * 100)}</strong><span>%</span></div>
        <div className="ir-summary__note">SA 或 SE 使用 AI</div>
      </div>
      <div className="ir-summary__cell">
        <div className="ir-summary__label">SA / SE 工作量</div>
        <div className="ir-summary__value">
          <strong>{formatNumber(summary?.total_estimated_workload)}</strong>
          <span>/ {formatNumber(summary?.total_actual_workload)} 人天</span>
        </div>
        <div className="ir-summary__note">预估合计 / 实际合计</div>
        <div className="ir-summary__progress" aria-hidden="true">
          {segments.length
            ? segments.map((segment) => (
              <span key={segment.label} style={{ background: segment.color, width: `${(segment.value / total) * 100}%` }} />
            ))
            : <span style={{ background: 'var(--color-border-default)', width: '100%' }} />}
        </div>
      </div>
    </section>
  )
}
