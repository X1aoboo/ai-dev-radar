import React, { useMemo, useState } from 'react'
import { Button, Empty, Input, InputNumber, Pagination, Select, Spin, Tag } from 'antd'
import { EditOutlined } from '@ant-design/icons'

import { formatRequirementNumber, progressTone } from './requirementProfiles'

function initials(name) {
  const text = String(name ?? '').trim()
  return text ? text.slice(0, 1).toUpperCase() : '·'
}

function StatusValue({ value }) {
  const tone = progressTone(value)
  return (
    <span className={`ir-status ir-status--${tone}`}>
      <i aria-hidden="true" />
      {value || '待维护'}
    </span>
  )
}

function BoolValue({ value }) {
  const tone = value === true ? 'yes' : value === false ? 'no' : 'empty'
  return <span className={`ir-bool ir-bool--${tone}`}>{value === true ? '是' : value === false ? '否' : '—'}</span>
}

function TagValue({ value, field }) {
  if (!value) return <span className="ir-cell-empty">—</span>
  const tone = (field.options ?? []).find((option) => option?.value === value)?.tone ?? 'neutral'
  return <Tag className={`ir-tag ir-tag--${tone}`}>{value}</Tag>
}

function OwnerValue({ value }) {
  const name = value?.text ? value.text.split(/\s+/)[0] : ''
  return (
    <span className="ir-person" title={value?.text || '待维护'}>
      <span className="ir-person__avatar">{initials(name)}</span>
      <span className="ir-person__text">{value?.text || '—'}</span>
      {value?.pending && <span className="ir-person__pending">待匹配</span>}
    </span>
  )
}

function CellEditor({ field, value, onCommit, onCancel }) {
  const [draft, setDraft] = useState(value ?? '')
  const [open, setOpen] = useState(true)
  const commit = (next = draft) => onCommit(next)
  const keyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
  }

  if (field.type === 'enum') {
    const options = (field.options || []).map((option) => (
      typeof option === 'string' ? { value: option, label: option } : { value: option.value, label: option.label }
    ))
    return (
      <Select
        autoFocus
        size="small"
        open={open}
        onOpenChange={setOpen}
        value={draft || undefined}
        allowClear
        options={options}
        onChange={(next) => { setOpen(false); commit(next ?? '') }}
        onKeyDown={keyDown}
      />
    )
  }
  if (field.type === 'bool') {
    return (
      <Select
        autoFocus
        size="small"
        open={open}
        onOpenChange={setOpen}
        value={draft === true ? 'true' : draft === false ? 'false' : undefined}
        allowClear
        options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]}
        onChange={(next) => { setOpen(false); commit(next === undefined ? null : next === 'true') }}
        onKeyDown={keyDown}
      />
    )
  }
  if (field.type === 'number') {
    return (
      <InputNumber
        autoFocus
        size="small"
        min={0}
        step="any"
        controls={false}
        value={draft === '' || draft === null || draft === undefined ? null : draft}
        onChange={(next) => setDraft(next)}
        onBlur={() => commit()}
        onKeyDown={keyDown}
      />
    )
  }
  return (
    <Input
      autoFocus
      size="small"
      type={field.type === 'date' ? 'date' : 'text'}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={keyDown}
    />
  )
}

function renderDisplay(field, value, ownerValue) {
  if (field.render === 'id') return <span className="ir-cell-id">{value || '—'}</span>
  if (field.render === 'title') return <span className="ir-cell-title" title={value || ''}>{value || '—'}</span>
  if (field.render === 'status') return <StatusValue value={value} />
  if (field.render === 'bool') return <BoolValue value={value} />
  if (field.render === 'tag') return <TagValue value={value} field={field} />
  if (field.render === 'type') return <TagValue value={value} field={field} />
  if (field.render === 'owner') return <OwnerValue value={ownerValue} />
  if (field.render === 'number') return <span className="ir-number">{formatRequirementNumber(value)}</span>
  if (field.render === 'date') return <span className="ir-date">{value || '—'}</span>
  if (field.render === 'muted') return <span className="ir-cell-muted" title={value || ''}>{value || '—'}</span>
  return <span className="ir-cell-text" title={value || ''}>{value || '—'}</span>
}

