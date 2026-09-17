import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Result,
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
import { formatMetricValue } from '../overview/overviewLogic'
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
  auto: '自动采集',
}

const EMPTY_TEAM_FORM = { id: null, name: '', productVersions: '', repos: '' }
const EMPTY_MEMBER_FORM = { id: null, team_id: '', employee_id: '', name: '', role: '' }

function Notice({ notice }) {
  if (!notice) return null
  return <Alert className="workbench-notice" type={notice.type === 'error' ? 'error' : 'success'} showIcon closable message={notice.text} />
}

function LoadingState({ text = '加载中…' }) {
  return <div className="workbench-state"><Spin size="small" /><Text type="secondary">{text}</Text></div>
}

function EmptyState({ children = '暂无数据。' }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={children} />
}

function ReferenceError({ error }) {
  if (!error) return null
  return <Alert className="workbench-notice" type="error" showIcon message="基础数据加载失败" description={error.message} />
}

function PageIntro({ eyebrow, title, description, action }) {
  return (
    <div className="workbench-page-intro">
      <div>
        <Text className="workbench-eyebrow">{eyebrow}</Text>
        <Title level={2}>{title}</Title>
        <Text type="secondary">{description}</Text>
      </div>
      {action && <Space wrap>{action}</Space>}
    </div>
  )
}

function CardHeading({ title, caption, extra }) {
  return (
    <div className="workbench-card-heading">
      <div><Title level={4}>{title}</Title>{caption && <Text type="secondary">{caption}</Text>}</div>
      {extra}
    </div>
  )
}

function ReadOnlyHint() {
  return <Alert type="info" showIcon message="当前角色只读，管理员可维护此主数据。" />
}

function SelectField({ label, value, onChange, options, disabled = false, placeholder = '全部' }) {
  return (
    <label className="workbench-filter-control">
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
    </label>
  )
}

function InputField({ label, value, onChange, type = 'text' }) {
  return <label className="workbench-filter-control"><span>{label}</span><Input size="small" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function useReferenceData(onSessionExpired, user) {
  const [data, setData] = useState({ teams: [], products: [], versions: [], members: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
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
    }
  }, [onSessionExpired, user.role])

  useEffect(() => { reload() }, [reload])
  return { ...data, loading, error, reload }
}

function TeamEditorDrawer({ editor, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (editor) form.setFieldsValue(editor)
  }, [editor, form])
  return (
    <Drawer
      title={editor?.id ? '编辑团队' : '新增团队'}
      open={Boolean(editor)}
      size={480}
      onClose={onClose}
      destroyOnClose
      footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存团队</Button></Space>}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="name" label="团队名称" rules={[{ required: true, message: '请输入团队名称' }]}><Input /></Form.Item>
        <Form.Item name="productVersions" label="产品版本映射"><Input.TextArea rows={3} placeholder="可用逗号或换行分隔" /></Form.Item>
        <Form.Item name="repos" label="代码仓地址"><Input.TextArea rows={3} placeholder="可用逗号或换行分隔" /></Form.Item>
      </Form>
    </Drawer>
  )
}

