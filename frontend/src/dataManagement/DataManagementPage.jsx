import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button as AntButton,
  Empty,
  Form as AntForm,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
} from '@ant-design/icons'

import { fetchJson } from '../api'
import FilterToolbar from '../components/FilterToolbar'
import FocusRestoringDrawer from '../components/FocusRestoringDrawer'
import PageHeader from '../components/PageHeader'
import StatusPage, { ContentLoadingState } from '../components/StatusPage'
import { currentMonthId, formatMetricValue, isValidMonth } from '../overview/overviewLogic'
import { maturitySavePayload, useMaturityRecords } from '../overview/maturityData'
import {
  metricValueLabel,
  sectionFromPath,
} from './dataManagementLogic'
import IRManagementPage from './ir/IRManagementPage'
import TeamPersonnelPage from './team/TeamPersonnelPage'
import ProductHierarchyPage from './products/ProductHierarchyPage'
import MetricDictionaryPage from './metrics/MetricDictionaryPage'
import './dataManagement.css'

const { Text } = Typography

const STICKY_HEADER_OFFSET = 56


const MANAGEMENT_CONFLICTS = {
  'team is referenced by facts or maintainers': '该团队仍有事实或维护者关联，无法删除。',
  'product is referenced by versions or IR data': '该产品仍被版本或 IR 数据引用，无法删除。',
  'version is referenced by iterations or IR data': '该版本仍被迭代或 IR 数据引用，无法删除。',
  'iteration is referenced by IR data': '该迭代仍被 IR 数据引用，无法删除。',
  'activity still has metrics': '该活动仍包含指标，无法删除。',
  'metric is referenced by facts': '该指标仍被事实记录引用，无法删除。',
  'cannot move a metric with facts': '该指标已有事实记录，不能更改所属活动。',
  'resource already exists': '名称或代码已被使用，请修改后重试。',
}

function dataManagementErrorMessage(error) {
  if (error.status !== 409) return error.message
  return MANAGEMENT_CONFLICTS[error.message] ?? '现有数据或名称冲突，操作未完成。请检查关联记录后重试。'
}

function Notice({ notice }) {
  if (!notice) return null
  return <Alert className="workbench-notice" type={notice.type === 'error' ? 'error' : 'success'} showIcon closable message={notice.text} />
}

function StatusTag({ tone = 'neutral', children }) {
  return <Tag className={`operational-status-tag operational-status-tag--${tone}`}>{children}</Tag>
}

function LoadingState({ text = '加载中…' }) {
  return <ContentLoadingState label={text} />
}

function EmptyState({ children = '暂无数据。' }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={children} />
}

function ReferenceError({ error }) {
  if (!error) return null
  return <Alert className="workbench-notice" type="error" showIcon message="基础数据加载失败" description={error.message} />
}

function PageIntro({ eyebrow, title, description, action }) {
  return <PageHeader className="operational-page-header" eyebrow={eyebrow} title={title} description={description} actions={action && <Space wrap>{action}</Space>} />
}

function SelectField({ label, value, onChange, options, disabled = false, placeholder = '全部', helper, className = 'operational-filter-control' }) {
  return (
    <label className={className}>
      <span>{label}</span>
      <Select
        size="small"
        value={value || undefined}
        allowClear
        disabled={disabled}
        placeholder={placeholder}
        options={options.map(([optionValue, optionLabel]) => ({ value: String(optionValue), label: optionLabel }))}
        onChange={(nextValue) => onChange(nextValue ?? '')}
      />
      {helper && <span className="operational-filter-help">{helper}</span>}
    </label>
  )
}

function InputField({ label, value, onChange, type = 'text', className = 'operational-filter-control' }) {
  return <label className={className}><span>{label}</span><Input aria-label={label} size="small" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function useReferenceData(onSessionExpired, user) {
  const [data, setData] = useState({ teams: [], products: [], versions: [], members: [] })
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [teams, products, versions, members] = await Promise.all([
        fetchJson('/api/teams'),
        fetchJson('/api/products'),
        fetchJson('/api/versions'),
        fetchJson('/api/team-members'),
      ])
      const visibleProductIds = new Set(products.map((product) => product.id))
      const visibleVersions = user.role === 'maintainer'
        ? versions.filter((version) => visibleProductIds.has(version.product_id))
        : versions
      setData({ teams, products, versions: visibleVersions, members })
      setError(null)
    } catch (nextError) {
      setError(nextError)
      if (nextError.status === 401) onSessionExpired()
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [onSessionExpired, user.role])

  useEffect(() => { reload() }, [reload])
  return { ...data, loading, hasLoaded, error, reload }
}

