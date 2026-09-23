import { useCallback, useEffect, useState } from 'react'
import { Alert, Button as AntButton, Drawer, Empty, Form as AntForm, Input, Popconfirm, Select, Space, Table, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'

import { fetchJson } from '../api'
import PageHeader from '../components/PageHeader'
import StatusPage, { ContentLoadingState } from '../components/StatusPage'

const { Text } = Typography

const EMPTY_USER = { id: null, username: '', password: '', role: 'viewer', maintainer_team_id: '' }
const ROLE_LABELS = { admin: '管理员', maintainer: '维护者', viewer: '查看者' }
const USER_CONFLICTS = {
  'cannot delete the current user': '不能删除当前账号。',
  'cannot delete the last admin': '不能删除唯一的管理员账号。',
  'resource already exists': '账号名称已被使用，请修改后重试。',
}

function userErrorMessage(error) {
  if (error.status !== 409) return error.message
  return USER_CONFLICTS[error.message] ?? '账号或角色与现有权限关系冲突，操作未完成。'
}

function UserEditorDrawer({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = AntForm.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])

  return (
    <Drawer title={editor?.id ? '编辑用户角色' : '新增用户'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><AntButton onClick={onClose}>取消</AntButton><AntButton type="primary" loading={submitting} onClick={() => form.submit()}>{editor?.id ? '保存角色' : '创建账号'}</AntButton></Space>}>
      <AntForm noValidate form={form} layout="vertical" onFinish={onSubmit}>
        {!editor?.id && <><AntForm.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}><Input autoComplete="username" /></AntForm.Item><AntForm.Item name="password" label="初始密码" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}><Input.Password autoComplete="new-password" /></AntForm.Item></>}
        <AntForm.Item name="role" label="角色" rules={[{ required: true }]}><Select options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label: `${label} · ${value}` }))} /></AntForm.Item>
        <AntForm.Item noStyle shouldUpdate={(prev, next) => prev.role !== next.role}>{({ getFieldValue }) => getFieldValue('role') === 'maintainer' ? <AntForm.Item name="maintainer_team_id" label="绑定团队" rules={[{ required: true, message: '维护者必须绑定团队' }]}><Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} /></AntForm.Item> : null}</AntForm.Item>
      </AntForm>
    </Drawer>
  )
}

export default function UsersSettingsPage({ user, onSessionExpired }) {
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [editor, setEditor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    setLoadError(null)
    try {
      const [nextTeams, nextUsers] = await Promise.all([fetchJson('/api/teams'), fetchJson('/api/auth/users')])
      setTeams(nextTeams)
      setUsers(nextUsers)
      if (clearNotice) setNotice(null)
    } catch (error) {
      setLoadError(error)
      if (error.status === 401) onSessionExpired()
    } finally { setLoading(false) }
  }, [onSessionExpired])

  useEffect(() => { load() }, [load])

  async function submit(values) {
    setSubmitting(true)
    try {
      const editing = Boolean(editor.id)
      const payload = editing
        ? { role: values.role, maintainer_team_id: values.role === 'maintainer' ? Number(values.maintainer_team_id) : null }
        : { username: values.username.trim(), password: values.password, role: values.role, maintainer_team_id: values.role === 'maintainer' ? Number(values.maintainer_team_id) : null }
      await fetchJson(editing ? `/api/users/${editor.id}` : '/api/users', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setEditor(null)
      setNotice({ type: 'success', text: editing ? '用户角色已更新。' : '用户已创建。' })
      await load({ clearNotice: false })
    } catch (error) {
      setNotice({ type: 'error', text: userErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally { setSubmitting(false) }
  }

  async function remove(account) {
    try {
      await fetchJson(`/api/users/${account.id}`, { method: 'DELETE' })
      setNotice({ type: 'success', text: '账号已删除。' })
      await load({ clearNotice: false })
    } catch (error) {
      setNotice({ type: 'error', text: userErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    }
  }

  const columns = [
    { title: '账号', dataIndex: 'username', render: (value, account) => <span><Text strong>{value}</Text>{account.id === user.id && <span className="settings-current-account">当前账号</span>}</span> },
    { title: '角色', dataIndex: 'role', render: (role) => <span className={`settings-role${role === 'admin' ? ' settings-role--admin' : ''}`}>{ROLE_LABELS[role] ?? role} · {role}</span> },
    { title: '绑定团队', key: 'team', render: (_, account) => teams.find((team) => team.id === account.maintainer_team_id)?.name ?? '—' },
    { title: '操作', key: 'actions', fixed: 'right', width: 180, render: (_, account) => <Space size={0}><AntButton type="link" size="small" aria-label={`编辑账号 ${account.username} 角色`} icon={<EditOutlined />} onClick={() => setEditor({ ...account, password: '', maintainer_team_id: account.maintainer_team_id ? String(account.maintainer_team_id) : '' })}>编辑角色</AntButton>{account.id !== user.id && <Popconfirm okText="删除" cancelText="取消" title={`确定删除账号“${account.username}”？`} description="该账号将无法继续登录；删除成功后无法恢复。" onConfirm={() => remove(account)}><AntButton type="link" danger size="small" aria-label={`删除账号 ${account.username}`} icon={<DeleteOutlined />}>删除</AntButton></Popconfirm>}</Space> },
  ]

  const pageHeader = <PageHeader title="用户与权限" description="管理本地账号、角色和维护者的数据归属。" actions={!loading && <AntButton type="primary" icon={<PlusOutlined />} onClick={() => setEditor(EMPTY_USER)}>新增账号</AntButton>} />
  if (loading) return <div className="settings-page">{pageHeader}<ContentLoadingState label="读取用户与权限…" /></div>
  return (
    <div className="settings-page">
      {pageHeader}
      {notice && <Alert className="settings-page__notice" type={notice.type} showIcon message={notice.text} />}
      {loadError
        ? <StatusPage status="error" layout="compact" title="用户列表暂时无法加载" description="请重试；如果问题持续，请稍后再试。" actions={<AntButton type="primary" onClick={() => load()}>重试</AntButton>} />
        : <section className="operational-workspace" aria-label="用户与权限列表"><div className="operational-workspace__header"><h2 className="operational-workspace__title">账号</h2><span className="operational-workspace__count">共 {users.length} 个</span></div><Table className="operational-table" rowKey="id" size="small" columns={columns} dataSource={users} pagination={false} locale={{ emptyText: <Empty description="暂无账号" /> }} scroll={{ x: 700 }} /></section>}
      <UserEditorDrawer editor={editor} teams={teams} onClose={() => setEditor(null)} onSubmit={submit} submitting={submitting} />
    </div>
  )
}
