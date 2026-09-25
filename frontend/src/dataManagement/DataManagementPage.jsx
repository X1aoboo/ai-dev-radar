import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button as AntButton,
  Card,
  Descriptions,
  Divider,
  Empty,
  Form as AntForm,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'

import { fetchJson } from '../api'
import FilterToolbar from '../components/FilterToolbar'
import FocusRestoringDrawer from '../components/FocusRestoringDrawer'
import PageHeader from '../components/PageHeader'
import StatusPage, { ContentLoadingState } from '../components/StatusPage'
import { currentMonthId, formatMetricValue, isValidMonth } from '../overview/overviewLogic'
import { maturitySavePayload, useMaturityRecords } from '../overview/maturityData'
import {
  buildIrQuery,
  irFormFromRecord,
  irFormPayload,
  metricValueLabel,
  sectionFromPath,
} from './dataManagementLogic'
import './dataManagement.css'

const { Text, Title } = Typography

const EMPTY_IR_FORM = {
  requirement_no: '',
  requirement_name: '',
  responsible_employee_id: '',
  parent_requirement_no: '',
  product_id: '',
  version_id: '',
  iteration_id: '',
  completed_at: '',
  business_module: '',
  requirement_scenario: '',
  estimated_workload: '',
  actual_workload: '',
  sa_estimated_workload: '',
  sa_actual_workload: '',
  se_estimated_workload: '',
  se_actual_workload: '',
  ai_assisted: '',
}

const DASHBOARD_METRIC_TYPES = [
  { value: 'penetration', label: '渗透率' },
  { value: 'efficiency', label: '效率提升' },
  { value: 'count', label: '数量' },
  { value: 'boolean', label: '布尔状态' },
  { value: 'ratio', label: '比率' },
]

const DATA_METRIC_TYPES = DASHBOARD_METRIC_TYPES.filter(({ value }) => value !== 'boolean')

const ACTIVITY_KINDS = [
  { value: 'key', label: '关键研发活动' },
  { value: 'general', label: '通用研发能力' },
]

const RECORD_SOURCE_LABELS = {
  manual: '页面编辑',
  import: '导入',
  collector: '平台采集',
  auto: '自动采集',
}

const STICKY_HEADER_OFFSET = 56

const EMPTY_TEAM_FORM = { id: null, name: '', productVersions: '', repos: '' }
const EMPTY_MEMBER_FORM = { id: null, team_id: '', employee_id: '', name: '', role: '' }

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

function formatTableTimestamp(value) {
  if (!value) return '—'
  const timestamp = String(value)
  return timestamp.includes('T') ? `${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}` : timestamp
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

function ReadOnlyHint() {
  return <Alert type="info" showIcon message="当前角色只读，管理员可维护此主数据。" />
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

function TeamEditorDrawer({ editor, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => {
    if (editor) form.setFieldsValue(editor)
  }, [editor, form])
  return (
    <FocusRestoringDrawer
      title={editor?.id ? '编辑团队' : '新增团队'}
      open={Boolean(editor)}
      size={480}
      onClose={onClose}
      destroyOnClose
      footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存团队</AntButton></Space>}
    >
      <AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}>
        <AntForm.Item name="name" label="团队名称" rules={[{ required: true, message: '请输入团队名称' }]}><Input /></AntForm.Item>
        <AntForm.Item name="productVersions" label="产品版本映射"><Input.TextArea rows={3} placeholder="可用逗号或换行分隔" /></AntForm.Item>
        <AntForm.Item name="repos" label="代码仓地址"><Input.TextArea rows={3} placeholder="可用逗号或换行分隔" /></AntForm.Item>
      </AntForm>
    </FocusRestoringDrawer>
  )
}

function MemberEditorDrawer({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => {
    if (editor) form.setFieldsValue(editor)
  }, [editor, form])
  return (
    <FocusRestoringDrawer
      title={editor?.id ? '编辑团队成员' : '新增团队成员'}
      open={Boolean(editor)}
      size={480}
      onClose={onClose}
      destroyOnClose
      footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存成员</AntButton></Space>}
    >
      <AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}>
        <AntForm.Item name="team_id" label="所属团队" rules={[{ required: true, message: '请选择团队' }]}><Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} /></AntForm.Item>
        <AntForm.Item name="employee_id" label="工号" rules={[{ required: true, message: '请输入工号' }]}><Input /></AntForm.Item>
        <AntForm.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></AntForm.Item>
        <AntForm.Item name="role" label="角色" rules={[{ required: true, message: '请输入人员角色' }]}><Input placeholder="研发工程师" /></AntForm.Item>
      </AntForm>
    </FocusRestoringDrawer>
  )
}