function RequirementManagement({ requirementType, onRequirementTypeChange, ...props }) {
  const activeType = ['ir', 'ar', 'sr'].includes(requirementType) ? requirementType : 'ir'
  const pending = (type) => <div className="workbench-page"><PageIntro title={`${type} 需求`} description="当前只有 IR 需求具备字段、校验、导入和指标口径。" /><section className="operational-state" role="status"><StatusTag tone="pending">规格待定义</StatusTag><span className="operational-state__message">暂不提供 {type} 需求表单。</span></section></div>
  return <Tabs className="ir-requirements-tabs" activeKey={activeType} onChange={onRequirementTypeChange} items={[
    { key: 'ir', label: 'IR', children: <IRManagementPage {...props} /> },
    { key: 'ar', label: 'AR', children: pending('AR') },
    { key: 'sr', label: 'SR', children: pending('SR') },
  ]} />
}

function MaturityReadOnly({ month, onSessionExpired }) {
  const [state, setState] = useState({ loading: true, data: [], error: null })
  useEffect(() => {
    let active = true
    Promise.all(['key', 'general'].map((kind) => fetchJson(`/api/maturity/overview?month=${encodeURIComponent(month)}&kind=${kind}`)))
      .then((data) => { if (active) setState({ loading: false, data, error: null }) })
      .catch((error) => { if (active) setState({ loading: false, data: [], error }); if (error.status === 401) onSessionExpired() })
    return () => { active = false }
  }, [month, onSessionExpired])
  if (state.loading) return <LoadingState text="加载成熟度评估…" />
  if (state.error) return <ReferenceError error={state.error} />
  return <div className="maturity-readonly-sections">{state.data.map((overview) => {
    const title = overview.kind === 'key' ? '关键研发活动' : '通用研发能力'
    const headingId = `maturity-${overview.kind}-heading`
    return <section key={overview.kind} className="maturity-readonly-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="maturity-readonly-section__title">{title}</h2>
      <Table
        className="operational-table"
        rowKey="activity_id"
        size="small"
        sticky={{ offsetHeader: STICKY_HEADER_OFFSET }}
        pagination={false}
        scroll={{ x: 600 }}
        dataSource={overview.activities}
        columns={[
          { title: '活动', dataIndex: 'activity_name' },
          { title: '领域平均', dataIndex: 'score_display', render: (value) => <StatusTag tone={value === null || value === undefined ? 'not-evaluated' : 'neutral'}>{value ?? '未评估'}</StatusTag> },
          { title: '等级', dataIndex: 'level', render: (value) => <StatusTag tone={value === null || value === undefined ? 'not-evaluated' : 'neutral'}>{value ?? '未评估'}</StatusTag> },
          { title: '覆盖', className: 'operational-cell--numeric', align: 'right', render: (_, row) => `${row.assessed_team_count} / ${overview.team_count}` },
        ]}
      />
    </section>
  })}</div>
}

