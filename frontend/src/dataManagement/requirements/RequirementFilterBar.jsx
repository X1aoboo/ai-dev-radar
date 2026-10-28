import React from 'react'
import { Button, Input, Select } from 'antd'
import {
  DownOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'

import { BOOL_FILTER_OPTIONS, enumFilterOptions } from './requirementProfiles'

function selectOptions(values) {
  return values.map((item) => (typeof item === 'string'
    ? { value: item, label: item }
    : { value: String(item.value), label: item.label }))
}

function chipValue(key, value) {
  if (value === 'true') return '是'
  if (value === 'false') return '否'
  return value
}

export default function RequirementFilterBar({
  profile,
  filters,
  onChange,
  onRemoveFilter,
  user,
  refs,
  advancedOpen,
  onToggleAdvanced,
  onReset,
  activeCount,
  viewPreset,
  onViewPreset,
  density,
  onDensity,
  onOpenColumns,
  loading,
}) {
  const availableVersions = refs.versions.filter((version) => {
    if (!filters.team_id) return true
    const product = refs.products.find((item) => item.id === version.product_id)
    return product?.team_id === Number(filters.team_id)
  })
  const selectedVersion = refs.versions.find((version) => String(version.id) === String(filters.version_id))
  const availableIterations = selectedVersion?.iterations ?? []
  const maintainerLocked = user.role === 'maintainer'

  const chips = []
  const team = refs.teams.find((item) => String(item.id) === String(filters.team_id))
  const version = refs.versions.find((item) => String(item.id) === String(filters.version_id))
  const iteration = availableIterations.find((item) => String(item.id) === String(filters.iteration_id))
  if (team) chips.push({ key: 'team_id', label: profile.filterLabels.team_id, value: team.name })
  if (version) chips.push({ key: 'version_id', label: profile.filterLabels.version_id, value: version.name })
  if (iteration) chips.push({ key: 'iteration_id', label: profile.filterLabels.iteration_id, value: iteration.name })
  if (filters.keyword) chips.push({ key: 'keyword', label: profile.filterLabels.keyword, value: filters.keyword })
  if (filters.requirement_type) chips.push({ key: 'requirement_type', label: profile.filterLabels.requirement_type, value: filters.requirement_type })
  if (filters.progress) chips.push({ key: 'progress', label: profile.filterLabels.progress, value: filters.progress })
  profile.advancedFilters.forEach((filter) => {
    const value = filters[filter.key]
    if (value !== '' && value !== null && value !== undefined) {
      chips.push({ key: filter.key, label: filter.label, value: chipValue(filter.key, value) })
    }
  })

  return (
    <div className="ir-filter-shell">
      <section className="ir-toolbar" aria-label={`${profile.tabLabel}筛选`}>
        <label className="ir-search">
          <SearchOutlined aria-hidden="true" />
          <Input
            variant="borderless"
            value={filters.keyword}
            placeholder={profile.searchPlaceholder}
            aria-label={profile.searchPlaceholder}
            onChange={(event) => onChange('keyword', event.target.value)}
          />
        </label>
        <Select
          className="ir-select"
          value={filters.team_id || undefined}
          allowClear
          disabled={maintainerLocked}
          placeholder="归属组：全部"
          aria-label="归属组"
          options={refs.teams.map((item) => ({ value: String(item.id), label: item.name }))}
          onChange={(value) => onChange('team_id', value ?? '')}
        />
        <Select
          className="ir-select"
          value={filters.version_id || undefined}
          allowClear
          placeholder="PI：全部"
          aria-label="PI"
          options={availableVersions.map((item) => ({ value: String(item.id), label: item.name }))}
          onChange={(value) => onChange('version_id', value ?? '')}
        />
        <Select
          className="ir-select ir-select--iteration"
          value={filters.iteration_id || undefined}
          allowClear
          placeholder="迭代：全部"
          aria-label="迭代"
          options={availableIterations.map((item) => ({ value: String(item.id), label: item.name }))}
          onChange={(value) => onChange('iteration_id', value ?? '')}
        />
        <Select
          className="ir-select"
          value={filters.requirement_type || undefined}
          allowClear
          placeholder="类型：全部"
          aria-label="类型"
          options={selectOptions(profile.typeOptions)}
          onChange={(value) => onChange('requirement_type', value ?? '')}
        />
        <Select
          className="ir-select"
          value={filters.progress || undefined}
          allowClear
          placeholder="进展：全部"
          aria-label="进展"
          options={selectOptions(profile.progressOptions)}
          onChange={(value) => onChange('progress', value ?? '')}
        />
        <div className="ir-toolbar__actions">
          <Button
            type="text"
            size="small"
            icon={<FilterOutlined />}
            aria-expanded={advancedOpen}
            aria-controls={advancedOpen ? 'ir-advanced-filters' : undefined}
            onClick={onToggleAdvanced}
          >
            高级筛选
            {activeCount > 0 && <span className="ir-filter-count" aria-label={`${activeCount} 项筛选`}>{activeCount}</span>}
          </Button>
          <Select
            className="ir-view-select"
            value={viewPreset}
            aria-label="视图"
            options={profile.viewPresets.map((item) => ({ value: item.value, label: `视图：${item.label}` }))}
            onChange={onViewPreset}
            suffixIcon={<DownOutlined />}
          />
          <Button type="text" size="small" icon={<SettingOutlined />} onClick={onOpenColumns}>列设置</Button>
          <Select
            className="ir-density-select"
            value={density}
            aria-label="密度"
            options={[{ value: 'compact', label: '紧凑' }, { value: 'standard', label: '标准' }]}
            onChange={onDensity}
          />
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={onReset} disabled={loading}>重置</Button>
        </div>
      </section>

      {advancedOpen && (
        <section id="ir-advanced-filters" className="ir-advanced" aria-label="高级筛选">
          {profile.advancedFilters.map((filter) => (
            <label key={filter.key} className="ir-filter-field">
              <span>{filter.label}</span>
              {filter.type === 'enum' && (
                <Select
                  aria-label={filter.label}
                  value={filters[filter.key] || undefined}
                  allowClear
                  placeholder="全部"
                  options={enumFilterOptions(filter.options ?? [])}
                  onChange={(value) => onChange(filter.key, value ?? '')}
                />
              )}
              {filter.type === 'bool' && (
                <Select
                  aria-label={filter.label}
                  value={filters[filter.key] || undefined}
                  allowClear
                  placeholder="全部"
                  options={BOOL_FILTER_OPTIONS}
                  onChange={(value) => onChange(filter.key, value ?? '')}
                />
              )}
              {filter.type === 'date' && (
                <Input aria-label={filter.label} type="date" value={filters[filter.key]} onChange={(event) => onChange(filter.key, event.target.value)} />
              )}
              {filter.type === 'text' && (
                <Input aria-label={filter.label} value={filters[filter.key]} placeholder="全部" onChange={(event) => onChange(filter.key, event.target.value)} />
              )}
            </label>
          ))}
        </section>
      )}

      {chips.length > 0 && (
        <div className="ir-chips" aria-label="已启用筛选">
          {chips.map((chip) => (
            <button key={chip.key} type="button" className="ir-chip" onClick={() => onRemoveFilter(chip.key)}>
              <b>{chip.label}</b> {chip.value} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="ir-chip ir-chip--clear" onClick={onReset}>清除全部</button>
        </div>
      )}
    </div>
  )
}