function MemberEditorDrawer({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (editor) form.setFieldsValue(editor)
  }, [editor, form])
  return (
    <Drawer
      title={editor?.id ? '编辑团队成员' : '新增团队成员'}
      open={Boolean(editor)}
      size={480}
      onClose={onClose}
      destroyOnClose
      footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存成员</Button></Space>}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="team_id" label="所属团队" rules={[{ required: true, message: '请选择团队' }]}><Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} /></Form.Item>
        <Form.Item name="employee_id" label="工号" rules={[{ required: true, message: '请输入工号' }]}><Input /></Form.Item>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true, message: '请输入人员角色' }]}><Input placeholder="研发工程师" /></Form.Item>
      </Form>
    </Drawer>
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
      setNotice({ type: 'error', text: error.message })
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
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally { setSubmitting(false) }
  }

  async function removeMember(member) {
    try {
      await fetchJson(`/api/team-members/${member.id}`, { method: 'DELETE' })
      setNotice({ type: 'success', text: '团队成员已删除。' })
      await onRefresh()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    }
  }

  async function removeTeam(team) {
    try {
      await fetchJson(`/api/teams/${team.id}`, { method: 'DELETE' })
      setNotice({ type: 'success', text: '团队已删除。' })
      await onRefresh()
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    }
  }

  const teamColumns = [
    { title: '团队', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { title: '版本映射', render: (_, team) => team.source_mapping?.product_versions?.length ?? 0 },
    { title: '操作', key: 'action', fixed: 'right', width: canEdit ? 220 : 80, render: (_, team) => <Space size={0}><Button type="link" size="small" aria-label={`查看团队 ${team.name}`} aria-pressed={team.id === selectedTeamId} onClick={(event) => { event.stopPropagation(); setSelectedTeamId(team.id) }}>查看</Button>{canEdit && <><Button type="link" size="small" icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); setTeamEditor({ id: team.id, name: team.name, productVersions: team.source_mapping?.product_versions?.join('\n') || '', repos: team.source_mapping?.repos?.join('\n') || '' }) }}>编辑</Button><Popconfirm title={`确定删除团队“${team.name}”？`} description="有关联数据或维护者时可能无法删除。" onConfirm={() => removeTeam(team)}><Button type="link" danger size="small" aria-label={`删除团队 ${team.name}`} icon={<DeleteOutlined />}>删除</Button></Popconfirm></>}</Space> },
  ]
  const memberColumns = [
    { title: '工号', dataIndex: 'employee_id', render: (value) => <Text code>{value}</Text> },
    { title: '姓名', dataIndex: 'name' },
    { title: '角色', dataIndex: 'role' },
    { title: '操作', key: 'action', fixed: 'right', width: 150, render: (_, member) => canEdit && <Space size={0}><Button type="link" size="small" icon={<EditOutlined />} onClick={() => setMemberEditor({ ...member, team_id: String(member.team_id) })}>编辑</Button><Popconfirm title={`确定删除成员“${member.name}”？`} onConfirm={() => removeMember(member)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> },
  ]

  return (
    <div className="workbench-page">
      <PageIntro eyebrow="系统管理 / 主数据" title="团队与人员" description="团队是当前看板的统计和权限归属单位；成员工号用于关联源数据责任人。" action={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setTeamEditor(EMPTY_TEAM_FORM)}>新增团队</Button>} />
      <Notice notice={notice} />
      {!canEdit && <ReadOnlyHint />}
      <div className="workbench-master-detail">
        <Card title="团队" extra={<Text type="secondary">{refs.teams.length} 个</Text>}><Table rowKey="id" size="small" columns={teamColumns} dataSource={refs.teams} pagination={false} rowClassName={(record) => record.id === selectedTeamId ? 'is-selected' : ''} /></Card>
        <Card title={selectedTeam ? `${selectedTeam.name} · 团队详情` : '团队详情'} extra={canEdit && selectedTeam && <Button size="small" icon={<PlusOutlined />} onClick={() => setMemberEditor({ ...EMPTY_MEMBER_FORM, team_id: String(selectedTeam.id) })}>新增成员</Button>}>
          {selectedTeam ? <><Descriptions size="small" column={1} items={[{ key: 'mapping', label: '数据源映射', children: <Space wrap>{(selectedTeam.source_mapping?.product_versions ?? []).map((value) => <Tag key={value}>{value}</Tag>)}{(selectedTeam.source_mapping?.repos ?? []).map((value) => <Tag key={value} color="blue">{value}</Tag>)}{!selectedTeam.source_mapping?.product_versions?.length && !selectedTeam.source_mapping?.repos?.length && <Text type="secondary">未配置</Text>}</Space> }]} /><Divider titlePlacement="left" plain>团队成员</Divider><Table rowKey="id" size="small" columns={memberColumns} dataSource={members} pagination={false} locale={{ emptyText: <EmptyState>暂无团队成员。</EmptyState> }} /></> : <EmptyState>请选择团队查看详情。 </EmptyState>}
        </Card>
      </div>
      <TeamEditorDrawer editor={teamEditor} onClose={() => setTeamEditor(null)} onSubmit={saveTeam} submitting={submitting} />
      <MemberEditorDrawer editor={memberEditor} teams={refs.teams} onClose={() => setMemberEditor(null)} onSubmit={saveMember} submitting={submitting} />
    </div>
  )
}

function ProductEditorDrawer({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <Drawer title={editor?.id ? '编辑产品' : '新增产品'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存产品</Button></Space>}><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="team_id" label="所属团队" rules={[{ required: true, message: '请选择团队' }]}><Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} /></Form.Item><Form.Item name="name" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}><Input /></Form.Item></Form></Drawer>
}