function MaturityEditor({ teamId, month, catalog, onSessionExpired, onSaved }) {
  const [draft, setDraft] = useState([])
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const [message, setMessage] = useState(null)
  const recordsState = useMaturityRecords(teamId, month, onSessionExpired, Boolean(teamId))
  const activities = useMemo(() => [...catalog].sort((left, right) => (left.sort_order ?? left.id) - (right.sort_order ?? right.id)), [catalog])

  useEffect(() => {
    if (!teamId || recordsState.loading) return
    const records = new Map(recordsState.records.map((record) => [record.activity_id, record]))
    setDraft(activities.map((activity) => {
      const record = records.get(activity.id)
      return { activity_id: activity.id, activity_name: activity.name, kind: activity.kind, score: record?.score_raw ?? '', note: record?.note ?? '' }
    }))
    setPreview(false)
    setClearArmed(false)
    setMessage(null)
  }, [activities, month, recordsState.loading, recordsState.records, teamId])

  function updateEntry(activityId, patch) {
    setDraft((current) => current.map((entry) => entry.activity_id === activityId ? { ...entry, ...patch } : entry))
  }

  function copyPrevious() {
    const previous = new Map(recordsState.previousRecords.map((record) => [record.activity_id, record]))
    setDraft((current) => current.map((entry) => {
      const record = previous.get(entry.activity_id)
      return record ? { ...entry, score: record.score_raw, note: record.note ?? '' } : entry
    }))
    setMessage({ type: 'info', text: `已载入上月 ${recordsState.previousRecords.length} 条已有评估，请预览确认后保存。` })
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await fetchJson(`/api/maturity/teams/${teamId}/months/${month}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(maturitySavePayload(draft)) })
      setMessage({ type: 'success', text: '成熟度已保存。' })
      setPreview(false)
      onSaved?.()
    } catch (error) {
      setMessage({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (!clearArmed) { setClearArmed(true); return }
    setClearing(true)
    try {
      await fetchJson(`/api/maturity/teams/${teamId}/months/${month}`, { method: 'DELETE' })
      setDraft((current) => current.map((entry) => ({ ...entry, score: '', note: '' })))
      setClearArmed(false)
      setPreview(false)
      setMessage('本月成熟度已清空。')
      onSaved?.()
    } catch (error) {
      setMessage({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally {
      setClearing(false)
    }
  }

  if (!teamId) return <Empty description="先选择可维护团队。" />
  if (recordsState.loading) return <LoadingState text="加载当前月和上月评估…" />
  if (recordsState.error) return <ReferenceError error={recordsState.error} />
  const columns = [
    { title: '活动', dataIndex: 'activity_name', render: (name, entry) => <Space wrap><Text strong>{name}</Text><StatusTag>{entry.kind === 'key' ? '关键研发活动' : '通用研发能力'}</StatusTag></Space> },
    { title: '成熟度分值（0–5）', dataIndex: 'score', width: 190, render: (value, entry) => <InputNumber aria-label={`${entry.activity_name}成熟度分值`} min={0} max={5} step={0.01} value={value === '' ? null : Number(value)} onChange={(nextValue) => updateEntry(entry.activity_id, { score: nextValue === null ? '' : String(nextValue) })} placeholder="未评估" style={{ width: 132 }} /> },
    { title: '说明（可选）', dataIndex: 'note', width: 360, render: (value, entry) => <Input.TextArea aria-label={`${entry.activity_name}说明`} autoSize={{ minRows: 1, maxRows: 3 }} value={value} onChange={(event) => updateEntry(entry.activity_id, { note: event.target.value })} placeholder="补充评估依据" /> },
  ]
  return <div className="maturity-editor">
    <div className="maturity-editor__heading"><Text strong>评估项</Text><Text type="secondary">空值表示未评估；0 是有效分值。</Text></div>
    {message && <Alert type={message.type} message={message.text} showIcon />}
    <div className="maturity-editor__actions"><Space wrap><AntButton onClick={copyPrevious} disabled={!recordsState.previousRecords.length || saving || clearing}>复制上月已有值</AntButton><AntButton type="primary" onClick={() => setPreview(true)} disabled={saving || clearing}>预览保存</AntButton><AntButton danger onClick={clear} loading={clearing} disabled={saving}>{clearArmed ? '再次确认清空' : '清空本月评估'}</AntButton></Space></div>
    <Table rowKey="activity_id" className="maturity-editor__table operational-table" size="small" sticky={{ offsetHeader: STICKY_HEADER_OFFSET }} columns={columns} dataSource={draft} pagination={false} scroll={{ x: 780 }} locale={{ emptyText: <EmptyState>当前没有可评估活动。</EmptyState> }} />
    <FocusRestoringDrawer title={`保存预览 · ${month}`} open={preview} width="min(640px, 100vw)" onClose={() => setPreview(false)} destroyOnClose footer={<Space><AntButton onClick={() => setPreview(false)} disabled={saving}>返回编辑</AntButton><AntButton type="primary" onClick={save} loading={saving}>确认保存</AntButton></Space>}>
      <p className="maturity-preview-drawer__description">请核对 {draft.length} 个评估项。未评估项保持为空，不会按 0 保存。</p>
      <Table rowKey="activity_id" className="operational-table" size="small" pagination={false} scroll={{ x: 600, y: 440 }} dataSource={draft} columns={[{ title: '活动', dataIndex: 'activity_name' }, { title: '分值', dataIndex: 'score', render: (value) => value === '' ? <StatusTag tone="not-evaluated">未评估</StatusTag> : value }, { title: '说明', dataIndex: 'note', render: (value) => value || '—' }]} />
    </FocusRestoringDrawer>
  </div>
}

function MaturityManagement({ user, refs, initialMonth, onSessionExpired }) {
  const [month, setMonth] = useState(() => isValidMonth(initialMonth) ? initialMonth : currentMonthId())
  const [teamId, setTeamId] = useState(user.role === 'maintainer' ? String(user.maintainer_team_id) : '')
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(null)
  const [savedAt, setSavedAt] = useState(0)
  const canEdit = user.role === 'admin' || user.role === 'maintainer'
  useEffect(() => {
    let active = true
    fetchJson('/api/catalog').then((data) => { if (active) { setCatalog(data); setCatalogError(null) } }).catch((error) => { if (active) setCatalogError(error); if (error.status === 401) onSessionExpired() }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onSessionExpired])
  const selectedTeam = refs.teams.find((team) => String(team.id) === String(teamId))
  return <div className="workbench-page maturity-management">
    <PageIntro title="成熟度评估" description="按团队和自然月维护人工成熟度；分析页只读展示，不在这里之外写入。" action={!canEdit && <StatusTag tone="readonly">只读</StatusTag>} />
    <FilterToolbar className="operational-filter-toolbar maturity-management__toolbar" label="评估范围">
      <label className="operational-filter-control"><span>评估月份</span><Input aria-label="评估月份" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      {canEdit && <label className="operational-filter-control"><span>维护团队</span><Select aria-label="维护团队" aria-describedby={user.role === 'maintainer' ? 'maturity-team-scope-help' : undefined} value={teamId || undefined} disabled={user.role === 'maintainer'} placeholder="选择团队" onChange={setTeamId} options={refs.teams.map((team) => ({ value: String(team.id), label: team.name }))} />{user.role === 'maintainer' && <span id="maturity-team-scope-help" className="operational-filter-help">团队由账号绑定，不能修改。</span>}</label>}
    </FilterToolbar>
    {loading ? <LoadingState text="加载成熟度目录…" /> : catalogError ? <ReferenceError error={catalogError} /> : canEdit ? <MaturityEditor key={`${teamId}-${month}-${savedAt}`} teamId={teamId} month={month} catalog={catalog} onSessionExpired={onSessionExpired} onSaved={() => setSavedAt((value) => value + 1)} /> : <MaturityReadOnly month={month} onSessionExpired={onSessionExpired} />}
  </div>
}

export default function DataManagementPage({ pathname, section: requestedSection, requirementType = 'ir', initialMonth, onRequirementTypeChange, user, onSessionExpired }) {
  const section = requestedSection ?? sectionFromPath(pathname)
  const refs = useReferenceData(onSessionExpired, user)
  if (refs.loading && !refs.hasLoaded && ['teams', 'products', 'metrics'].includes(section)) return <div className="data-management-content"><LoadingState text="加载主数据…" /></div>
  if (refs.error && ['teams', 'products'].includes(section)) return <div className="data-management-content"><StatusPage status="error" title="系统管理数据暂时无法加载" description="请重试；如果问题持续，请稍后再试。" actions={<AntButton type="primary" onClick={() => refs.reload()}>重试</AntButton>} /></div>
  let content
  if (section === 'teams') content = <TeamPersonnelPage user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'products') content = <ProductHierarchyPage user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'ir') content = <IRManagementPage user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'requirements') content = <RequirementManagement requirementType={requirementType} onRequirementTypeChange={onRequirementTypeChange} user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'metrics') content = <MetricDictionaryPage onSessionExpired={onSessionExpired} />
  else if (section === 'maturity') content = <MaturityManagement user={user} refs={refs} initialMonth={initialMonth} onSessionExpired={onSessionExpired} />
  else content = <EmptyState>该数据域尚未定义。</EmptyState>
  const workbench = section === 'ir' || section === 'requirements'
  return <div className={`data-management-content${workbench ? ' data-management-content--workbench' : ''}`}><ReferenceError error={refs.error} />{content}</div>
}
