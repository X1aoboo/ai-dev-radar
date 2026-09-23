import { iterationPeriods, latestPeriodId } from './overviewLogic'
import FilterToolbar from '../components/FilterToolbar'

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="analytics-granularity" role="group" aria-label={label}>
      <span>{label}</span>
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
    </div>
  )
}

export default function FilterBar({ filter, onChange, versions, periods, loading, month, onMonthChange, metricOptions }) {
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
    onChange(next, { history: 'push' })
  }

  function changeGranularity(granularity) {
    onChange({ ...filter, granularity, periodId: null }, { history: 'push' })
  }

  function changeVersion(versionId) {
    onChange({
      ...filter,
      versionId,
      periodId: latestPeriodId(iterationPeriods(versions, versionId)),
    }, { history: 'push' })
  }

  return (
    <FilterToolbar className="analytics-filter-toolbar" label="分析筛选">
      <div className="analytics-page-controls">
      {month && onMonthChange && <label><span>成熟度月份</span><input aria-label="成熟度月份" type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>}
      {metricOptions && <label><span>指标</span><select aria-label="指标" value={filter.metricId ?? 'all'} onChange={(event) => onChange({ ...filter, metricId: event.target.value, periodId: null }, { history: 'push' })}><option value="all">全部指标</option>{metricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
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
        <label>
          <span>版本</span>
          <select
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
          { value: 'day', label: '日' },
          ]}
          value={filter.granularity}
          onChange={changeGranularity}
        />
      )}

      <label>
        <span>周期</span>
        <select
          aria-label="周期"
          value={periodValue}
          onChange={(event) => onChange({ ...filter, periodId: event.target.value }, { history: 'push' })}
          disabled={filter.periodId === null || (loading && availablePeriods.length === 0)}
        >
          {filter.periodId === null && <option value="__latest__" disabled>正在选择最新周期…</option>}
          <option value="all">全部周期</option>
          {availablePeriods.map((period) => (
            <option key={period.id} value={period.id}>{period.label}</option>
          ))}
        </select>
      </label>
      </div>

    </FilterToolbar>
  )
}
