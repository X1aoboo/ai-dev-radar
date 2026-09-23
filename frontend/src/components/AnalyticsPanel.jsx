export default function AnalyticsPanel({ title, description, action, children, className = '' }) {
  return (
    <section className={`analytics-panel ${className}`.trim()}>
      {(title || action) && <header className="analytics-panel__header"><div>{title && <h2 className="analytics-panel__title">{title}</h2>}{description && <p className="analytics-panel__description">{description}</p>}</div>{action}</header>}
      {children}
    </section>
  )
}