function VersionEditorDrawer({ editor, products, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <Drawer title={editor?.id ? '编辑产品版本' : '新增产品版本'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存版本</Button></Space>}><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="product_id" label="所属产品" rules={[{ required: true, message: '请选择产品' }]}><Select options={products.map((product) => ({ value: String(product.id), label: `${product.team_name} / ${product.name}` }))} /></Form.Item><Form.Item name="name" label="版本名称" rules={[{ required: true, message: '请输入版本名称' }]}><Input placeholder="SCC 27.1.RC1" /></Form.Item></Form></Drawer>
}

function IterationEditorDrawer({ editor, versions, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <Drawer title={editor?.id ? '编辑开发迭代期' : '新增开发迭代期'} open={Boolean(editor)} size={480} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存迭代</Button></Space>}><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="version_id" label="所属版本" rules={[{ required: true, message: '请选择版本' }]}><Select options={versions.map((version) => ({ value: String(version.id), label: `${version.product_name} / ${version.name}` }))} /></Form.Item><Form.Item name="name" label="迭代名称" rules={[{ required: true, message: '请输入迭代名称' }]}><Input /></Form.Item><Space.Compact block><Form.Item className="workbench-compact-item" name="start_date" label="开始日期" rules={[{ required: true, message: '请选择开始日期' }]}><Input type="date" /></Form.Item><Form.Item className="workbench-compact-item" name="end_date" label="结束日期" rules={[{ required: true, message: '请选择结束日期' }]}><Input type="date" /></Form.Item></Space.Compact></Form></Drawer>
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
    try { await fetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); close(); setNotice({ type: 'success', text: success }); await onRefresh() } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } finally { setSubmitting(false) }
  }

  async function remove(url, label) {
    await save(url, 'DELETE', undefined, `${label}已删除。`, () => undefined)
  }

  const productColumns = [
    { title: '产品', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { title: '团队', dataIndex: 'team_name' },
    { title: '版本数', render: (_, product) => product.versions?.length ?? 0 },
    { title: '操作', key: 'action', fixed: 'right', width: canEdit ? 210 : 80, render: (_, product) => <Space size={0}><Button type="link" size="small" aria-label={`查看产品 ${product.name}`} aria-pressed={product.id === selectedProductId} onClick={(event) => { event.stopPropagation(); setSelectedProductId(product.id) }}>查看</Button>{canEdit && <><Button type="link" size="small" aria-label={`编辑产品 ${product.name}`} icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); setProductEditor({ id: product.id, team_id: String(product.team_id), name: product.name }) }}>编辑</Button><Popconfirm title={`确定删除产品“${product.name}”？`} description="仅未被版本或 IR 数据引用的产品可删除。" onConfirm={() => remove(`/api/products/${product.id}`, `产品“${product.name}”`)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm></>}</Space> },
  ]
  const versionColumns = [
    { title: '版本', dataIndex: 'name', render: (name) => <Text strong>{name}</Text> },
    { title: '迭代', render: (_, version) => <Space wrap>{(version.iterations ?? []).map((iteration) => <Tag key={iteration.id} color="blue"><Space size={4}><span>{iteration.name}</span>{canEdit && <><Button type="link" size="small" aria-label={`编辑迭代 ${iteration.name}`} icon={<EditOutlined />} onClick={() => setIterationEditor({ id: iteration.id, version_id: String(version.id), name: iteration.name, start_date: iteration.start_date, end_date: iteration.end_date })} /><Popconfirm title={`确定删除迭代“${iteration.name}”？`} onConfirm={() => remove(`/api/iterations/${iteration.id}`, `迭代“${iteration.name}”`)}><Button type="link" danger size="small" aria-label={`删除迭代 ${iteration.name}`} icon={<DeleteOutlined />} /></Popconfirm></>}</Space></Tag>)}</Space> },
    { title: '操作', key: 'action', fixed: 'right', width: 220, render: (_, version) => canEdit && <Space size={0}><Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setIterationEditor({ id: null, version_id: String(version.id), name: '', start_date: '', end_date: '' })}>新增迭代</Button><Button type="link" size="small" icon={<EditOutlined />} onClick={() => setVersionEditor({ id: version.id, product_id: String(version.product_id), name: version.name })}>编辑</Button><Popconfirm title={`确定删除版本“${version.name}”？`} onConfirm={() => remove(`/api/versions/${version.id}`, `版本“${version.name}”`)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> },
  ]

  return (
    <div className="workbench-page">
      <PageIntro eyebrow="系统管理 / 主数据" title="产品、版本与开发迭代期" description="产品属于团队，版本属于产品，迭代属于版本；使用主从布局维护层级关系。" action={canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setProductEditor({ id: null, team_id: '', name: '' })}>新增产品</Button>} />
      <Notice notice={notice} />
      {!canEdit && <ReadOnlyHint />}
      <div className="workbench-master-detail">
        <Card title="产品" extra={<Text type="secondary">{refs.products.length} 个</Text>}><Table rowKey="id" size="small" columns={productColumns} dataSource={refs.products} pagination={false} rowClassName={(record) => record.id === selectedProductId ? 'is-selected' : ''} /></Card>
        <Card title={selectedProduct ? `${selectedProduct.name} · 层级详情` : '产品详情'} extra={canEdit && selectedProduct && <Button size="small" icon={<PlusOutlined />} onClick={() => setVersionEditor({ id: null, product_id: String(selectedProduct.id), name: '' })}>新增版本</Button>}>
          {selectedProduct ? <><Descriptions size="small" column={2} items={[{ key: 'team', label: '负责团队', children: selectedProduct.team_name }, { key: 'versions', label: '版本数量', children: versions.length }]} /><Divider titlePlacement="left" plain>产品版本与迭代</Divider><Table rowKey="id" size="small" columns={versionColumns} dataSource={versions} pagination={false} locale={{ emptyText: <EmptyState>暂无产品版本。</EmptyState> }} /></> : <EmptyState>请选择产品查看层级。</EmptyState>}
        </Card>
      </div>
      <ProductEditorDrawer editor={productEditor} teams={refs.teams} onClose={() => setProductEditor(null)} onSubmit={(values) => save(productEditor.id ? `/api/products/${productEditor.id}` : '/api/products', productEditor.id ? 'PATCH' : 'POST', { team_id: Number(values.team_id), name: values.name.trim() }, productEditor.id ? '产品已更新。' : '产品已创建。', () => setProductEditor(null))} submitting={submitting} />
      <VersionEditorDrawer editor={versionEditor} products={refs.products} onClose={() => setVersionEditor(null)} onSubmit={(values) => save(versionEditor.id ? `/api/versions/${versionEditor.id}` : '/api/versions', versionEditor.id ? 'PATCH' : 'POST', { product_id: Number(values.product_id), name: values.name.trim() }, versionEditor.id ? '产品版本已更新。' : '产品版本已创建。', () => setVersionEditor(null))} submitting={submitting} />
      <IterationEditorDrawer editor={iterationEditor} versions={allVersions} onClose={() => setIterationEditor(null)} onSubmit={(values) => save(iterationEditor.id ? `/api/iterations/${iterationEditor.id}` : '/api/iterations', iterationEditor.id ? 'PATCH' : 'POST', { version_id: Number(values.version_id), name: values.name.trim(), start_date: values.start_date, end_date: values.end_date }, iterationEditor.id ? '开发迭代期已更新。' : '开发迭代期已创建。', () => setIterationEditor(null))} submitting={submitting} />
    </div>
  )
}