function TeamManagement({ user, refs, onRefresh, onSessionExpired }) {
  const canEdit = user.role === 'admin'
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [teamEditor, setTeamEditor] = useState(null)
  const [memberEditor, setMemberEditor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedTeamId || !refs.teams.some((team) => team.id === selectedTeamId)) setSelectedTeamId(refs.teams[0]?.id ?? null)
  }, [refs.teams, selectedTeamId])

  const selectedTeam = refs.teams.find((team) => team.id === selectedTeamId)
  const members = refs.members.filter((member) => member.team_id === selectedTeamId)
  const memberCounts = new Map(refs.teams.map((team) => [team.id, 0]))
  refs.members.forEach((member) => memberCounts.set(member.team_id, (memberCounts.get(member.team_id) ?? 0) + 1))

  async function saveTeam(values) {
    setSubmitting(true)
    try {
      const editing = Boolean(teamEditor.id)
      await fetchJson(editing ? `/api/teams/${teamEditor.id}` : '/api/teams', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          source_mapping: {
            product_versions: values.productVersions.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
            repos: values.repos.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
          },
        }),
      })
      setTeamEditor(null)
      setNotice({ type: 'success', text: editing ? '团队已更新。' : '团队已创建。' })
      await onRefresh()
    } catch (error) {
      setNotice({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally { setSubmitting(false) }
  }

  async function saveMember(values) {
    setSubmitting(true)
    try {
      const editing = Boolean(memberEditor.id)
      await fetchJson(editing ? `/api/team-members/${memberEditor.id}` : '/api/team-members', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, team_id: Number(values.team_id) }),
      })
      setMemberEditor(null)
      setNotice({ type: 'success', text: editing ? '团队成员已更新。' : '团队成员已创建。' })
      await onRefresh()
    } catch (error) {
      setNotice({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally { setSubmitting(false) }
  }

  async function removeMember(member) {
    try {
      await fetchJson(`/api/team-members/${member.id}`, { method: 'DELETE' })
      setNotice({ type: 'success', text: '团队成员已删除。' })
      await onRefresh()
    } catch (error) {
      setNotice({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    }
  }

  async function removeTeam(team) {
    try {
      await fetchJson(`/api/teams/${team.id}`, { method: 'DELETE' })
      setNotice({ type: 'success', text: '团队已删除。' })
      await onRefresh()
    } catch (error) {
      setNotice({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    }
  }

  const teamColumns = [
    { title: '团队', dataIndex: 'name', width: 160, render: (name) => <Text strong>{name}</Text> },
    { title: '成员', width: 64, align: 'right', render: (_, team) => user.role === 'maintainer' && team.id !== user.maintainer_team_id ? '—' : memberCounts.get(team.id) },
    { title: '选择', key: 'action', width: 72, render: (_, team) => <AntButton type="link" size="small" aria-label={`查看团队 ${team.name}`} aria-pressed={team.id === selectedTeamId} onClick={() => setSelectedTeamId(team.id)}>查看</AntButton> },
  ]
  const memberColumns = [
    { title: '成员', dataIndex: 'name', render: (name, member) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text type="secondary">{member.employee_id} · {member.role}</Text></Space> },
    { title: '操作', key: 'action', fixed: 'right', width: 150, render: (_, member) => canEdit && <Space size={0}><AntButton type="link" size="small" aria-label={`编辑团队成员 ${member.name}`} icon={<EditOutlined />} onClick={() => setMemberEditor({ ...member, team_id: String(member.team_id) })}>编辑</AntButton><Popconfirm okText="删除" cancelText="取消" title={`确定删除成员“${member.name}”？`} description="删除成功后无法恢复。" onConfirm={() => removeMember(member)}><AntButton type="link" danger size="small" aria-label={`删除团队成员 ${member.name}`} icon={<DeleteOutlined />}>删除</AntButton></Popconfirm></Space> },
  ]

  return (
    <div className="workbench-page">
      <PageIntro title="团队与人员" description="团队是当前看板的统计和权限归属单位；成员工号用于关联源数据责任人。" action={canEdit && <AntButton type="primary" icon={<PlusOutlined />} onClick={() => setTeamEditor(EMPTY_TEAM_FORM)}>新增团队</AntButton>} />
      <Notice notice={notice} />
      {!canEdit && <ReadOnlyHint />}
      <div className="settings-master-detail">
        <section className="settings-workspace" aria-label="团队列表">
          <div className="settings-workspace__header"><h2 className="settings-workspace__title">团队</h2><span className="settings-workspace__count">{refs.teams.length} 个</span></div>
          <Table className="operational-table" rowKey="id" size="small" loading={refs.loading} columns={teamColumns} dataSource={refs.teams} pagination={false} scroll={{ x: 296 }} rowClassName={(record) => record.id === selectedTeamId ? 'is-selected' : ''} locale={{ emptyText: <EmptyState>暂无团队。</EmptyState> }} />
        </section>
        <section className="settings-workspace" aria-label="团队详情">
          <div className="settings-workspace__header"><h2 className="settings-workspace__title">{selectedTeam ? `${selectedTeam.name} · 团队详情` : '团队详情'}</h2>{canEdit && selectedTeam && <Space wrap size={0}><AntButton size="small" icon={<EditOutlined />} aria-label={`编辑团队 ${selectedTeam.name}`} onClick={() => setTeamEditor({ id: selectedTeam.id, name: selectedTeam.name, productVersions: selectedTeam.source_mapping?.product_versions?.join('\n') || '', repos: selectedTeam.source_mapping?.repos?.join('\n') || '' })}>编辑团队</AntButton><Popconfirm okText="删除" cancelText="取消" title={`确定删除团队“${selectedTeam.name}”？`} description="有关联数据或维护者时可能无法删除；删除成功后无法恢复。" onConfirm={() => removeTeam(selectedTeam)}><AntButton danger size="small" aria-label={`删除团队 ${selectedTeam.name}`}>删除团队</AntButton></Popconfirm><AntButton size="small" icon={<PlusOutlined />} onClick={() => setMemberEditor({ ...EMPTY_MEMBER_FORM, team_id: String(selectedTeam.id) })}>新增成员</AntButton></Space>}</div>
          <div className="settings-workspace__body">
            {selectedTeam ? <><Descriptions size="small" column={1} items={[{ key: 'mapping', label: '数据源映射', children: <Space wrap>{(selectedTeam.source_mapping?.product_versions ?? []).map((value) => <Tag key={value}>{value}</Tag>)}{(selectedTeam.source_mapping?.repos ?? []).map((value) => <Tag key={value} color="blue">{value}</Tag>)}{!selectedTeam.source_mapping?.product_versions?.length && !selectedTeam.source_mapping?.repos?.length && <Text type="secondary">未配置</Text>}</Space> }]} /><section className="settings-section"><div className="settings-section__header"><h3 className="settings-section__title">团队成员</h3><span className="settings-workspace__count">{user.role === 'maintainer' && selectedTeam.id !== user.maintainer_team_id ? '—' : `${members.length} 人`}</span></div><Table className="operational-table" rowKey="id" size="small" loading={refs.loading} columns={memberColumns} dataSource={members} pagination={false} locale={{ emptyText: <EmptyState>{user.role === 'maintainer' && selectedTeam.id !== user.maintainer_team_id ? '当前账号无法查看该团队成员。' : '暂无团队成员。'}</EmptyState> }} /></section></> : <EmptyState>暂无团队。 </EmptyState>}
          </div>
        </section>
      </div>
      <TeamEditorDrawer editor={teamEditor} onClose={() => setTeamEditor(null)} onSubmit={saveTeam} submitting={submitting} />
      <MemberEditorDrawer editor={memberEditor} teams={refs.teams} onClose={() => setMemberEditor(null)} onSubmit={saveMember} submitting={submitting} />
    </div>
  )
}

function ProductEditorDrawer({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <FocusRestoringDrawer title={editor?.id ? '编辑产品' : '新增产品'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存产品</AntButton></Space>}><AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}><AntForm.Item name="team_id" label="所属团队" rules={[{ required: true, message: '请选择团队' }]}><Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} /></AntForm.Item><AntForm.Item name="name" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}><Input /></AntForm.Item></AntForm></FocusRestoringDrawer>
}

function VersionEditorDrawer({ editor, products, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <FocusRestoringDrawer title={editor?.id ? '编辑产品版本' : '新增产品版本'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存版本</AntButton></Space>}><AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}><AntForm.Item name="product_id" label="所属产品" rules={[{ required: true, message: '请选择产品' }]}><Select options={products.map((product) => ({ value: String(product.id), label: `${product.team_name} / ${product.name}` }))} /></AntForm.Item><AntForm.Item name="name" label="版本名称" rules={[{ required: true, message: '请输入版本名称' }]}><Input placeholder="SCC 27.1.RC1" /></AntForm.Item></AntForm></FocusRestoringDrawer>
}

function IterationEditorDrawer({ editor, versions, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <FocusRestoringDrawer title={editor?.id ? '编辑开发迭代期' : '新增开发迭代期'} open={Boolean(editor)} size={480} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存迭代</AntButton></Space>}><AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}><AntForm.Item name="version_id" label="所属版本" rules={[{ required: true, message: '请选择版本' }]}><Select options={versions.map((version) => ({ value: String(version.id), label: `${version.product_name} / ${version.name}` }))} /></AntForm.Item><AntForm.Item name="name" label="迭代名称" rules={[{ required: true, message: '请输入迭代名称' }]}><Input /></AntForm.Item><Space.Compact block><AntForm.Item className="workbench-compact-item" name="start_date" label="开始日期" rules={[{ required: true, message: '请选择开始日期' }]}><Input type="date" /></AntForm.Item><AntForm.Item className="workbench-compact-item" name="end_date" label="结束日期" rules={[{ required: true, message: '请选择结束日期' }]}><Input type="date" /></AntForm.Item></Space.Compact></AntForm></FocusRestoringDrawer>
}

function ProductManagement({ user, refs, onRefresh, onSessionExpired }) {
  const canEdit = user.role === 'admin'
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [productEditor, setProductEditor] = useState(null)
  const [versionEditor, setVersionEditor] = useState(null)
  const [iterationEditor, setIterationEditor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedProductId || !refs.products.some((product) => product.id === selectedProductId)) setSelectedProductId(refs.products[0]?.id ?? null)
  }, [refs.products, selectedProductId])

  const selectedProduct = refs.products.find((product) => product.id === selectedProductId)
  const versions = refs.versions.filter((version) => version.product_id === selectedProductId)
  const allVersions = refs.versions.filter((version) => version.product_id)

  async function save(url, method, body, success, close) {
    setSubmitting(true)
    try { await fetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); close(); setNotice({ type: 'success', text: success }); await onRefresh() } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setSubmitting(false) }
  }

  async function remove(url, label) {
    await save(url, 'DELETE', undefined, `${label}已删除。`, () => undefined)
  }

  const productColumns = [
    { title: '产品', dataIndex: 'name', width: 160, render: (name, product) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text type="secondary">{product.team_name}</Text></Space> },
    { title: '版本', width: 56, align: 'right', render: (_, product) => product.versions?.length ?? 0 },
    { title: '选择', key: 'action', width: 72, render: (_, product) => <AntButton type="link" size="small" aria-label={`查看产品 ${product.name}`} aria-pressed={product.id === selectedProductId} onClick={() => setSelectedProductId(product.id)}>查看</AntButton> },
  ]
  const versionColumns = [
    { title: '版本', dataIndex: 'name', width: 180, render: (name, version) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text type="secondary">{version.iterations?.length ?? 0} 个迭代</Text></Space> },
    { title: '开发迭代期', width: 360, render: (_, version) => <Space wrap>{(version.iterations ?? []).map((iteration) => <span className="settings-iteration" key={iteration.id}><span>{iteration.name}</span>{canEdit && <><AntButton type="link" size="small" aria-label={`编辑迭代 ${iteration.name}`} icon={<EditOutlined />} onClick={() => setIterationEditor({ id: iteration.id, version_id: String(version.id), name: iteration.name, start_date: iteration.start_date, end_date: iteration.end_date })} /><Popconfirm okText="删除" cancelText="取消" title={`确定删除迭代“${iteration.name}”？`} description="被 IR 数据引用时无法删除；成功删除后无法恢复。" onConfirm={() => remove(`/api/iterations/${iteration.id}`, `迭代“${iteration.name}”`)}><AntButton type="link" danger size="small" aria-label={`删除迭代 ${iteration.name}`} icon={<DeleteOutlined />} /></Popconfirm></>}</span>)}</Space> },
    { title: '操作', key: 'action', fixed: 'right', width: 220, render: (_, version) => canEdit && <Space size={0}><AntButton type="link" size="small" aria-label={`为版本 ${version.name} 新增迭代`} icon={<PlusOutlined />} onClick={() => setIterationEditor({ id: null, version_id: String(version.id), name: '', start_date: '', end_date: '' })}>新增迭代</AntButton><AntButton type="link" size="small" aria-label={`编辑版本 ${version.name}`} icon={<EditOutlined />} onClick={() => setVersionEditor({ id: version.id, product_id: String(version.product_id), name: version.name })}>编辑</AntButton><Popconfirm okText="删除" cancelText="取消" title={`确定删除版本“${version.name}”？`} description="有迭代或 IR 数据引用时无法删除；成功删除后无法恢复。" onConfirm={() => remove(`/api/versions/${version.id}`, `版本“${version.name}”`)}><AntButton type="link" danger size="small" aria-label={`删除版本 ${version.name}`} icon={<DeleteOutlined />}>删除</AntButton></Popconfirm></Space> },
  ]

  return (
    <div className="workbench-page">
      <PageIntro title="产品与版本" description="产品属于团队，版本属于产品，开发迭代期属于版本。" action={canEdit && <AntButton type="primary" icon={<PlusOutlined />} onClick={() => setProductEditor({ id: null, team_id: '', name: '' })}>新增产品</AntButton>} />
      <Notice notice={notice} />
      {!canEdit && <ReadOnlyHint />}
      <div className="settings-master-detail">
        <section className="settings-workspace" aria-label="产品列表">
          <div className="settings-workspace__header"><h2 className="settings-workspace__title">产品</h2><span className="settings-workspace__count">{refs.products.length} 个</span></div>
          <Table className="operational-table" rowKey="id" size="small" loading={refs.loading} columns={productColumns} dataSource={refs.products} pagination={false} scroll={{ x: 288 }} rowClassName={(record) => record.id === selectedProductId ? 'is-selected' : ''} locale={{ emptyText: <EmptyState>暂无产品。</EmptyState> }} />
        </section>
        <section className="settings-workspace" aria-label="产品版本与迭代详情">
          <div className="settings-workspace__header"><h2 className="settings-workspace__title">{selectedProduct ? `${selectedProduct.name} · 层级详情` : '产品详情'}</h2>{canEdit && selectedProduct && <Space wrap size={0}><AntButton size="small" icon={<EditOutlined />} aria-label={`编辑产品 ${selectedProduct.name}`} onClick={() => setProductEditor({ id: selectedProduct.id, team_id: String(selectedProduct.team_id), name: selectedProduct.name })}>编辑产品</AntButton><Popconfirm okText="删除" cancelText="取消" title={`确定删除产品“${selectedProduct.name}”？`} description="仅未被版本或 IR 数据引用的产品可删除；删除成功后无法恢复。" onConfirm={() => remove(`/api/products/${selectedProduct.id}`, `产品“${selectedProduct.name}”`)}><AntButton danger size="small" aria-label={`删除产品 ${selectedProduct.name}`}>删除产品</AntButton></Popconfirm><AntButton size="small" icon={<PlusOutlined />} onClick={() => setVersionEditor({ id: null, product_id: String(selectedProduct.id), name: '' })}>新增版本</AntButton></Space>}</div>
          <div className="settings-workspace__body">{selectedProduct ? <><Descriptions size="small" column={2} items={[{ key: 'team', label: '所属团队', children: selectedProduct.team_name }, { key: 'versions', label: '版本数量', children: versions.length }]} /><section className="settings-section"><div className="settings-section__header"><h3 className="settings-section__title">版本与开发迭代期</h3></div><Table className="operational-table" rowKey="id" size="small" loading={refs.loading} columns={versionColumns} dataSource={versions} pagination={false} scroll={{ x: 760 }} locale={{ emptyText: <EmptyState>暂无产品版本。</EmptyState> }} /></section></> : <EmptyState>暂无产品。</EmptyState>}</div>
        </section>
      </div>
      <ProductEditorDrawer editor={productEditor} teams={refs.teams} onClose={() => setProductEditor(null)} onSubmit={(values) => save(productEditor.id ? `/api/products/${productEditor.id}` : '/api/products', productEditor.id ? 'PATCH' : 'POST', { team_id: Number(values.team_id), name: values.name.trim() }, productEditor.id ? '产品已更新。' : '产品已创建。', () => setProductEditor(null))} submitting={submitting} />
      <VersionEditorDrawer editor={versionEditor} products={refs.products} onClose={() => setVersionEditor(null)} onSubmit={(values) => save(versionEditor.id ? `/api/versions/${versionEditor.id}` : '/api/versions', versionEditor.id ? 'PATCH' : 'POST', { product_id: Number(values.product_id), name: values.name.trim() }, versionEditor.id ? '产品版本已更新。' : '产品版本已创建。', () => setVersionEditor(null))} submitting={submitting} />
      <IterationEditorDrawer editor={iterationEditor} versions={allVersions} onClose={() => setIterationEditor(null)} onSubmit={(values) => save(iterationEditor.id ? `/api/iterations/${iterationEditor.id}` : '/api/iterations', iterationEditor.id ? 'PATCH' : 'POST', { version_id: Number(values.version_id), name: values.name.trim(), start_date: values.start_date, end_date: values.end_date }, iterationEditor.id ? '开发迭代期已更新。' : '开发迭代期已创建。', () => setIterationEditor(null))} submitting={submitting} />
    </div>
  )
}

