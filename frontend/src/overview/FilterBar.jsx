import { INITIAL_FILTER, iterationPeriods, latestPeriodId } from './overviewLogic'
import { CalendarOutlined, ClockCircleOutlined, DownOutlined, TagOutlined } from '@ant-design/icons'
import FilterToolbar from '../components/FilterToolbar'

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div className="analytics-granularity" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="analytics-granularity__options">
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
    </div>
  )
}

export default function FilterBar({ filter, onChange, versions, periods, loading, month, onMonthChange, metricOptions, showCycle = false, showPrimaryControls = true, showAdvancedControls = true, allowIteration = true }) {
  const isIteration = allowIteration && filter.dimension === 'iteration'
  const availablePeriods = isIteration ? iterationPeriods(versions, filter.versionId) : periods
  const validPeriodIds = new Set(availablePeriods.map((period) => String(period.id)))
  const periodValue = filter.periodId === null
    ? '__latest__'
    : filter.periodId && (
    filter.periodId === 'all' || validPeriodIds.has(String(filter.periodId))
  )
    ? String(filter.periodId)
    : 'all'
  const advancedFiltersActive = isIteration
    || filter.granularity !== 'month'
    || (filter.metricId ?? 'all') !== 'all'
    || periodValue === 'all'
    || (periodValue !== '__latest__' && periodValue !== String(latestPeriodId(availablePeriods)))

  function changeDimension(dimension) {
    const next = {
      ...filter,
      dimension,
      granularity: dimension === 'iteration' ? 'month' : filter.granularity,
      versionId: filter.versionId,
      periodId: null,
    }
    if (dimension === 'iteration') {
      next.periodId = latestPeriodId(iterationPeriods(versions, next.versionId))
    }
    onChange(next, { history: 'push' })
  }

  function changeGranularity(granularity) {
    onChange({ ...filter, ...(allowIteration ? {} : { dimension: 'time', versionId: 'all' }), granularity, periodId: null }, { history: 'push' })
  }

  function changeVersion(versionId) {
    onChange({
      ...filter,
      versionId,
      periodId: isIteration ? latestPeriodId(iterationPeriods(versions, versionId)) : filter.periodId,
    }, { history: 'push' })
  }

  function resetFilters() {
    onChange({ ...INITIAL_FILTER, periodId: periods?.length ? latestPeriodId(periods) : null }, { history: 'push' })
  }

  return (
    <FilterToolbar className="analytics-filter-toolbar activity-filter-toolbar" label={showPrimaryControls ? '分析筛选' : ''} actions={showAdvancedControls ? <button type="button" className="analytics-filter-reset" onClick={resetFilters}>重置统计条件</button> : undefined}>
      <div className="activity-filter-groups">
        {showPrimaryControls && <div className="analytics-page-controls activity-filter-groups__primary">
          {month && onMonthChange && <label className="analytics-filter-card">
            <span className="analytics-filter-card__label"><CalendarOutlined aria-hidden="true" />月份</span>
            <span className="analytics-filter-card__value"><input aria-label="月份" type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /><DownOutlined aria-hidden="true" /></span>
          </label>}
          {showCycle && <label className="analytics-filter-card">
            <span className="analytics-filter-card__label"><ClockCircleOutlined aria-hidden="true" />统计周期</span>
            <span className="analytics-filter-card__value"><select aria-label="统计周期" value={filter.cycle ?? '6m'} onChange={(event) => onChange({ ...filter, cycle: event.target.value }, { history: 'push' })}>
              <option value="6m">近6个月</option><option value="half">本半年度</option><option value="year">年度累计</option>
            </select><DownOutlined aria-hidden="true" /></span>
          </label>}
          <label className="analytics-filter-card">
            <span className="analytics-filter-card__label"><TagOutlined aria-hidden="true" />版本</span>
            <span className="analytics-filter-card__value"><select aria-label="版本" value={filter.versionId} onChange={(event) => changeVersion(event.target.value)}>
              <option value="all">全部版本</option>
              {versions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}
            </select><DownOutlined aria-hidden="true" /></span>
          </label>
        </div>}
        {showAdvancedControls && <details className="activity-filter-groups__advanced" open={advancedFiltersActive || undefined}>
          <summary>原始指标筛选</summary>
          <div className="analytics-page-controls">
            {allowIteration && <SegmentedControl
              label="统计维度"
              options={[{ value: 'time', label: '按时间' }, { value: 'iteration', label: '按版本/迭代' }]}
              value={filter.dimension}
              onChange={changeDimension}
            />}
            {!isIteration && <SegmentedControl
              label="时间粒度"
              options={[{ value: 'month', label: '月' }, { value: 'week', label: '周' }, { value: 'day', label: '日' }]}
              value={filter.granularity}
              onChange={changeGranularity}
            />}
            {metricOptions && <label><span>指标</span><select aria-label="指标" value={filter.metricId ?? 'all'} onChange={(event) => onChange({ ...filter, metricId: event.target.value, periodId: null }, { history: 'push' })}><option value="all">全部指标</option>{metricOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
            <label>
              <span>事实周期</span>
              <select aria-label="周期" value={periodValue} onChange={(event) => onChange({ ...filter, periodId: event.target.value }, { history: 'push' })} disabled={filter.periodId === null || (loading && availablePeriods.length === 0)}>
                {filter.periodId === null && <option value="__latest__" disabled>正在选择最新周期…</option>}
                <option value="all">全部周期</option>
                {availablePeriods.map((period) => <option key={period.id} value={period.id}>{period.label}</option>)}
              </select>
            </label>
          </div>
        </details>}
      </div>
    </FilterToolbar>
  )
}