function IRRecordDrawer({ editor, refs, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  const productId = Form.useWatch('product_id', form)
  const versionId = Form.useWatch('version_id', form)
  const versions = refs.versions.filter((version) => version.product_id === Number(productId))
  const selectedVersion = refs.versions.find((version) => String(version.id) === String(versionId))
  useEffect(() => { if (editor) form.setFieldsValue(editor.form) }, [editor, form])
  return (
    <Drawer title={editor?.record ? '编辑 IR 需求' : '新增 IR 需求'} open={Boolean(editor)} size={760} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存需求</Button></Space>}>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <div className="workbench-form-grid two"><Form.Item name="requirement_no" label="需求编号" rules={[{ required: true, message: '请输入需求编号' }]}><Input disabled={Boolean(editor?.record)} /></Form.Item><Form.Item name="requirement_name" label="需求名称" rules={[{ required: true, message: '请输入需求名称' }]}><Input /></Form.Item><Form.Item name="responsible_employee_id" label="责任人工号"><Input /></Form.Item><Form.Item name="parent_requirement_no" label="父需求编号"><Input /></Form.Item><Form.Item name="product_id" label="产品" rules={[{ required: true, message: '请选择产品' }]}><Select onChange={() => form.setFieldsValue({ version_id: '', iteration_id: '' })} options={refs.products.map((product) => ({ value: String(product.id), label: `${product.team_name} / ${product.name}` }))} /></Form.Item><Form.Item name="version_id" label="版本" rules={[{ required: true, message: '请选择版本' }]}><Select onChange={() => form.setFieldsValue({ iteration_id: '' })} options={versions.map((version) => ({ value: String(version.id), label: version.name }))} /></Form.Item><Form.Item name="iteration_id" label="迭代" rules={[{ required: true, message: '请选择迭代' }]}><Select options={(selectedVersion?.iterations ?? []).map((iteration) => ({ value: String(iteration.id), label: iteration.name }))} /></Form.Item><Form.Item name="completed_at" label="完成时间" rules={[{ required: true, message: '请选择完成时间' }]}><Input type="date" /></Form.Item><Form.Item name="business_module" label="业务模块" rules={[{ required: true, message: '请输入业务模块' }]}><Input /></Form.Item><Form.Item name="requirement_scenario" label="需求场景" rules={[{ required: true, message: '请输入需求场景' }]}><Input /></Form.Item></div>
        <Divider titlePlacement="left" plain>工作量与 AI 属性</Divider>
        <div className="workbench-form-grid three"><Form.Item name="estimated_workload" label="总预估（人天）"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item><Form.Item name="actual_workload" label="总实际（人天）"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item><Form.Item name="ai_assisted" label="是否使用 AI"><Select options={[{ value: '', label: '待维护' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]} /></Form.Item><Form.Item name="sa_estimated_workload" label="SA 预估"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item><Form.Item name="sa_actual_workload" label="SA 实际"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item><Form.Item name="se_estimated_workload" label="SE 预估"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item><Form.Item name="se_actual_workload" label="SE 实际"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item></div>
      </Form>
    </Drawer>
  )
}

function ImportPreviewDrawer({ batch, onClose, onConfirm, submitting }) {
  const columns = [
    { title: '行', dataIndex: 'row_number', width: 60 },
    { title: '记录 ID', dataIndex: 'source_id', render: (value) => <Text code>{value ?? '—'}</Text> },
    { title: '动作', dataIndex: 'operation', render: (value) => <Tag color={value === 'insert' ? 'gold' : value === 'fill' ? 'green' : 'default'}>{value === 'insert' ? '新增' : value === 'fill' ? '补充空值' : '无变化'}</Tag> },
    { title: '差异', dataIndex: 'diff', render: (diff = {}) => <Space orientation="vertical" size={0}>{Object.entries(diff).filter(([, value]) => value.action !== 'unchanged').slice(0, 5).map(([field, value]) => <Text key={field} type={value.action === 'keep' ? 'secondary' : undefined}>{field}：{value.action === 'keep' ? '保留正式值' : `→ ${String(value.to)}`}</Text>)}</Space> },
    { title: '校验', key: 'validation', render: (_, row) => <Space orientation="vertical" size={0}>{row.errors?.map((error) => <Text key={error} type="danger">{error}</Text>)}{row.warnings?.map((warning) => <Text key={warning} type="warning">{warning}</Text>)}{!row.errors?.length && !row.warnings?.length && <Tag color="green">通过</Tag>}</Space> },
  ]
  return <Drawer title={`导入预览 · ${batch.filename ?? '数据文件'}`} open size={1080} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" disabled={batch.invalid_rows > 0} loading={submitting} onClick={onConfirm}>{batch.invalid_rows ? '存在错误，不能确认' : '确认写入正式数据'}</Button></Space>}><Steps current={1} size="small" items={[{ title: '上传' }, { title: '预览与校验' }, { title: '整批确认' }]} /><div className="workbench-import-summary"><Tag>总行数 {batch.total_rows}</Tag><Tag color="green">可确认 {batch.valid_rows}</Tag><Tag color={batch.invalid_rows ? 'red' : 'default'}>错误行 {batch.invalid_rows}</Tag></div>{batch.invalid_rows ? <Alert type="error" showIcon message="存在错误行，整批数据不能确认。" /> : <Alert type="success" showIcon message="全部行校验通过；导入和采集只补正式数据中的空字段。" />}<Table className="workbench-import-table" rowKey="row_number" size="small" columns={columns} dataSource={batch.rows} pagination={false} scroll={{ x: 900, y: 420 }} /></Drawer>
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
  const [busy, setBusy] = useState(false)

  const availableProducts = useMemo(() => refs.products.filter((product) => !filters.team_id || product.team_id === Number(filters.team_id)), [refs.products, filters.team_id])
  const availableProductIds = useMemo(() => new Set(availableProducts.map((product) => product.id)), [availableProducts])
  const availableVersions = useMemo(() => refs.versions.filter((version) => version.product_id && availableProductIds.has(version.product_id) && (!filters.product_id || version.product_id === Number(filters.product_id))), [refs.versions, availableProductIds, filters.product_id])
  const selectedVersion = refs.versions.find((version) => String(version.id) === String(filters.version_id))
  const availableIterations = selectedVersion?.iterations ?? []

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    try { setData(await fetchJson(`/api/data/ir?${buildIrQuery(filters).toString()}`)); if (clearNotice) setNotice(null) } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } finally { setLoading(false) }
  }, [filters, onSessionExpired])
  useEffect(() => { load() }, [load])

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
    } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } finally { setBusy(false) }
  }

  async function previewFile(file) {
    setBusy(true)
    try { const batch = await fetchJson('/api/data/ir/imports/preview', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': file.name }, body: await file.arrayBuffer() }); setImportBatch(batch); setNotice({ type: 'success', text: `已生成导入预览：${batch.valid_rows} 行可确认，${batch.invalid_rows} 行有错误。` }) } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } finally { setBusy(false) }
  }

  async function confirmImport() {
    if (!importBatch) return
    setBusy(true)
    try { const result = await fetchJson(`/api/data/ir/imports/${importBatch.id}/confirm`, { method: 'POST' }); setImportBatch(null); setNotice({ type: 'success', text: `导入已确认：新增 ${result.created} 条，补充 ${result.updated} 条，未变化 ${result.unchanged} 条。` }); await load({ clearNotice: false }) } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } finally { setBusy(false) }
  }

  const columns = [
    { title: '需求', key: 'requirement', fixed: 'left', width: 220, render: (_, record) => <Space orientation="vertical" size={0}><Text strong>{record.requirement_no}</Text><Text type="secondary">{record.requirement_name}</Text></Space> },
    { title: '归属', key: 'ownership', width: 230, render: (_, record) => <Space orientation="vertical" size={0}><Text>{record.team_name}</Text><Text type="secondary">{record.product_name} / {record.version_name} / {record.iteration_name}</Text></Space> },
    { title: '责任人', key: 'owner', width: 130, render: (_, record) => <Space>{record.responsible_employee_id ? <Text code>{record.responsible_employee_id}</Text> : <Text type="secondary">—</Text>}{record.responsible_employee_pending && <Tag color="warning">待匹配</Tag>}</Space> },
    { title: '完成时间', dataIndex: 'completed_at', width: 120 },
    { title: '模块 / 场景', key: 'scenario', width: 180, render: (_, record) => <Space orientation="vertical" size={0}><Text>{record.business_module}</Text><Text type="secondary">{record.requirement_scenario}</Text></Space> },
    { title: 'AI 属性', dataIndex: 'ai_assisted', width: 100, render: (value) => <Tag color={value === true ? 'green' : value === false ? 'default' : 'gold'}>{value === true ? '是' : value === false ? '否' : '待维护'}</Tag> },
    { title: '工作量', key: 'workload', width: 180, render: (_, record) => <Space orientation="vertical" size={0}><Text>总计 {record.estimated_workload ?? '—'} / {record.actual_workload ?? '—'}</Text><Text type="secondary">SA {record.sa_estimated_workload ?? '—'} / {record.sa_actual_workload ?? '—'} · SE {record.se_estimated_workload ?? '—'} / {record.se_actual_workload ?? '—'}</Text></Space> },
    { title: '来源', key: 'source', width: 100, render: (_, record) => <Space orientation="vertical" size={0}><Tag>{RECORD_SOURCE_LABELS[record.record_source] ?? record.record_source}</Tag><Text type="secondary">{record.updated_by}</Text></Space> },
    { title: '操作', key: 'action', fixed: 'right', width: 80, render: (_, record) => canEdit && <Button type="link" size="small" icon={<EditOutlined />} onClick={() => setEditor({ record, form: irFormFromRecord(record) })}>编辑</Button> },
  ]

  return (
    <div className="workbench-page">
      <PageIntro eyebrow="数据管理 / IR" title="IR 需求数据" description="按团队、产品、版本、迭代、责任人和完成时间管理正式源数据；保存后保持当前筛选和页码。" action={canEdit && <Space><Upload accept=".csv,.xlsx" showUploadList={false} beforeUpload={(file) => { previewFile(file); return false }}><Button icon={<UploadOutlined />} loading={busy}>导入 CSV / Excel</Button></Upload><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ record: null, form: { ...EMPTY_IR_FORM, product_id: availableProducts[0]?.id ? String(availableProducts[0].id) : '' } })}>新增 IR</Button></Space>} />
      <Notice notice={notice} />
      {!canEdit && <ReadOnlyHint />}
      <Card className="workbench-filter-card" title={<Space><Text strong>常用筛选</Text><Text type="secondary">只展示已确认的有效记录</Text></Space>} extra={<Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => setFilters(initialFilters)}>重置筛选</Button>}>
        <div className="workbench-filter-row"><SelectField label="团队" value={filters.team_id} disabled={user.role === 'maintainer'} onChange={(value) => updateFilter('team_id', value)} options={refs.teams.map((team) => [team.id, team.name])} /><SelectField label="产品" value={filters.product_id} onChange={(value) => updateFilter('product_id', value)} options={availableProducts.map((product) => [product.id, product.name])} /><SelectField label="版本" value={filters.version_id} onChange={(value) => updateFilter('version_id', value)} options={availableVersions.map((version) => [version.id, version.name])} /><SelectField label="迭代" value={filters.iteration_id} onChange={(value) => updateFilter('iteration_id', value)} options={availableIterations.map((iteration) => [iteration.id, iteration.name])} /><InputField label="需求编号" value={filters.requirement_no} onChange={(value) => updateFilter('requirement_no', value)} /></div>
        <Collapse ghost items={[{ key: 'advanced', label: '高级筛选', children: <div className="workbench-filter-row"><InputField label="责任人工号" value={filters.responsible_employee_id} onChange={(value) => updateFilter('responsible_employee_id', value)} /><InputField label="业务模块" value={filters.business_module} onChange={(value) => updateFilter('business_module', value)} /><InputField label="需求场景" value={filters.requirement_scenario} onChange={(value) => updateFilter('requirement_scenario', value)} /><InputField label="完成时间起" type="date" value={filters.completed_from} onChange={(value) => updateFilter('completed_from', value)} /><InputField label="完成时间止" type="date" value={filters.completed_to} onChange={(value) => updateFilter('completed_to', value)} /><SelectField label="AI 辅助" value={filters.ai_assisted} onChange={(value) => updateFilter('ai_assisted', value)} options={[['true', '是'], ['false', '否']]} /></div> }]} />
      </Card>
      <Card className="workbench-table-card" title={<Space><Text strong>IR 正式数据</Text><Text type="secondary">{data.total} 条记录</Text></Space>}><Table rowKey="id" size="small" columns={columns} dataSource={data.items} loading={loading} scroll={{ x: 1500 }} pagination={{ current: filters.page, pageSize: filters.page_size, total: data.total, showSizeChanger: false, showTotal: (total) => `共 ${total} 条`, onChange: (page) => setFilters((current) => ({ ...current, page })) }} locale={{ emptyText: <EmptyState>当前筛选条件下没有 IR 正式数据。</EmptyState> }} /></Card>
      <IRRecordDrawer editor={editor} refs={refs} onClose={() => setEditor(null)} onSubmit={saveRecord} submitting={busy} />
      {importBatch && <ImportPreviewDrawer batch={importBatch} onClose={() => setImportBatch(null)} onConfirm={confirmImport} submitting={busy} />}
    </div>
  )
}