function IRRecordDrawer({ editor, refs, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  const productId = AntForm.useWatch('product_id', form)
  const versionId = AntForm.useWatch('version_id', form)
  const versions = refs.versions.filter((version) => version.product_id === Number(productId))
  const selectedVersion = refs.versions.find((version) => String(version.id) === String(versionId))
  useEffect(() => { if (editor) form.setFieldsValue(editor.form) }, [editor, form])
  return (
    <FocusRestoringDrawer title={editor?.record ? '编辑 IR 需求' : '新增 IR 需求'} open={Boolean(editor)} size={760} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存需求</AntButton></Space>}>
      <AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}>
        <Divider titlePlacement="left" plain>基础信息</Divider>
        <div className="workbench-form-grid two">
          <AntForm.Item name="requirement_no" label="需求编号" rules={[{ required: true, message: '请输入需求编号' }]}><Input disabled={Boolean(editor?.record)} /></AntForm.Item>
          <AntForm.Item name="requirement_name" label="需求名称" rules={[{ required: true, message: '请输入需求名称' }]}><Input /></AntForm.Item>
          <AntForm.Item name="responsible_employee_id" label="责任人工号"><Input /></AntForm.Item>
          <AntForm.Item name="parent_requirement_no" label="父需求编号"><Input /></AntForm.Item>
        </div>
        <Divider titlePlacement="left" plain>归属</Divider>
        <div className="workbench-form-grid two">
          <AntForm.Item name="product_id" label="产品" rules={[{ required: true, message: '请选择产品' }]}><Select onChange={() => form.setFieldsValue({ version_id: '', iteration_id: '' })} options={refs.products.map((product) => ({ value: String(product.id), label: `${product.team_name} / ${product.name}` }))} /></AntForm.Item>
          <AntForm.Item name="version_id" label="版本" rules={[{ required: true, message: '请选择版本' }]}><Select onChange={() => form.setFieldsValue({ iteration_id: '' })} options={versions.map((version) => ({ value: String(version.id), label: version.name }))} /></AntForm.Item>
          <AntForm.Item name="iteration_id" label="迭代" rules={[{ required: true, message: '请选择迭代' }]}><Select options={(selectedVersion?.iterations ?? []).map((iteration) => ({ value: String(iteration.id), label: iteration.name }))} /></AntForm.Item>
        </div>
        <Divider titlePlacement="left" plain>业务信息</Divider>
        <div className="workbench-form-grid two">
          <AntForm.Item name="completed_at" label="完成时间" rules={[{ required: true, message: '请选择完成时间' }]}><Input type="date" /></AntForm.Item>
          <AntForm.Item name="business_module" label="业务模块" rules={[{ required: true, message: '请输入业务模块' }]}><Input /></AntForm.Item>
        </div>
        <AntForm.Item name="requirement_scenario" label="需求场景" rules={[{ required: true, message: '请输入需求场景' }]}><Input /></AntForm.Item>
        <Divider titlePlacement="left" plain>工作量</Divider>
        <div className="workbench-form-grid three">
          <AntForm.Item name="estimated_workload" label="总预估（人天）"><InputNumber min={0} step="any" style={{ width: '100%' }} /></AntForm.Item>
          <AntForm.Item name="actual_workload" label="总实际（人天）"><InputNumber min={0} step="any" style={{ width: '100%' }} /></AntForm.Item>
          <AntForm.Item name="sa_estimated_workload" label="SA 预估"><InputNumber min={0} step="any" style={{ width: '100%' }} /></AntForm.Item>
          <AntForm.Item name="sa_actual_workload" label="SA 实际"><InputNumber min={0} step="any" style={{ width: '100%' }} /></AntForm.Item>
          <AntForm.Item name="se_estimated_workload" label="SE 预估"><InputNumber min={0} step="any" style={{ width: '100%' }} /></AntForm.Item>
          <AntForm.Item name="se_actual_workload" label="SE 实际"><InputNumber min={0} step="any" style={{ width: '100%' }} /></AntForm.Item>
        </div>
        <Divider titlePlacement="left" plain>AI 属性</Divider>
        <AntForm.Item name="ai_assisted" label="是否使用 AI"><Select options={[{ value: '', label: '待维护' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]} /></AntForm.Item>
      </AntForm>
    </FocusRestoringDrawer>
  )
}

