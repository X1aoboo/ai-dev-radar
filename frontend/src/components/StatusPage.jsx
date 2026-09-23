import { useId } from 'react'
import { Spin } from 'antd'

const STATUS_LABELS = {
  forbidden: '403',
  'not-found': '404',
  pending: '待定义',
  error: '暂时不可用',
}

export function ContentLoadingState({ label = '加载中…', className = '' }) {
  return (
    <div className={`content-loading ${className}`.trim()} role="status" aria-live="polite">
      <Spin size="small" />
      <span>{label}</span>
    </div>
  )
}

export default function StatusPage({ status = 'error', title, description, actions, layout = 'page' }) {
  const titleId = useId()
  const descriptionId = useId()
  const alert = status === 'error'

  return (
    <section
      className={`global-status global-status--${status} global-status--${layout}`}
      role={alert ? 'alert' : 'status'}
      aria-live={alert ? 'assertive' : 'polite'}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <span className="global-status__label" aria-hidden="true">{STATUS_LABELS[status] ?? status}</span>
      <h1 id={titleId} className="global-status__title">{title}</h1>
      {description && <p id={descriptionId} className="global-status__description">{description}</p>}
      {actions && <div className="global-status__actions">{actions}</div>}
    </section>
  )
}