function RequirementManagement({ requirementType, onRequirementTypeChange, ...props }) {
  const activeType = ['ir', 'ar', 'sr'].includes(requirementType) ? requirementType : 'ir'
  const pending = (type) => <Result status="info" title={`${type} 需求规格待定义`} subTitle="当前只有 IR 需求具备字段、校验、导入和指标口径。" />
  return <Tabs activeKey={activeType} onChange={onRequirementTypeChange} items={[
    { key: 'ir', label: 'IR', children: <IRManagement {...props} /> },
    { key: 'ar', label: 'AR', children: pending('AR') },
    { key: 'sr', label: 'SR', children: pending('SR') },
  ]} />
}

function ActivityEditorDrawer({ editor, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <Drawer title={editor?.id ? '编辑研发活动' : '新增研发活动'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存活动</Button></Space>}><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="code" label="活动代码" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: '使用小写字母、数字和短横线' }]}><Input /></Form.Item><Form.Item name="name" label="活动名称" rules={[{ required: true, message: '请输入活动名称' }]}><Input /></Form.Item><Form.Item name="kind" label="活动类别" rules={[{ required: true }]}><Select options={ACTIVITY_KINDS} /></Form.Item></Form></Drawer>
}

function DashboardMetricEditorDrawer({ editor, catalog, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <Drawer title={editor?.id ? '编辑看板指标' : '新增看板指标'} open={Boolean(editor)} size={520} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存指标</Button></Space>}><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="activity_id" label="所属活动" rules={[{ required: true, message: '请选择活动' }]}><Select options={catalog.map((activity) => ({ value: String(activity.id), label: activity.name }))} /></Form.Item><Form.Item name="code" label="指标代码" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: '使用小写字母、数字和短横线' }]}><Input /></Form.Item><Form.Item name="name" label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}><Input /></Form.Item><Form.Item name="type" label="指标类型" rules={[{ required: true }]}><Select options={DASHBOARD_METRIC_TYPES} /></Form.Item><Form.Item name="numerator_semantic" label="分子语义" rules={[{ required: true, message: '请输入分子语义' }]}><Input /></Form.Item><Form.Item name="denominator_semantic" label="分母语义"><Input /></Form.Item><Alert type="info" showIcon message="首期所有指标采集方式为仅补录。" /></Form></Drawer>
}