function ImportPreviewDrawer({ batch, teamName, onClose, onConfirm, submitting }) {
  const collectorBatch = batch.source_kind === 'collector'
  const rows = batch.rows ?? []
  const warningCount = rows.reduce((count, row) => count + (row.warnings?.length ?? 0), 0)
  const details = [
    { key: 'source', label: '来源', children: collectorBatch ? '平台采集' : 'CSV / Excel 导入' },
    ...(collectorBatch
      ? [{ key: 'team', label: '团队', children: teamName ?? `团队 #${batch.team_id}` }]
      : [{ key: 'file', label: '文件', children: batch.filename ?? '数据文件' }]),
    { key: 'created', label: '生成时间', children: batch.created_at ? <time dateTime={batch.created_at}>{formatTableTimestamp(batch.created_at)}</time> : '—' },
    { key: 'status', label: '批次状态', children: <StatusTag tone={batch.status === 'pending' ? 'pending' : 'neutral'}>{batch.status === 'pending' ? '待确认' : '已确认'}</StatusTag> },
  ]
  const columns = [
    { title: '行', dataIndex: 'row_number', width: 60 },
    { title: '记录 ID', dataIndex: 'source_id', render: (value) => <Text code>{value ?? '—'}</Text> },
    { title: '来源系统', dataIndex: 'source_system', render: (value) => value ?? '—' },
    { title: '动作', dataIndex: 'operation', render: (value) => <StatusTag>{value === 'insert' ? '新增' : value === 'fill' ? '补充空值' : '无变化'}</StatusTag> },
    { title: '差异', dataIndex: 'diff', render: (diff = {}) => <Space orientation="vertical" size={0}>{Object.entries(diff).filter(([, value]) => value.action !== 'unchanged').slice(0, 5).map(([field, value]) => <Text key={field} type={value.action === 'keep' ? 'secondary' : undefined}>{field}：{value.action === 'keep' ? '保留正式值' : `→ ${String(value.to)}`}</Text>)}</Space> },
    { title: '校验', key: 'validation', render: (_, row) => <Space orientation="vertical" size={0}>{row.errors?.map((error) => <Text key={error} type="danger">{error}</Text>)}{row.warnings?.map((warning) => <Text key={warning} type="warning">{warning}</Text>)}{!row.errors?.length && !row.warnings?.length && <StatusTag tone="success">通过</StatusTag>}</Space> },
  ]
  return (
    <FocusRestoringDrawer
      title={collectorBatch ? `采集批次预览 · ${teamName ?? `团队 #${batch.team_id}`}` : `导入预览 · ${batch.filename ?? '数据文件'}`}
      open
      size={1080}
      onClose={onClose}
      destroyOnClose
      footer={<Space><AntButton onClick={onClose}>关闭</AntButton><AntButton type="primary" disabled={batch.invalid_rows > 0 || batch.status !== 'pending'} loading={submitting} onClick={onConfirm}>{batch.invalid_rows ? '存在错误，不能确认' : batch.status !== 'pending' ? '批次已确认' : collectorBatch ? '确认采集批次' : '确认写入正式数据'}</AntButton></Space>}
    >
      <Steps current={1} size="small" items={[{ title: collectorBatch ? '采集' : '上传' }, { title: '预览与校验' }, { title: '整批确认' }]} />
      <Descriptions size="small" column={2} items={details} />
      <div className="workbench-import-summary" role="group" aria-label="批次校验统计">
        <StatusTag>总行数 {batch.total_rows}</StatusTag>
        <StatusTag tone="success">可确认 {batch.valid_rows}</StatusTag>
        <StatusTag tone={batch.invalid_rows ? 'error' : 'neutral'}>错误行 {batch.invalid_rows}</StatusTag>
        {warningCount > 0 && <StatusTag tone="warning">警告项 {warningCount}</StatusTag>}
      </div>
      <div className="operational-inline-state" role="status"><StatusTag tone="pending">临时数据</StatusTag><Text type="secondary">尚未进入正式 IR；整批确认后才写入。</Text></div>
      {batch.invalid_rows
        ? <Alert type="error" showIcon message="存在错误行，整批数据不能确认。请查看对应行的字段错误。" />
        : <div className="operational-inline-state" role="status"><StatusTag tone="success">校验通过</StatusTag><Text type="secondary">已有正式记录中的非空字段会保留。</Text></div>}
      <Table className="operational-table workbench-import-table" rowKey="row_number" size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 900, y: 420 }} />
    </FocusRestoringDrawer>
  )
}

