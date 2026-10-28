import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Drawer, Space, Table, Tag, Typography } from 'antd'
import {
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'

import { downloadFile, fetchJson } from '../../api'
import PageHeader from '../../components/PageHeader'
import RequirementDataGrid from './RequirementDataGrid'
import RequirementFilterBar from './RequirementFilterBar'
import RequirementImportWizard from './RequirementImportWizard'
import RequirementRecordDrawer from './RequirementRecordDrawer'
import RequirementSummaryStrip from './RequirementSummaryStrip'
import {
  formatRequirementTimestamp,
  requirementQuery,
} from './requirementProfiles'
import './ir-workbench.css'

const { Text } = Typography

const OPERATION_LABELS = {
  insert: '新增',
  update: '更新',
  fill: '补充空值',
  unchanged: '无变化',
}

function Notice({ notice }) {
  if (!notice) return null
  return <Alert className="ir-notice" type={notice.type === 'error' ? 'error' : 'success'} showIcon closable message={notice.text} />
}

function CollectorBatchDrawer({ profile, open, batch, teamName, onClose, onConfirm, confirming }) {
  const labels = useMemo(() => ({ ...profile.ownerLabels, ...profile.fieldLabels }), [profile])
  const rows = batch?.rows ?? []
  const columns = [
    { title: '行', dataIndex: 'row_number', width: 56 },
    { title: '记录 ID', dataIndex: 'source_id', render: (value) => <Text code>{value ?? '—'}</Text> },
    { title: '动作', dataIndex: 'operation', render: (value) => <Tag className="ir-tag ir-tag--neutral">{OPERATION_LABELS[value] ?? value}</Tag> },
    {
      title: '差异',
      dataIndex: 'diff',
      render: (diff = {}) => (
        <Space orientation="vertical" size={2}>
          {Object.entries(diff).filter(([, value]) => value.action !== 'unchanged').slice(0, 4).map(([field, value]) => (
            <Text key={field} type="secondary">{labels[field] ?? field}：{value.action === 'keep' ? '保留正式值' : `→ ${value.to ?? '空'}`}</Text>
          ))}
          {!Object.values(diff).some((value) => value.action !== 'unchanged') && <Text type="secondary">—</Text>}
        </Space>
      ),
    },
    {
      title: '校验',
      key: 'validation',
      render: (_, row) => (
        <Space orientation="vertical" size={2}>
          {row.errors?.map((item) => <Text key={item} type="danger">{item}</Text>)}
          {row.warnings?.map((item) => <Text key={item} type="warning">{item}</Text>)}
          {!row.errors?.length && !row.warnings?.length && <Tag className="ir-tag ir-tag--success">通过</Tag>}
        </Space>
      ),
    },
  ]
  return (
    <Drawer
      title={`采集批次预览 · ${teamName ?? '团队'}`}
      open={open}
      size={1080}
      styles={{ body: { padding: 20 } }}
      onClose={onClose}
      destroyOnHidden
      footer={(
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button
            type="primary"
            loading={confirming}
            disabled={!batch || batch.invalid_rows > 0 || batch.status !== 'pending'}
            onClick={onConfirm}
          >
            {batch?.invalid_rows ? '存在错误，不能确认' : '确认采集批次'}
          </Button>
        </Space>
      )}
    >
      <div className="ir-collector-meta">
        <Tag className="ir-tag ir-tag--neutral">平台采集</Tag>
        <Text type="secondary">生成时间 {formatRequirementTimestamp(batch?.created_at)}</Text>
        <Text type="secondary">总行数 {batch?.total_rows ?? 0} · 有效 {batch?.valid_rows ?? 0} · 错误 {batch?.invalid_rows ?? 0}</Text>
      </div>
      {batch?.invalid_rows > 0 && <Alert type="error" showIcon message="存在错误行，整批不能确认。" />}
      <Table
        rowKey="row_number"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: 900 }}
      />
    </Drawer>
  )
}