function DashboardCatalogTab({ user, catalog, loading, onReload, onSessionExpired }) {
  const canEdit = user.role === 'admin'
  const [activityEditor, setActivityEditor] = useState(null)
  const [metricEditor, setMetricEditor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function save(url, method, body, success, close) {
    setSubmitting(true)
    try { await fetchJson(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); close(); setNotice({ type: 'success', text: success }); await onReload() } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } finally { setSubmitting(false) }
  }
  async function remove(url, label) { await save(url, 'DELETE', undefined, `${label}已删除。`, () => undefined) }

  const columns = [
    { title: '活动', dataIndex: 'name', render: (name, activity) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text type="secondary">{activity.kind === 'key' ? '关键研发活动' : '通用研发能力'}</Text></Space> },
    { title: '指标目录', key: 'metrics', render: (_, activity) => <Space wrap>{activity.metrics.map((metric) => <Tag key={metric.id} color={metric.type === 'boolean' ? 'gold' : 'blue'}>{metric.name} · {metricValueLabel(metric.type)}</Tag>)}</Space> },
    { title: '操作', key: 'action', fixed: 'right', width: 250, render: (_, activity) => canEdit && <Space><Button type="link" size="small" icon={<PlusOutlined />} onClick={() => setMetricEditor({ id: null, activity_id: String(activity.id), code: '', name: '', type: 'penetration', numerator_semantic: '', denominator_semantic: '', collect_method: 'manual_only' })}>新增指标</Button><Button type="link" size="small" icon={<EditOutlined />} onClick={() => setActivityEditor({ id: activity.id, code: activity.code, name: activity.name, kind: activity.kind })}>编辑活动</Button><Popconfirm title={`确定删除活动“${activity.name}”？`} description="仍包含指标或事实记录的活动不能删除。" onConfirm={() => remove(`/api/activities/${activity.id}`, `活动“${activity.name}”`)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> },
  ]
  const metrics = catalog.flatMap((activity) => activity.metrics.map((metric) => ({ ...metric, activity_name: activity.name })))
  const metricColumns = [
    { title: '指标', dataIndex: 'name', render: (name, metric) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text code>{metric.code}</Text></Space> },
    { title: '所属活动', dataIndex: 'activity_name' },
    { title: '类型', dataIndex: 'type', render: (type) => metricValueLabel(type) },
    { title: '分子 / 分母', key: 'semantics', render: (_, metric) => `${metric.numerator_semantic} / ${metric.denominator_semantic ?? '—'}` },
    { title: '操作', key: 'action', fixed: 'right', width: 150, render: (_, metric) => canEdit && <Space size={0}><Button type="link" size="small" icon={<EditOutlined />} onClick={() => setMetricEditor({ ...metric, activity_id: String(metric.activity_id), denominator_semantic: metric.denominator_semantic ?? '', collect_method: metric.collect_method ?? 'manual_only' })}>编辑</Button><Popconfirm title={`确定删除指标“${metric.name}”？`} onConfirm={() => remove(`/api/metrics/${metric.id}`, `指标“${metric.name}”`)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> },
  ]

  return <div className="workbench-page"><div className="workbench-toolbar"><Space><Text strong>看板活动</Text><Text type="secondary">活动与指标是看板计算目录，不等同于源数据指标规则。</Text></Space><Space>{canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setActivityEditor({ id: null, code: '', name: '', kind: 'general' })}>新增活动</Button>}{canEdit && <Button icon={<PlusOutlined />} onClick={() => setMetricEditor({ id: null, activity_id: '', code: '', name: '', type: 'penetration', numerator_semantic: '', denominator_semantic: '', collect_method: 'manual_only' })}>新增指标</Button>}</Space></div><Notice notice={notice} /><Card title="研发活动目录"><Table rowKey="id" size="small" loading={loading} columns={columns} dataSource={catalog} pagination={false} /></Card><Card className="workbench-section-gap" title="指标明细"><Table rowKey="id" size="small" loading={loading} columns={metricColumns} dataSource={metrics} pagination={false} /></Card><ActivityEditorDrawer editor={activityEditor} onClose={() => setActivityEditor(null)} onSubmit={(values) => save(activityEditor.id ? `/api/activities/${activityEditor.id}` : '/api/activities', activityEditor.id ? 'PATCH' : 'POST', values, activityEditor.id ? '活动已更新。' : '活动已创建。', () => setActivityEditor(null))} submitting={submitting} /><DashboardMetricEditorDrawer editor={metricEditor} catalog={catalog} onClose={() => setMetricEditor(null)} onSubmit={(values) => save(metricEditor.id ? `/api/metrics/${metricEditor.id}` : '/api/metrics', metricEditor.id ? 'PATCH' : 'POST', { ...values, activity_id: Number(values.activity_id), denominator_semantic: values.denominator_semantic || null, collect_method: 'manual_only' }, metricEditor.id ? '指标已更新。' : '指标已创建。', () => setMetricEditor(null))} submitting={submitting} /></div>
}

function DataMetricEditorDrawer({ editor, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])
  return <Drawer title={editor?.id ? '编辑源数据指标规则' : '新增源数据指标规则'} open={Boolean(editor)} size={560} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存规则</Button></Space>}><Form form={form} layout="vertical" onFinish={onSubmit}><Form.Item name="code" label="规则代码" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: '使用小写字母、数字和短横线' }]}><Input /></Form.Item><Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}><Input /></Form.Item><div className="workbench-form-grid two"><Form.Item name="metric_type" label="指标类型" rules={[{ required: true }]}><Select options={DATA_METRIC_TYPES} /></Form.Item><Form.Item name="activity_code" label="活动代码"><Input placeholder="sa / se" /></Form.Item><Form.Item name="numerator_field" label="分子字段" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="denominator_field" label="分母字段"><Input /></Form.Item></div><Form.Item name="filter_definition" label="筛选条件 JSON"><Input.TextArea rows={4} /></Form.Item><Form.Item name="active" label="状态" rules={[{ required: true }]}><Select options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} /></Form.Item></Form></Drawer>
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
  const [metricFilters, setMetricFilters] = useState({ team_id: user.role === 'maintainer' ? String(user.maintainer_team_id) : '', completed_from: '', completed_to: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try { const next = await fetchJson('/api/data-metrics?domain=ir'); setMetrics(next); setSelectedCode((current) => current || next[0]?.code || '') } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } finally { setLoading(false) }
  }, [onSessionExpired])
  useEffect(() => { load() }, [load])

  async function save(values) {
    setSubmitting(true)
    try { const body = { domain: 'ir', ...values, filter_definition: typeof values.filter_definition === 'string' ? JSON.parse(values.filter_definition || '{}') : values.filter_definition }; const editing = Boolean(editor.id); await fetchJson(editing ? `/api/data-metrics/${editor.id}` : '/api/data-metrics', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setEditor(null); setNotice({ type: 'success', text: editing ? '源数据指标规则已更新。' : '源数据指标规则已创建。' }); await load() } catch (error) { setNotice({ type: 'error', text: error instanceof SyntaxError ? '筛选条件必须是合法 JSON。' : error.message }); if (error.status === 401) onSessionExpired() } finally { setSubmitting(false) }
  }
  async function remove(metric) { if (!metric) return; try { await fetchJson(`/api/data-metrics/${metric.id}`, { method: 'DELETE' }); setNotice({ type: 'success', text: '源数据指标规则已删除。' }); setSelectedCode((current) => current === metric.code ? '' : current); await load() } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } }
  async function compute() { if (!selectedCode) return; try { const params = new URLSearchParams({ metric_code: selectedCode }); Object.entries(metricFilters).forEach(([key, value]) => { if (value) params.set(key, value) }); setResult(await fetchJson(`/api/data-metrics/compute?${params.toString()}`)) } catch (error) { setNotice({ type: 'error', text: error.message }); if (error.status === 401) onSessionExpired() } }

  const columns = [
    { title: '规则', dataIndex: 'name', render: (name, metric) => <Space orientation="vertical" size={0}><Text strong>{name}</Text><Text code>{metric.code}</Text></Space> },
    { title: '类型', dataIndex: 'metric_type', render: (type) => metricValueLabel(type) },
    { title: '字段', key: 'fields', render: (_, metric) => `${metric.numerator_field} / ${metric.denominator_field ?? '—'}` },
    { title: '状态', dataIndex: 'active', render: (active) => <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '停用'}</Tag> },
    { title: '操作', key: 'action', fixed: 'right', width: 150, render: (_, metric) => canEdit && <Space size={0}><Button type="link" size="small" icon={<EditOutlined />} onClick={() => setEditor({ ...metric, filter_definition: JSON.stringify(metric.filter_definition ?? {}, null, 2) })}>编辑</Button><Popconfirm title={`确定删除规则“${metric.name}”？`} onConfirm={() => remove(metric)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space> },
  ]
  const selectedMetric = metrics.find((metric) => metric.code === selectedCode)
  const formattedResult = result?.value === null || result?.value === undefined
    ? '—'
    : formatMetricValue({ type: selectedMetric?.metric_type }, result.value)
  return <div className="workbench-page"><div className="workbench-toolbar"><Text type="secondary">规则引用 IR 源数据字段；结果按有效正式数据实时计算，不直接编辑。</Text>{canEdit && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ id: null, code: '', name: '', metric_type: 'penetration', activity_code: '', numerator_field: 'ai_assisted', denominator_field: 'record_count', filter_definition: '{}', active: true })}>新增源数据规则</Button>}</div><Notice notice={notice} /><div className="workbench-two-column"><Card title="源数据指标规则"><Table rowKey="id" size="small" loading={loading} columns={columns} dataSource={metrics} pagination={false} rowClassName={(record) => record.code === selectedCode ? 'is-selected' : ''} onRow={(record) => ({ onClick: () => { setSelectedCode(record.code); setResult(null) } })} /></Card><Card title="结果查询"><div className="workbench-form"><SelectField label="指标" value={selectedCode} onChange={(value) => { setSelectedCode(value); setResult(null) }} options={metrics.map((metric) => [metric.code, metric.name])} /><SelectField label="团队" value={metricFilters.team_id} disabled={user.role === 'maintainer'} onChange={(value) => setMetricFilters({ ...metricFilters, team_id: value })} options={refs.teams.map((team) => [team.id, team.name])} /><div className="workbench-form-grid two"><InputField label="完成时间起" type="date" value={metricFilters.completed_from} onChange={(value) => setMetricFilters({ ...metricFilters, completed_from: value })} /><InputField label="完成时间止" type="date" value={metricFilters.completed_to} onChange={(value) => setMetricFilters({ ...metricFilters, completed_to: value })} /></div><Button type="primary" disabled={!selectedCode} onClick={compute}>计算当前结果</Button></div>{result ? <div className="workbench-result"><Title level={2}>{formattedResult}</Title><Text>{result.metric_name}</Text><Text type="secondary">分子 {result.numerator} · 分母 {result.denominator} · 有效记录 {result.record_count}</Text></div> : <EmptyState>选择规则后计算结果。</EmptyState>}</Card></div><DataMetricEditorDrawer editor={editor} onClose={() => setEditor(null)} onSubmit={save} submitting={submitting} /></div>
}