function IRManagement({ user, refs, onRefresh, onSessionExpired }) {
  const canEdit = user.role === 'admin' || user.role === 'maintainer'
  const initialFilters = useMemo(() => ({ team_id: user.role === 'maintainer' ? String(user.maintainer_team_id) : '', product_id: '', version_id: '', iteration_id: '', requirement_no: '', responsible_employee_id: '', business_module: '', requirement_scenario: '', completed_from: '', completed_to: '', ai_assisted: '', page: 1, page_size: 50 }), [user.maintainer_team_id, user.role])
  const [filters, setFilters] = useState(initialFilters)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [editor, setEditor] = useState(null)
  const [importBatch, setImportBatch] = useState(null)
  const [collectorBatches, setCollectorBatches] = useState([])
  const [collectorBatchesLoading, setCollectorBatchesLoading] = useState(false)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const availableProducts = useMemo(() => refs.products.filter((product) => !filters.team_id || product.team_id === Number(filters.team_id)), [refs.products, filters.team_id])
  const availableProductIds = useMemo(() => new Set(availableProducts.map((product) => product.id)), [availableProducts])
  const availableVersions = useMemo(() => refs.versions.filter((version) => version.product_id && availableProductIds.has(version.product_id) && (!filters.product_id || version.product_id === Number(filters.product_id))), [refs.versions, availableProductIds, filters.product_id])
  const selectedVersion = refs.versions.find((version) => String(version.id) === String(filters.version_id))
  const availableIterations = selectedVersion?.iterations ?? []
  const advancedFilterCount = [filters.responsible_employee_id, filters.business_module, filters.requirement_scenario, filters.completed_from, filters.completed_to, filters.ai_assisted].filter(Boolean).length

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    try { setData(await fetchJson(`/api/data/ir?${buildIrQuery(filters).toString()}`)); if (clearNotice) setNotice(null) } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setLoading(false) }
  }, [filters, onSessionExpired])
  useEffect(() => { load() }, [load])

  const loadCollectorBatches = useCallback(async () => {
    if (!canEdit) return
    setCollectorBatchesLoading(true)
    try {
      setCollectorBatches(await fetchJson('/api/data/ir/imports?source_kind=collector&status=pending'))
    } catch (error) {
      setNotice({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally {
      setCollectorBatchesLoading(false)
    }
  }, [canEdit, onSessionExpired])
  useEffect(() => { loadCollectorBatches() }, [loadCollectorBatches])

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value, ...(field === 'team_id' ? { product_id: '', version_id: '', iteration_id: '' } : {}), ...(field === 'product_id' ? { version_id: '', iteration_id: '' } : {}), ...(field === 'version_id' ? { iteration_id: '' } : {}), page: 1 }))
  }

  async function saveRecord(values) {
    setBusy(true)
    try {
      const payload = irFormPayload(values)
      const editing = Boolean(editor.record?.id)
      await fetchJson(editing ? `/api/data/ir/${editor.record.id}` : '/api/data/ir', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setEditor(null); setNotice({ type: 'success', text: editing ? 'IR 需求已更新。' : 'IR 需求已创建。' }); await load({ clearNotice: false })
    } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setBusy(false) }
  }

  async function previewFile(file) {
    setBusy(true)
    try { const batch = await fetchJson('/api/data/ir/imports/preview', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': file.name }, body: await file.arrayBuffer() }); setImportBatch(batch); setNotice({ type: 'success', text: `已生成导入预览：${batch.valid_rows} 行可确认，${batch.invalid_rows} 行有错误。` }) } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setBusy(false) }
  }

  async function confirmImport() {
    if (!importBatch) return
    const wasCollectorBatch = importBatch.source_kind === 'collector'
    setBusy(true)
    try { const result = await fetchJson(`/api/data/ir/imports/${importBatch.id}/confirm`, { method: 'POST' }); setImportBatch(null); setNotice({ type: 'success', text: `${wasCollectorBatch ? '采集' : '导入'}批次已确认：新增 ${result.created} 条，补充 ${result.updated} 条，未变化 ${result.unchanged} 条。` }); await load({ clearNotice: false }); if (wasCollectorBatch) await loadCollectorBatches() } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setBusy(false) }
  }

  async function openCollectorBatch(summary) {
    setBusy(true)
    try {
      setImportBatch(await fetchJson(`/api/data/ir/imports/${summary.id}`))
    } catch (error) {
      setNotice({ type: 'error', text: dataManagementErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally { setBusy(false) }
  }

  const columns = [
    { title: '需求', key: 'requirement', fixed: 'left', width: 220, render: (_, record) => <Space orientation="vertical" size={0}><Text strong className="operational-table__primary">{record.requirement_no}</Text><Text type="secondary" title={record.requirement_name} className="operational-table__meta">{record.requirement_name}</Text></Space> },
    { title: '归属', key: 'ownership', width: 230, render: (_, record) => <Space orientation="vertical" size={0}><Text className="operational-table__primary">{record.team_name}</Text><Text type="secondary" title={`${record.product_name} / ${record.version_name} / ${record.iteration_name}`} className="operational-table__meta">{record.product_name} / {record.version_name} / {record.iteration_name}</Text></Space> },
    { title: '责任人', key: 'owner', width: 130, render: (_, record) => <Space>{record.responsible_employee_id ? <Text className="operational-table__id">{record.responsible_employee_id}</Text> : <Text type="secondary">—</Text>}{record.responsible_employee_pending && <StatusTag tone="warning">待匹配</StatusTag>}</Space> },
    { title: '完成时间', dataIndex: 'completed_at', className: 'operational-cell--date', width: 120 },
    { title: '模块 / 场景', key: 'scenario', width: 180, render: (_, record) => <Space orientation="vertical" size={0}><Text>{record.business_module}</Text><Text type="secondary" title={record.requirement_scenario} className="operational-table__meta">{record.requirement_scenario}</Text></Space> },
    { title: 'AI 属性', dataIndex: 'ai_assisted', width: 100, render: (value) => <StatusTag tone={value === true || value === false ? 'neutral' : 'pending'}>{value === true ? '是' : value === false ? '否' : '待维护'}</StatusTag> },
    { title: '工作量（预估 / 实际，人天）', key: 'workload', align: 'right', className: 'operational-cell--numeric', width: 240, render: (_, record) => <Space orientation="vertical" size={0}><Text className="operational-table__primary">总计 {record.estimated_workload ?? '—'} / {record.actual_workload ?? '—'}</Text><Text type="secondary" className="operational-table__meta">SA {record.sa_estimated_workload ?? '—'} / {record.sa_actual_workload ?? '—'} · SE {record.se_estimated_workload ?? '—'} / {record.se_actual_workload ?? '—'}</Text></Space> },
    { title: '来源', key: 'source', width: 100, render: (_, record) => <Space orientation="vertical" size={0}><StatusTag>{RECORD_SOURCE_LABELS[record.record_source] ?? record.record_source}</StatusTag><Text type="secondary" className="operational-table__meta">{record.updated_by}</Text></Space> },
    { title: '操作', key: 'action', fixed: 'right', width: 90, render: (_, record) => canEdit && <AntButton type="text" size="small" icon={<EditOutlined />} onClick={() => setEditor({ record, form: irFormFromRecord(record) })}>编辑</AntButton> },
  ]
  const collectorBatchColumns = [
    { title: '来源', render: () => <StatusTag>平台采集</StatusTag> },
    { title: '团队', dataIndex: 'team_id', render: (teamId) => refs.teams.find((team) => team.id === teamId)?.name ?? `团队 #${teamId}` },
    { title: '生成时间', dataIndex: 'created_at', className: 'operational-cell--date', render: (value) => <time dateTime={value}>{formatTableTimestamp(value)}</time> },
    { title: '数据行', className: 'operational-cell--numeric', align: 'right', render: (_, batch) => `${batch.valid_rows} 有效 / ${batch.total_rows} 总计 · ${batch.invalid_rows} 错误` },
    { title: '操作', key: 'action', render: (_, batch) => <AntButton type="text" size="small" loading={busy} onClick={() => openCollectorBatch(batch)}>查看批次</AntButton> },
  ]

  return (
    <div className="workbench-page">
      <PageIntro title="IR 需求数据" description="管理正式 IR 数据、采集待确认批次和人工导入。" action={canEdit ? <><Upload accept=".csv,.xlsx" showUploadList={false} beforeUpload={(file) => { previewFile(file); return false }}><AntButton icon={<UploadOutlined />} loading={busy}>导入</AntButton></Upload><AntButton type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ record: null, form: { ...EMPTY_IR_FORM, product_id: availableProducts[0]?.id ? String(availableProducts[0].id) : '' } })}>新增 IR</AntButton></> : <StatusTag tone="readonly">只读</StatusTag>} />
      <Notice notice={notice} />
      <FilterToolbar
        className="operational-filter-toolbar"
        label={null}
        actions={<>
          <AntButton type="text" size="small" aria-expanded={advancedFiltersOpen} aria-controls={advancedFiltersOpen ? 'ir-advanced-filters' : undefined} onClick={() => setAdvancedFiltersOpen((open) => !open)}>
            {advancedFiltersOpen ? '收起高级筛选' : '高级筛选'}
            {advancedFilterCount > 0 && <span className="operational-filter-count" aria-label={`${advancedFilterCount} 项高级筛选已启用`}>{advancedFilterCount}</span>}
          </AntButton>
          <AntButton type="text" size="small" icon={<ReloadOutlined />} onClick={() => setFilters(initialFilters)}>重置</AntButton>
        </>}
      >
        <div className="operational-filter-fields">
          <SelectField className="operational-filter-control" label="团队" value={filters.team_id} disabled={user.role === 'maintainer'} helper={user.role === 'maintainer' ? '按账号绑定团队筛选' : undefined} onChange={(value) => updateFilter('team_id', value)} options={refs.teams.map((team) => [team.id, team.name])} />
          <SelectField className="operational-filter-control" label="产品" value={filters.product_id} onChange={(value) => updateFilter('product_id', value)} options={availableProducts.map((product) => [product.id, product.name])} />
          <SelectField className="operational-filter-control" label="版本" value={filters.version_id} onChange={(value) => updateFilter('version_id', value)} options={availableVersions.map((version) => [version.id, version.name])} />
          <SelectField className="operational-filter-control" label="迭代" value={filters.iteration_id} onChange={(value) => updateFilter('iteration_id', value)} options={availableIterations.map((iteration) => [iteration.id, iteration.name])} />
          <InputField className="operational-filter-control" label="需求编号" value={filters.requirement_no} onChange={(value) => updateFilter('requirement_no', value)} />
        </div>
        {advancedFiltersOpen && <div id="ir-advanced-filters" className="operational-filter-fields operational-filter-fields--advanced">
          <InputField className="operational-filter-control" label="责任人工号" value={filters.responsible_employee_id} onChange={(value) => updateFilter('responsible_employee_id', value)} />
          <InputField className="operational-filter-control" label="业务模块" value={filters.business_module} onChange={(value) => updateFilter('business_module', value)} />
          <InputField className="operational-filter-control" label="需求场景" value={filters.requirement_scenario} onChange={(value) => updateFilter('requirement_scenario', value)} />
          <InputField className="operational-filter-control" label="完成时间起" type="date" value={filters.completed_from} onChange={(value) => updateFilter('completed_from', value)} />
          <InputField className="operational-filter-control" label="完成时间止" type="date" value={filters.completed_to} onChange={(value) => updateFilter('completed_to', value)} />
          <SelectField className="operational-filter-control" label="AI 辅助" value={filters.ai_assisted} onChange={(value) => updateFilter('ai_assisted', value)} options={[['true', '是'], ['false', '否']]} />
        </div>}
      </FilterToolbar>
      {canEdit && (collectorBatchesLoading || collectorBatches.length > 0) && <section className="operational-compact-section" aria-label="待确认采集批次">
        <div className="operational-compact-section__heading"><h2 className="operational-compact-section__title">待确认采集批次</h2><span className="operational-compact-section__count">{collectorBatchesLoading ? '加载中…' : `${collectorBatches.length} 个`}</span></div>
        {collectorBatchesLoading
          ? <div className="operational-inline-state"><Spin size="small" /><Text type="secondary">读取待确认批次…</Text></div>
          : <Table className="operational-table" rowKey="id" size="small" columns={collectorBatchColumns} dataSource={collectorBatches} pagination={false} scroll={{ x: 720 }} />}
      </section>}
      <section className="operational-workspace" aria-labelledby="ir-data-heading">
        <div className="operational-workspace__header"><h2 id="ir-data-heading" className="operational-workspace__title">IR 正式数据</h2><span className="operational-workspace__count">共 {data.total} 条</span></div>
        <Table className="operational-table" rowKey="id" size="small" sticky={{ offsetHeader: STICKY_HEADER_OFFSET }} columns={columns} dataSource={data.items} loading={loading} scroll={{ x: 1500 }} pagination={{ current: filters.page, pageSize: filters.page_size, total: data.total, showSizeChanger: false, onChange: (page) => setFilters((current) => ({ ...current, page })) }} locale={{ emptyText: <EmptyState>当前筛选条件下没有 IR 正式数据。</EmptyState> }} />
      </section>
      <IRRecordDrawer editor={editor} refs={refs} onClose={() => setEditor(null)} onSubmit={saveRecord} submitting={busy} />
      {importBatch && <ImportPreviewDrawer batch={importBatch} teamName={refs.teams.find((team) => team.id === importBatch.team_id)?.name} onClose={() => setImportBatch(null)} onConfirm={confirmImport} submitting={busy} />}
    </div>
  )
}

