import React from 'react'
import { Button, Input, Select } from 'antd'
import {
  DownOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'

import { IR_PROGRESS_OPTIONS, IR_QUALITY_OPTIONS, IR_VIEW_PRESETS } from './irFields'

function optionList(values, labelForKey = 'label', valueForKey = 'value') {
  return values.map((item) => ({ value: String(item[valueForKey]), label: item[labelForKey] }))
}

export default function IRFilterBar({
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
  if (team) chips.push({ key: 'team_id', label: '归属组', value: team.name })
  if (version) chips.push({ key: 'version_id', label: 'PI', value: version.name })
  if (iteration) chips.push({ key: 'iteration_id', label: '迭代', value: iteration.name })
  if (filters.keyword) chips.push({ key: 'keyword', label: '搜索', value: filters.keyword })
  if (filters.progress) chips.push({ key: 'progress', label: '进展', value: filters.progress })
  if (filters.ai_quality_level) chips.push({ key: 'ai_quality_level', label: 'AI质检', value: filters.ai_quality_level })
  if (filters.ai_applicability) chips.push({ key: 'ai_applicability', label: 'AI适用性', value: filters.ai_applicability === 'true' ? '是' : '否' })
  if (filters.sa_ai_assisted) chips.push({ key: 'sa_ai_assisted', label: 'SA使用AI', value: filters.sa_ai_assisted === 'true' ? '是' : '否' })
  if (filters.se_ai_assisted) chips.push({ key: 'se_ai_assisted', label: 'SE使用AI', value: filters.se_ai_assisted === 'true' ? '是' : '否' })
  if (filters.ai_dev_mode) chips.push({ key: 'ai_dev_mode', label: 'AI研发模式', value: filters.ai_dev_mode })
  if (filters.business_module) chips.push({ key: 'business_module', label: '所属功能', value: filters.business_module })
  if (filters.completed_from) chips.push({ key: 'completed_from', label: '设计时间起', value: filters.completed_from })
  if (filters.completed_to) chips.push({ key: 'completed_to', label: '设计时间止', value: filters.completed_to })

  return (
    <div className="ir-filter-shell">
      <section className="ir-toolbar" aria-label="IR 筛选">
        <label className="ir-search">
          <SearchOutlined aria-hidden="true" />
          <Input
            variant="borderless"
            value={filters.keyword}
            placeholder="搜索需求编号、标题或所属功能"
            aria-label="搜索需求编号、标题或所属功能"
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
          value={filters.progress || undefined}
          allowClear
          placeholder="进展：全部"
          aria-label="进展"
          options={optionList(IR_PROGRESS_OPTIONS)}
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
            options={IR_VIEW_PRESETS.map((item) => ({ value: item.value, label: `视图：${item.label}` }))}
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
          <label className="ir-filter-field">
            <span>AI质检等级</span>
            <Select
              value={filters.ai_quality_level || undefined}
              allowClear
              placeholder="全部"
              options={optionList(IR_QUALITY_OPTIONS)}
              onChange={(value) => onChange('ai_quality_level', value ?? '')}
            />
          </label>
          <label className="ir-filter-field">
            <span>AI适用性</span>
            <Select
              value={filters.ai_applicability || undefined}
              allowClear
              placeholder="全部"
              options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]}
              onChange={(value) => onChange('ai_applicability', value ?? '')}
            />
          </label>
          <label className="ir-filter-field">
            <span>SA是否使用AI</span>
            <Select
              value={filters.sa_ai_assisted || undefined}
              allowClear
              placeholder="全部"
              options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]}
              onChange={(value) => onChange('sa_ai_assisted', value ?? '')}
            />
          </label>
          <label className="ir-filter-field">
            <span>SE是否使用AI</span>
            <Select
              value={filters.se_ai_assisted || undefined}
              allowClear
              placeholder="全部"
              options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]}
              onChange={(value) => onChange('se_ai_assisted', value ?? '')}
            />
          </label>
          <label className="ir-filter-field">
            <span>AI研发模式</span>
            <Input aria-label="AI研发模式" value={filters.ai_dev_mode} placeholder="全部" onChange={(event) => onChange('ai_dev_mode', event.target.value)} />
          </label>
          <label className="ir-filter-field">
            <span>所属功能</span>
            <Input aria-label="所属功能" value={filters.business_module} placeholder="全部" onChange={(event) => onChange('business_module', event.target.value)} />
          </label>
          <label className="ir-filter-field">
            <span>设计时间起</span>
            <Input aria-label="设计时间起" type="date" value={filters.completed_from} onChange={(event) => onChange('completed_from', event.target.value)} />
          </label>
          <label className="ir-filter-field">
            <span>设计时间止</span>
            <Input aria-label="设计时间止" type="date" value={filters.completed_to} onChange={(event) => onChange('completed_to', event.target.value)} />
          </label>
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