export default function RequirementDataGrid({
  profile,
  items,
  loading,
  total,
  filters,
  setFilters,
  canEdit,
  draft,
  setDraft,
  onSave,
  onDiscard,
  saving,
  visibleKeys,
  density,
  onOpenDetail,
}) {
  const [editing, setEditing] = useState(null)
  const dirtyCount = Object.values(draft).reduce((count, row) => count + Object.keys(row).length, 0)
  const visible = useMemo(() => new Set(visibleKeys), [visibleKeys])

  const commitCell = (record, field, value) => {
    const original = record[field.key]
    const nextRows = { ...draft }
    const rowChanges = { ...(nextRows[record.id] || {}) }
    const normalized = field.type === 'number'
      ? (value === '' || value === null || value === undefined ? null : Number(value))
      : (field.type === 'bool'
        ? (value === '' || value === null || value === undefined ? null : Boolean(value))
        : (value === null || value === undefined ? '' : String(value).trim()))
    if (field.required && (normalized === '' || normalized === null || normalized === undefined)) {
      setEditing(null)
      return
    }
    const same = normalized === original || (normalized === '' && (original === null || original === undefined))
    if (same) delete rowChanges[field.key]
    else rowChanges[field.key] = normalized
    if (Object.keys(rowChanges).length) nextRows[record.id] = rowChanges
    else delete nextRows[record.id]
    setDraft(nextRows)
    setEditing(null)
  }

  const cellContent = (field, record) => {
    const rowDraft = draft[record.id] || {}
    const dirty = Object.prototype.hasOwnProperty.call(rowDraft, field.key)
    const value = dirty ? rowDraft[field.key] : record[field.key]
    const ownerValue = field.type === 'owner' ? profile.ownerValue(record, field.key) : null
    const editable = canEdit && field.editable
    if (editing?.rowId === record.id && editing?.key === field.key) {
      return (
        <CellEditor
          field={field}
          value={value}
          onCommit={(next) => commitCell(record, field, next)}
          onCancel={() => setEditing(null)}
        />
      )
    }
    if (!editable) return renderDisplay(field, value, ownerValue)
    return (
      <div
        className={`ir-cell${dirty ? ' ir-cell--dirty' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={`编辑${field.label}，当前值${value ?? '空'}`}
        onClick={(event) => {
          event.stopPropagation()
          setEditing({ rowId: record.id, key: field.key })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setEditing({ rowId: record.id, key: field.key })
          }
        }}
      >
        {renderDisplay(field, value, ownerValue)}
      </div>
    )
  }

  const columns = useMemo(() => {
    const fieldColumn = (field) => ({
      title: field.label,
      dataIndex: field.key,
      key: field.key,
      width: field.width,
      align: field.type === 'number' ? 'right' : undefined,
      fixed: field.key === 'requirement_no' || field.key === 'requirement_name' ? 'left' : undefined,
      sorter: profile.sortableKeys.has(field.key),
      sortOrder: filters.sort_by === field.key
        ? (filters.sort_order === 'asc' ? 'ascend' : 'descend')
        : null,
      render: (_, record) => cellContent(field, record),
    })
    const groups = profile.groups.map((group) => {
      const fields = profile.fields.filter((field) => field.group === group.key && visible.has(field.key))
      const children = fields.map(fieldColumn)
      if (group.key === 'workload' && visible.has('total_workload')) {
        children.push({
          title: '合计（预估 / 实际）',
          key: 'total_workload',
          width: 108,
          align: 'right',
          render: (_, record) => (
            <span className="ir-total">
              <strong>{formatRequirementNumber(record.total_estimated_workload)}</strong>
              <span>/ {formatRequirementNumber(record.total_actual_workload)}</span>
            </span>
          ),
        })
      }
      if (!children.length) return null
      return { title: group.label, key: `group-${group.key}`, children }
    }).filter(Boolean)
    groups.push({
      title: '操作',
      key: 'action',
      width: 60,
      fixed: 'right',
      className: 'ir-action-column',
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          aria-label={`${canEdit ? '查看或编辑' : '查看'} ${record.requirement_no}`}
          onClick={() => onOpenDetail(record)}
        >
          详情
        </Button>
      ),
    })
    return groups
  }, [draft, editing, filters.sort_by, filters.sort_order, canEdit, visible, onOpenDetail, profile])

  const width = useMemo(() => {
    const fieldWidth = profile.fields
      .filter((field) => visible.has(field.key))
      .reduce((sum, field) => sum + field.width, 0)
    return Math.max(1500, fieldWidth + (visible.has('total_workload') ? 108 : 0) + 60)
  }, [visible, profile])

  const toggleSort = (column) => {
    if (!column.sorter) return
    setFilters((current) => {
      if (current.sort_by !== column.key) {
        return { ...current, sort_by: column.key, sort_order: 'asc', page: 1 }
      }
      if (current.sort_order === 'asc') {
        return { ...current, sort_order: 'desc', page: 1 }
      }
      return { ...current, sort_by: 'completed_at', sort_order: 'desc', page: 1 }
    })
  }

  const sortIndicator = (column) => {
    if (filters.sort_by !== column.key) return ''
    return filters.sort_order === 'asc' ? '↑' : '↓'
  }

  return (
    <div
      className={`ir-grid-wrap ir-grid-wrap--${density}`}
      style={{ '--ir-grid-width': `${width}px` }}
    >
      <div className="ir-grid-scroll">
        <table className="ir-table" aria-label={profile.tableLabel}>
          <colgroup>
            {columns.flatMap((column) => (column.children ? column.children : [column])).map((column) => (
              <col key={column.key} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="ir-table__groups">
              {columns.map((column) => (
                <th key={column.key} colSpan={column.children ? column.children.length : 1} className="ir-table__group">
                  {column.children ? column.title : ''}
                </th>
              ))}
            </tr>
            <tr>
              {columns.flatMap((column) => (column.children ?? [column])).map((column) => (
                <th
                  key={column.key}
                  className={column.key === 'action' ? 'ir-table__action' : ''}
                  aria-sort={filters.sort_by === column.key ? (filters.sort_order === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sorter ? (
                    <button type="button" className="ir-th-sort" onClick={() => toggleSort(column)}>
                      {column.title}<span className="ir-th-sort__mark">{sortIndicator(column)}</span>
                    </button>
                  ) : column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((record) => (
              <tr key={record.id} className={draft[record.id] ? 'ir-row--dirty' : ''}>
                {columns.flatMap((column) => (column.children ?? [column])).map((column) => (
                  <td key={column.key} className={column.key === 'action' ? 'ir-table__action' : ''}>
                    {column.render ? column.render(record[column.key], record) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 0 && items.length < filters.page_size && (
          <div className="ir-grid-tail">
            <span>本页 {items.length} 条 · 共 {total} 条 · 已到最后一页</span>
          </div>
        )}
        {!items.length && !loading && (
          <div className="ir-grid-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={profile.emptyText} />
          </div>
        )}
      </div>

      {loading && (
        <div className="ir-grid-loading" role="status" aria-live="polite">
          <Spin size="small" /><span>加载{profile.tabLabel}数据…</span>
        </div>
      )}

      {dirtyCount > 0 && (
        <div className="ir-savebar" role="status" aria-live="polite">
          <div className="ir-savebar__copy">
            <span className="ir-savebar__dot" aria-hidden="true" />
            已修改 <b>{dirtyCount}</b> 项
            <span className="ir-savebar__hint">保存后写入审计日志</span>
          </div>
          <Button type="text" size="small" onClick={onDiscard} disabled={saving}>放弃</Button>
          <Button type="primary" size="small" onClick={onSave} loading={saving}>保存修改</Button>
        </div>
      )}

      <div className="ir-grid-foot">
        <span>共 {total} 条 · 本页 {items.length} 条</span>
        <div className="ir-grid-foot__controls">
          <label>
            每页
            <Select
              size="small"
              value={filters.page_size}
              aria-label="每页条数"
              options={[10, 20, 50, 100].map((value) => ({ value, label: String(value) }))}
              onChange={(value) => setFilters((current) => ({ ...current, page_size: value, page: 1 }))}
            />
            条
          </label>
          <Pagination
            size="small"
            current={filters.page}
            pageSize={filters.page_size}
            total={total}
            showSizeChanger={false}
            onChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </div>
      </div>
    </div>
  )
}