function RequirementManagement({ requirementType, onRequirementTypeChange, ...props }) {
  const activeType = ['ir', 'ar', 'sr'].includes(requirementType) ? requirementType : 'ir'
  const pending = (type) => <div className="workbench-page"><PageIntro title={`${type} 需求`} description="当前只有 IR 需求具备字段、校验、导入和指标口径。" /><section className="operational-state" role="status"><StatusTag tone="pending">规格待定义</StatusTag><span className="operational-state__message">暂不提供 {type} 需求表单。</span></section></div>
  return <Tabs activeKey={activeType} onChange={onRequirementTypeChange} items={[
    { key: 'ir', label: 'IR', children: <IRManagement {...props} /> },
    { key: 'ar', label: 'AR', children: pending('AR') },
    { key: 'sr', label: 'SR', children: pending('SR') },
  ]} />
}

function ActivityEditorDrawer({ editor, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <FocusRestoringDrawer title={editor?.id ? '编辑研发活动' : '新增研发活动'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存活动</AntButton></Space>}><AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}><AntForm.Item name="code" label="活动代码" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: '使用小写字母、数字和短横线' }]}><Input /></AntForm.Item><AntForm.Item name="name" label="活动名称" rules={[{ required: true, message: '请输入活动名称' }]}><Input /></AntForm.Item><AntForm.Item name="kind" label="活动类别" rules={[{ required: true }]}><Select options={ACTIVITY_KINDS} /></AntForm.Item></AntForm></FocusRestoringDrawer>
}

function DashboardMetricEditorDrawer({ editor, catalog, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <FocusRestoringDrawer title={editor?.id ? '编辑看板指标' : '新增看板指标'} open={Boolean(editor)} size={520} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存指标</AntButton></Space>}><AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}><AntForm.Item name="activity_id" label="所属活动" rules={[{ required: true, message: '请选择活动' }]}><Select options={catalog.map((activity) => ({ value: String(activity.id), label: activity.name }))} /></AntForm.Item><AntForm.Item name="code" label="指标代码" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: '使用小写字母、数字和短横线' }]}><Input /></AntForm.Item><AntForm.Item name="name" label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}><Input /></AntForm.Item><AntForm.Item name="type" label="指标类型" rules={[{ required: true }]}><Select options={DASHBOARD_METRIC_TYPES} /></AntForm.Item><AntForm.Item name="numerator_semantic" label="分子语义" rules={[{ required: true, message: '请输入分子语义' }]}><Input /></AntForm.Item><AntForm.Item name="denominator_semantic" label="分母语义"><Input /></AntForm.Item><Alert type="info" showIcon message="首期所有指标采集方式为仅补录。" /></AntForm></FocusRestoringDrawer>
}