export default function RequirementWorkbench({ profile, user, refs, onSessionExpired }) {
  const canEdit = user.role === 'admin' || user.role === 'maintainer'
  const [filters, setFilters] = useState(() => profile.defaultFilters(user))
  const [data, setData] = useState({ items: [], total: 0, summary: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editor, setEditor] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [viewPreset, setViewPreset] = useState('all')
  const [customKeys, setCustomKeys] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [density, setDensity] = useState('standard')
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [collectorBatches, setCollectorBatches] = useState([])
  const [collectorLoading, setCollectorLoading] = useState(false)
  const [collectorBatch, setCollectorBatch] = useState(null)
  const [collectorOpen, setCollectorOpen] = useState(false)
  const [collectorConfirming, setCollectorConfirming] = useState(false)

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchJson(`${profile.apiBase}?${requirementQuery(filters)}`)
      setData(next)
      if (clearNotice) setNotice(null)
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      else setError(nextError)
    } finally {
      setLoading(false)
    }
  }, [filters, onSessionExpired, profile.apiBase])

  useEffect(() => { load() }, [load])

  const loadCollectorBatches = useCallback(async () => {
    if (!profile.hasCollector || !canEdit) return
    setCollectorLoading(true)
    try {
      setCollectorBatches(await fetchJson('/api/data/ir/imports?source_kind=collector&status=pending'))
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
    } finally {
      setCollectorLoading(false)
    }
  }, [canEdit, onSessionExpired, profile.hasCollector])

  useEffect(() => { loadCollectorBatches() }, [loadCollectorBatches])

  const preset = profile.viewPresets.find((item) => item.value === viewPreset) ?? profile.viewPresets[0]
  const visibleKeys = useMemo(() => customKeys ?? preset.keys, [customKeys, preset.keys])
  const activeCount = profile.activeFilterCount(filters)

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'team_id' ? { version_id: '', iteration_id: '' } : {}),
      ...(key === 'version_id' ? { iteration_id: '' } : {}),
      page: 1,
    }))
  }

  function resetFilters() {
    setFilters(profile.defaultFilters(user))
    setViewPreset('all')
    setCustomKeys(null)
    setAdvancedOpen(false)
  }

  async function saveDraft() {
    const items = Object.entries(draft).map(([id, changes]) => {
      const record = data.items.find((item) => item.id === Number(id))
      return { id: Number(id), changes: profile.changesFromDraft(record, changes) }
    }).filter((item) => Object.keys(item.changes).length)
    if (!items.length) {
      setDraft({})
      return
    }
    setSaving(true)
    try {
      await fetchJson(`${profile.apiBase}/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      setDraft({})
      setNotice({ type: 'success', text: `已保存 ${items.length} 行修改。` })
      await load({ clearNotice: false })
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setNotice({ type: 'error', text: nextError.message || '批量保存失败，请检查修改内容。' })
    } finally {
      setSaving(false)
    }
  }

  async function openCollectorBatch(summary) {
    setCollectorConfirming(false)
    try {
      setCollectorBatch(await fetchJson(`/api/data/ir/imports/${summary.id}`))
      setCollectorOpen(true)
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setNotice({ type: 'error', text: nextError.message })
    }
  }

  async function confirmCollectorBatch() {
    if (!collectorBatch) return
    setCollectorConfirming(true)
    try {
      const result = await fetchJson(`/api/data/ir/imports/${collectorBatch.id}/confirm`, { method: 'POST' })
      setCollectorOpen(false)
      setCollectorBatch(null)
      setNotice({ type: 'success', text: `采集批次已确认：新增 ${result.created} 条，补充 ${result.updated} 条，未变化 ${result.unchanged} 条。` })
      await load({ clearNotice: false })
      await loadCollectorBatches()
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setNotice({ type: 'error', text: nextError.message })
    } finally {
      setCollectorConfirming(false)
    }
  }

  function handleSaved(message) {
    setEditor(null)
    setDraft({})
    setNotice({ type: 'success', text: message })
    load({ clearNotice: false })
  }

  function handleImportConfirmed(result) {
    setNotice({
      type: 'success',
      text: `导入批次已确认：新增 ${result.created} 条，更新 ${result.updated} 条，未变化 ${result.unchanged} 条。`,
    })
    setDraft({})
    load({ clearNotice: false })
  }

  return (
    <div className="ir-workbench">
      <PageHeader
        className="ir-page-header"
        eyebrow={profile.eyebrow}
        title={profile.title}
        description={profile.description}
        actions={canEdit ? (
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => Promise.resolve(downloadFile(profile.templateUrl, profile.templateName)).catch((nextError) => setNotice({ type: 'error', text: nextError.message }))}
            >
              下载模板
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>导入 Excel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ record: null })}>新增{profile.recordLabel}</Button>
          </Space>
        ) : <Tag className="ir-tag ir-tag--neutral">只读</Tag>}
      />

      {notice && <Notice notice={notice} />}
      {error && (
        <Alert
          className="ir-notice"
          type="error"
          showIcon
          message={`${profile.tabLabel}数据加载失败`}
          description={error.message}
          action={<Button size="small" onClick={() => load()}>重试</Button>}
        />
      )}

      <RequirementSummaryStrip profile={profile} summary={data.summary} loading={loading} />
      <RequirementFilterBar
        profile={profile}
        filters={filters}
        onChange={updateFilter}
        onRemoveFilter={(key) => updateFilter(key, '')}
        user={user}
        refs={refs}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen((open) => !open)}
        onReset={resetFilters}
        activeCount={activeCount}
        viewPreset={viewPreset}
        onViewPreset={(value) => { setViewPreset(value); setCustomKeys(null) }}
        density={density}
        onDensity={setDensity}
        onOpenColumns={() => setSettingsOpen(true)}
        loading={loading}
      />

      {profile.hasCollector && canEdit && (collectorLoading || collectorBatches.length > 0) && (
        <section className="ir-collector-strip" aria-label="待确认采集批次">
          <div className="ir-collector-strip__heading">
            <Tag className="ir-tag ir-tag--warning">平台采集</Tag>
            <Text strong>待确认采集批次</Text>
            <Text type="secondary">{collectorLoading ? '加载中…' : `${collectorBatches.length} 个`}</Text>
          </div>
          <Space wrap size={4}>
            {collectorBatches.map((batch) => (
              <Button key={batch.id} size="small" onClick={() => openCollectorBatch(batch)}>
                {refs.teams.find((team) => team.id === batch.team_id)?.name ?? `团队 #${batch.team_id}`} · {batch.valid_rows}/{batch.total_rows}
              </Button>
            ))}
          </Space>
        </section>
      )}

      <section className="ir-workspace" aria-labelledby={`ir-table-heading-${profile.key}`}>
        <div className="ir-workspace__head">
          <div>
            <h2 id={`ir-table-heading-${profile.key}`} className="ir-workspace__title">{profile.workspaceTitle}</h2>
            <span className="ir-workspace__meta">共 {data.total} 条 · 本页 {data.items.length} 条</span>
          </div>
          <Space size={4}>
            <Text type="secondary">当前筛选范围</Text>
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => load()} aria-label={`刷新${profile.tabLabel}数据`} />
          </Space>
        </div>
        <RequirementDataGrid
          profile={profile}
          items={data.items}
          loading={loading}
          total={data.total}
          filters={filters}
          setFilters={setFilters}
          canEdit={canEdit}
          draft={draft}
          setDraft={setDraft}
          onSave={saveDraft}
          onDiscard={() => setDraft({})}
          saving={saving}
          visibleKeys={visibleKeys}
          density={density}
          onOpenDetail={(record) => setEditor({ record })}
        />
      </section>

      <RequirementRecordDrawer
        profile={profile}
        editor={editor}
        refs={refs}
        user={user}
        readOnly={!canEdit}
        onClose={() => setEditor(null)}
        onSaved={handleSaved}
        onSessionExpired={onSessionExpired}
      />
      <RequirementImportWizard
        profile={profile}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirmed={handleImportConfirmed}
        onSessionExpired={onSessionExpired}
      />
      {profile.hasCollector && (
        <CollectorBatchDrawer
          profile={profile}
          open={collectorOpen}
          batch={collectorBatch}
          teamName={refs.teams.find((team) => team.id === collectorBatch?.team_id)?.name}
          onClose={() => setCollectorOpen(false)}
          onConfirm={confirmCollectorBatch}
          confirming={collectorConfirming}
        />
      )}

      <Drawer
        title="列设置"
        open={settingsOpen}
        size={420}
        styles={{ body: { padding: 20 } }}
        onClose={() => setSettingsOpen(false)}
        destroyOnHidden
        footer={<Button type="primary" onClick={() => setSettingsOpen(false)}>完成</Button>}
      >
        <Text type="secondary">勾选需要在表格中显示的字段；全部模板字段仍可通过视图预设切换。</Text>
        <Checkbox.Group
          className="ir-column-settings"
          value={customKeys ?? preset.keys}
          options={[
            ...profile.templateFields.map((field) => ({ value: field.key, label: field.label })),
            { value: 'total_workload', label: '合计（预估 / 实际）' },
          ]}
          onChange={(values) => setCustomKeys(values)}
        />
      </Drawer>
    </div>
  )
}
