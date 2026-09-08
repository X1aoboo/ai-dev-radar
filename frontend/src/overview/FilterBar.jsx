import { iterationPeriods, latestPeriodId } from './overviewLogic'

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="overview-filter-control">
      <span className="overview-filter-label">{label}</span>
      <span className="overview-segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className={value === option.value ? 'is-active' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </span>
    </div>
  )
}

export default function FilterBar({ filter, onChange, versions, periods, loading, showMetricSlot = true }) {
  const isIteration = filter.dimension === 'iteration'
  const availablePeriods = isIteration ? iterationPeriods(versions, filter.versionId) : periods
  const validPeriodIds = new Set(availablePeriods.map((period) => String(period.id)))
  const periodValue = filter.periodId === null
    ? '__latest__'
    : filter.periodId && (
    filter.periodId === 'all' || validPeriodIds.has(String(filter.periodId))
  )
    ? String(filter.periodId)
    : 'all'

  function changeDimension(dimension) {
    const next = {
      ...filter,
      dimension,
      granularity: dimension === 'iteration' ? 'month' : filter.granularity,
      versionId: dimension === 'iteration' ? filter.versionId : 'all',
      periodId: null,
    }
    if (dimension === 'iteration') {
      next.periodId = latestPeriodId(iterationPeriods(versions, next.versionId))
    }
    onChange(next)
  }

  function changeGranularity(granularity) {
    onChange({ ...filter, granularity, periodId: null })
  }

  function changeVersion(versionId) {
    onChange({
      ...filter,
      versionId,
      periodId: latestPeriodId(iterationPeriods(versions, versionId)),
    })
  }

  return (
    <div className="overview-filterbar" aria-label="总览筛选">
      <SegmentedControl
        label="统计维度"
        options={[
          { value: 'time', label: '按时间' },
          { value: 'iteration', label: '按版本/迭代' },
        ]}
        value={filter.dimension}
        onChange={changeDimension}
      />

      {isIteration ? (
        <label className="overview-filter-control">
          <span className="overview-filter-label">版本</span>
          <select
            className="overview-select"
            aria-label="版本"
            value={filter.versionId}
            onChange={(event) => changeVersion(event.target.value)}
          >
            <option value="all">全部版本</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>{version.name}</option>
            ))}
          </select>
        </label>
      ) : (
        <SegmentedControl
          label="时间粒度"
          options={[
            { value: 'month', label: '月' },
            { value: 'week', label: '周' },
          ]}
          value={filter.granularity}
          onChange={changeGranularity}
        />
      )}

      <label className="overview-filter-control">
        <span className="overview-filter-label">周期</span>
        <select
          className="overview-select overview-period-select"
          aria-label="周期"
          value={periodValue}
          onChange={(event) => onChange({ ...filter, periodId: event.target.value })}
          disabled={filter.periodId === null || (loading && availablePeriods.length === 0)}
        >
          {filter.periodId === null && <option value="__latest__" disabled>正在选择最新周期…</option>}
          <option value="all">全部周期</option>
          {availablePeriods.map((period) => (
            <option key={period.id} value={period.id}>{period.label}</option>
          ))}
        </select>
      </label>

      {showMetricSlot && (
        <SegmentedControl
          label="展示指标"
          options={[
            { value: 0, label: '第一指标' },
            { value: 1, label: '第二指标' },
          ]}
          value={filter.metricSlot}
          onChange={(metricSlot) => onChange({ ...filter, metricSlot })}
        />
      )}
    </div>
  )
}