function DashboardCatalogTab({ user, catalog, loading, onReload, onSessionExpired }) {
  const canEdit = user.role === 'admin'
  const [selectedActivityId, setSelectedActivityId] = useState(null)
  const [activityEditor, setActivityEditor] = useState(null)
  const [metricEditor, setMetricEditor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!selectedActivityId || !catalog.some((activity) => activity.id === selectedActivityId)) setSelectedActivityId(catalog[0]?.id ?? null)
  }, [catalog, selectedActivityId])

  async function save(url, method, body, success, close) {
    setSubmitting(true)
    try { await fetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); close(); setNotice({ type: 'success', text: success }); await onReload() } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setSubmitting(false) }
  }
  async function remove(url, label) { await save(url, 'DELETE', undefined, `${label}已删除。`, () => undefined) }

  const selectedActivity = catalog.find((activity) => activity.id === selectedActivityId)
  const columns = [
    { title: '活动', dataIndex: 'name', render: (name, activity) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text type="secondary">{activity.kind === 'key' ? '关键研发活动' : '通用研发能力'}</Text></Space> },
    { title: '指标', width: 56, align: 'right', render: (_, activity) => activity.metrics.length },
    { title: '操作', key: 'action', fixed: 'right', width: canEdit ? 174 : 76, render: (_, activity) => <Space size={0}><AntButton type="link" size="small" aria-pressed={activity.id === selectedActivityId} aria-label={`查看活动 ${activity.name} 的指标`} onClick={() => setSelectedActivityId(activity.id)}>查看</AntButton>{canEdit && <><AntButton type="link" size="small" aria-label={`编辑活动 ${activity.name}`} icon={<EditOutlined />} onClick={() => setActivityEditor({ id: activity.id, code: activity.code, name: activity.name, kind: activity.kind })} /><Popconfirm okText="删除" cancelText="取消" title={`确定删除活动“${activity.name}”？`} description="仍包含指标或事实记录的活动不能删除；成功删除后无法恢复。" onConfirm={() => remove(`/api/activities/${activity.id}`, `活动“${activity.name}”`)}><AntButton type="link" danger size="small" aria-label={`删除活动 ${activity.name}`} icon={<DeleteOutlined />} /></Popconfirm></>}</Space> },
  ]
  const metrics = (selectedActivity?.metrics ?? []).map((metric) => ({ ...metric, activity_name: selectedActivity.name }))
  const metricColumns = [
    { title: '指标', dataIndex: 'name', render: (name, metric) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text code>{metric.code}</Text></Space> },
    { title: '所属活动', dataIndex: 'activity_name' },
    { title: '类型', dataIndex: 'type', render: (type) => metricValueLabel(type) },
    { title: '分子 / 分母', key: 'semantics', render: (_, metric) => `${metric.numerator_semantic} / ${metric.denominator_semantic ?? '—'}` },
    { title: '操作', key: 'action', fixed: 'right', width: 150, render: (_, metric) => canEdit && <Space size={0}><AntButton type="link" size="small" aria-label={`编辑看板指标 ${metric.name}`} icon={<EditOutlined />} onClick={() => setMetricEditor({ ...metric, activity_id: String(metric.activity_id), denominator_semantic: metric.denominator_semantic ?? '', collect_method: metric.collect_method ?? 'manual_only' })}>编辑</AntButton><Popconfirm okText="删除" cancelText="取消" title={`确定删除指标“${metric.name}”？`} description="成功删除后无法恢复。" onConfirm={() => remove(`/api/metrics/${metric.id}`, `指标“${metric.name}”`)}><AntButton type="link" danger size="small" aria-label={`删除看板指标 ${metric.name}`} icon={<DeleteOutlined />}>删除</AntButton></Popconfirm></Space> },
  ]

  return <div className="workbench-page"><div className="workbench-toolbar"><Space><Text strong>看板目录</Text><Text type="secondary">活动与指标是看板计算目录，不等同于源数据指标规则。</Text></Space><Space wrap>{canEdit && <AntButton type="primary" icon={<PlusOutlined />} onClick={() => setActivityEditor({ id: null, code: '', name: '', kind: 'general' })}>新增活动</AntButton>}{canEdit && <AntButton icon={<PlusOutlined />} onClick={() => setMetricEditor({ id: null, activity_id: selectedActivity ? String(selectedActivity.id) : '', code: '', name: '', type: 'penetration', numerator_semantic: '', denominator_semantic: '', collect_method: 'manual_only' })}>新增指标</AntButton>}</Space></div><Notice notice={notice} /><div className="settings-master-detail">
    <section className="settings-workspace" aria-label="研发活动目录"><div className="settings-workspace__header"><h2 className="settings-workspace__title">研发活动</h2><span className="settings-workspace__count">{catalog.length} 个</span></div><Table className="operational-table" rowKey="id" size="small" loading={loading} columns={columns} dataSource={catalog} pagination={false} scroll={{ x: canEdit ? 390 : 250 }} /></section>
    <section className="settings-workspace" aria-label="当前活动的看板指标"><div className="settings-workspace__header"><h2 className="settings-workspace__title">{selectedActivity ? `${selectedActivity.name} · 指标` : '指标'}</h2><span className="settings-workspace__count">{metrics.length} 个</span></div><Table className="operational-table" rowKey="id" size="small" loading={loading} columns={metricColumns} dataSource={metrics} pagination={false} scroll={{ x: 680 }} locale={{ emptyText: <EmptyState>{selectedActivity ? '该活动暂无指标。' : '暂无研发活动。'}</EmptyState> }} /></section>
  </div><ActivityEditorDrawer editor={activityEditor} onClose={() => setActivityEditor(null)} onSubmit={(values) => save(activityEditor.id ? `/api/activities/${activityEditor.id}` : '/api/activities', activityEditor.id ? 'PATCH' : 'POST', values, activityEditor.id ? '活动已更新。' : '活动已创建。', () => setActivityEditor(null))} submitting={submitting} /><DashboardMetricEditorDrawer editor={metricEditor} catalog={catalog} onClose={() => setMetricEditor(null)} onSubmit={(values) => save(metricEditor.id ? `/api/metrics/${metricEditor.id}` : '/api/metrics', metricEditor.id ? 'PATCH' : 'POST', { ...values, activity_id: Number(values.activity_id), denominator_semantic: values.denominator_semantic || null, collect_method: 'manual_only' }, metricEditor.id ? '指标已更新。' : '指标已创建。', () => setMetricEditor(null))} submitting={submitting} /></div>
}

function DataMetricEditorDrawer({ editor, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <FocusRestoringDrawer title={editor?.id ? '编辑源数据指标规则' : '新增源数据指标规则'} open={Boolean(editor)} size={560} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>保存规则</AntButton></Space>}><AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}><AntForm.Item name="code" label="规则代码" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: '使用小写字母、数字和短横线' }]}><Input /></AntForm.Item><AntForm.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}><Input /></AntForm.Item><div className="workbench-form-grid two"><AntForm.Item name="metric_type" label="指标类型" rules={[{ required: true }]}><Select options={DATA_METRIC_TYPES} /></AntForm.Item><AntForm.Item name="activity_code" label="活动代码"><Input placeholder="sa / se" /></AntForm.Item><AntForm.Item name="numerator_field" label="分子字段" rules={[{ required: true }]}><Input /></AntForm.Item><AntForm.Item name="denominator_field" label="分母字段"><Input /></AntForm.Item></div><AntForm.Item name="filter_definition" label="筛选条件 JSON"><Input.TextArea rows={4} /></AntForm.Item><AntForm.Item name="active" label="状态" rules={[{ required: true }]}><Select options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} /></AntForm.Item></AntForm></FocusRestoringDrawer>
}