function MetricManagement({ user, refs, onSessionExpired }) {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(null)
  const loadCatalog = useCallback(async () => { setLoading(true); try { setCatalog(await fetchJson('/api/catalog')); setCatalogError(null) } catch (error) { setCatalogError(error); if (error.status === 401) onSessionExpired() } finally { setLoading(false) } }, [onSessionExpired])
  useEffect(() => { loadCatalog() }, [loadCatalog])
  return <div className="workbench-page"><PageIntro eyebrow="系统管理 / 指标定义" title="指标定义" description="分别管理看板指标目录和 IR 源数据指标规则，避免混淆两套计算入口。" /><ReferenceError error={catalogError} />{user.role !== 'admin' && <ReadOnlyHint />}<Tabs items={[{ key: 'catalog', label: '看板指标目录', children: <DashboardCatalogTab user={user} catalog={catalog} loading={loading} onReload={loadCatalog} onSessionExpired={onSessionExpired} /> }, { key: 'source', label: '源数据指标规则 / 结果查询', children: <DataMetricTab user={user} refs={refs} onSessionExpired={onSessionExpired} /> }]} /></div>
}

export default function DataManagementPage({ pathname, section: requestedSection, requirementType = 'ir', onRequirementTypeChange, user, onSessionExpired }) {
  const section = requestedSection ?? sectionFromPath(pathname)
  const refs = useReferenceData(onSessionExpired, user)
  if (refs.loading) return <div className="data-management-content"><LoadingState text="加载主数据…" /></div>
  let content
  if (section === 'teams') content = <TeamManagement user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'products') content = <ProductManagement user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'ir') content = <IRManagement user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'requirements') content = <RequirementManagement requirementType={requirementType} onRequirementTypeChange={onRequirementTypeChange} user={user} refs={refs} onRefresh={refs.reload} onSessionExpired={onSessionExpired} />
  else if (section === 'metrics') content = <MetricManagement user={user} refs={refs} onSessionExpired={onSessionExpired} />
  else content = <EmptyState>该数据域尚未定义。</EmptyState>
  return <div className="data-management-content"><ReferenceError error={refs.error} />{content}</div>
}
