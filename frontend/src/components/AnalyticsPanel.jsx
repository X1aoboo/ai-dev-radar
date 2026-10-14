export default function AnalyticsPanel({ id, title, titleExtra, description, action, children, className = '' }) {
  return (
    <section id={id} className={`analytics-panel ${className}`.trim()}>
      {(title || titleExtra || action) && <header className="analytics-panel__header"><div>{titleExtra
        ? <div className="analytics-panel__heading-row">{title && <h2 className="analytics-panel__title">{title}</h2>}{titleExtra}</div>
        : title && <h2 className="analytics-panel__title">{title}</h2>}{description && <p className="analytics-panel__description">{description}</p>}</div>{action}</header>}
      {children}
    </section>
  )
}