function DataMetricTab({ user, refs, onSessionExpired }) {
  const canEdit = user.role === 'admin'
  const [metrics, setMetrics] = useState([])
  const [selectedCode, setSelectedCode] = useState('')
  const [result, setResult] = useState(null)
  const [editor, setEditor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [computing, setComputing] = useState(false)
  const [metricFilters, setMetricFilters] = useState({ team_id: user.role === 'maintainer' ? String(user.maintainer_team_id) : '', completed_from: '', completed_to: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try { const next = await fetchJson('/api/data-metrics?domain=ir'); setMetrics(next); setSelectedCode((current) => current || next[0]?.code || '') } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setLoading(false) }
  }, [onSessionExpired])
  useEffect(() => { load() }, [load])

  async function save(values) {
    setSubmitting(true)
    try { const body = { domain: 'ir', ...values, filter_definition: typeof values.filter_definition === 'string' ? JSON.parse(values.filter_definition || '{}') : values.filter_definition }; const editing = Boolean(editor.id); await fetchJson(editing ? `/api/data-metrics/${editor.id}` : '/api/data-metrics', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setEditor(null); setNotice({ type: 'success', text: editing ? '源数据指标规则已更新。' : '源数据指标规则已创建。' }); await load() } catch (error) { setNotice({ type: 'error', text: error instanceof SyntaxError ? '筛选条件必须是合法 JSON。' : dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setSubmitting(false) }
  }
  async function remove(metric) { if (!metric) return; try { await fetchJson(`/api/data-metrics/${metric.id}`, { method: 'DELETE' }); setNotice({ type: 'success', text: '源数据指标规则已删除。' }); setSelectedCode((current) => current === metric.code ? '' : current); await load() } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } }
  async function compute() { if (!selectedCode) return; setComputing(true); try { const params = new URLSearchParams({ metric_code: selectedCode }); Object.entries(metricFilters).forEach(([key, value]) => { if (value) params.set(key, value) }); setResult(await fetchJson(`/api/data-metrics/compute?${params.toString()}`)) } catch (error) { setNotice({ type: 'error', text: dataManagementErrorMessage(error) }); if (error.status === 401) onSessionExpired() } finally { setComputing(false) } }

  const columns = [
    { title: '规则', dataIndex: 'name', render: (name, metric) => <Space orientation="vertical" size={0}><AntButton className="settings-rule-select" type="link" size="small" aria-label={`查看规则 ${name} 的结果`} aria-pressed={metric.code === selectedCode} onClick={() => { setSelectedCode(metric.code); setResult(null) }}>{name}</AntButton><Text code>{metric.code}</Text></Space> },
    { title: '类型', dataIndex: 'metric_type', render: (type) => metricValueLabel(type) },
    { title: '字段', key: 'fields', render: (_, metric) => `${metric.numerator_field} / ${metric.denominator_field ?? '—'}` },
    { title: '状态', dataIndex: 'active', render: (active) => <StatusTag tone={active ? 'success' : 'neutral'}>{active ? '启用' : '停用'}</StatusTag> },
    { title: '操作', key: 'action', fixed: 'right', width: 150, render: (_, metric) => canEdit && <Space size={0}><AntButton type="link" size="small" aria-label={`编辑源数据规则 ${metric.name}`} icon={<EditOutlined />} onClick={() => setEditor({ ...metric, filter_definition: JSON.stringify(metric.filter_definition ?? {}, null, 2) })}>编辑</AntButton><Popconfirm okText="删除" cancelText="取消" title={`确定删除规则“${metric.name}”？`} description="成功删除后无法恢复。" onConfirm={() => remove(metric)}><AntButton type="link" danger size="small" aria-label={`删除源数据规则 ${metric.name}`} icon={<DeleteOutlined />}>删除</AntButton></Popconfirm></Space> },
  ]
  const selectedMetric = metrics.find((metric) => metric.code === selectedCode)
  const formattedResult = result?.value === null || result?.value === undefined
    ? '—'
    : formatMetricValue({ type: selectedMetric?.metric_type }, result.value)
  return <div className="workbench-page"><div className="workbench-toolbar"><Text type="secondary">规则引用 IR 源数据字段；结果按有效正式数据实时计算，不直接编辑。</Text>{canEdit && <AntButton type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ id: null, code: '', name: '', metric_type: 'penetration', activity_code: '', numerator_field: 'ai_assisted', denominator_field: 'record_count', filter_definition: '{}', active: true })}>新增源数据规则</AntButton>}</div><Notice notice={notice} /><div className="settings-master-detail settings-master-detail--rules">
    <section className="settings-workspace" aria-label="源数据指标规则"><div className="settings-workspace__header"><h2 className="settings-workspace__title">源数据指标规则</h2><span className="settings-workspace__count">{metrics.length} 条</span></div><Table className="operational-table" rowKey="id" size="small" loading={loading} columns={columns} dataSource={metrics} pagination={false} rowClassName={(record) => record.code === selectedCode ? 'is-selected' : ''} scroll={{ x: 520 }} locale={{ emptyText: <EmptyState>暂无源数据规则。</EmptyState> }} /></section>
    <section className="settings-workspace" aria-label="结果查询"><div className="settings-workspace__header"><h2 className="settings-workspace__title">结果查询</h2></div><div className="settings-workspace__body"><div className="workbench-form"><SelectField label="指标" value={selectedCode} onChange={(value) => { setSelectedCode(value); setResult(null) }} options={metrics.map((metric) => [metric.code, metric.name])} /><SelectField label="团队" value={metricFilters.team_id} disabled={user.role === 'maintainer'} helper={user.role === 'maintainer' ? '按账号绑定团队筛选' : undefined} onChange={(value) => setMetricFilters({ ...metricFilters, team_id: value })} options={refs.teams.map((team) => [team.id, team.name])} /><div className="workbench-form-grid two"><InputField label="完成时间起" type="date" value={metricFilters.completed_from} onChange={(value) => setMetricFilters({ ...metricFilters, completed_from: value })} /><InputField label="完成时间止" type="date" value={metricFilters.completed_to} onChange={(value) => setMetricFilters({ ...metricFilters, completed_to: value })} /></div><AntButton type="primary" disabled={!selectedCode} loading={computing} onClick={compute}>计算当前结果</AntButton></div>{result ? <div className="workbench-result"><Title level={2}>{formattedResult}</Title><Text>{result.metric_name}</Text><Text type="secondary">分子 {result.numerator} · 分母 {result.denominator} · 有效记录 {result.record_count}</Text></div> : <EmptyState>选择规则后计算结果。</EmptyState>}</div></section>
  </div><DataMetricEditorDrawer editor={editor} onClose={() => setEditor(null)} onSubmit={save} submitting={submitting} /></div>
}

function MetricManagement({ user, refs, onSessionExpired }) {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(null)
  const loadCatalog = useCallback(async () => { setLoading(true); try { setCatalog(await fetchJson('/api/catalog')); setCatalogError(null) } catch (error) { setCatalogError(error); if (error.status === 401) onSessionExpired() } finally { setLoading(false) } }, [onSessionExpired])
  useEffect(() => { loadCatalog() }, [loadCatalog])
  return <div className="workbench-page"><PageIntro title="指标定义" description="分别管理看板指标目录和 IR 源数据指标规则，避免混淆两套计算入口。" /><ReferenceError error={catalogError} />{user.role !== 'admin' && <ReadOnlyHint />}<Tabs items={[{ key: 'catalog', label: '看板指标目录', children: <DashboardCatalogTab user={user} catalog={catalog} loading={loading} onReload={loadCatalog} onSessionExpired={onSessionExpired} /> }, { key: 'source', label: '源数据指标规则 / 结果查询', children: <DataMetricTab user={user} refs={refs} onSessionExpired={onSessionExpired} /> }]} /></div>
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
  if (section === 'teams') content = <TeamManagement user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'products') content = <ProductManagement user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'ir') content = <IRManagement user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'requirements') content = <RequirementManagement requirementType={requirementType} onRequirementTypeChange={onRequirementTypeChange} user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'metrics') content = <MetricManagement user={user} refs={refs} onSessionExpired={onSessionExpired} />
  else if (section === 'maturity') content = <MaturityManagement user={user} refs={refs} initialMonth={initialMonth} onSessionExpired={onSessionExpired} />
  else content = <EmptyState>该数据域尚未定义。</EmptyState>
  return <div className="data-management-content"><ReferenceError error={refs.error} />{content}</div>
}
