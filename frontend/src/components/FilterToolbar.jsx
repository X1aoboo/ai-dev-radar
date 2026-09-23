export default function FilterToolbar({ label = '筛选条件', children, actions, className = '' }) {
  return (
    <section className={`filter-toolbar ${className}`.trim()} aria-label={label || '筛选条件'}>
      {label && <span className="filter-toolbar__label">{label}</span>}
      <div className="filter-toolbar__filters">{children}</div>
      {actions && <div className="filter-toolbar__actions">{actions}</div>}
    </section>
  )
}
