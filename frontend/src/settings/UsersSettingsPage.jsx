import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Drawer, Empty, Form, Input, Popconfirm, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'

import { fetchJson } from '../api'

const { Text, Title } = Typography

const EMPTY_USER = { id: null, username: '', password: '', role: 'viewer', maintainer_team_id: '' }
const ROLE_LABELS = { admin: '管理员', maintainer: '维护者', viewer: '查看者' }

function UserEditorDrawer({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => { if (editor) form.setFieldsValue(editor) }, [editor, form])

  return (
    <Drawer title={editor?.id ? '编辑用户角色' : '新增用户'} open={Boolean(editor)} size={440} onClose={onClose} destroyOnClose footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>{editor?.id ? '保存角色' : '创建账号'}</Button></Space>}>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        {!editor?.id && <><Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}><Input autoComplete="username" /></Form.Item><Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}><Input.Password autoComplete="new-password" /></Form.Item></>}
        <Form.Item name="role" label="角色" rules={[{ required: true }]}><Select options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label: `${label} · ${value}` }))} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.role !== next.role}>{({ getFieldValue }) => getFieldValue('role') === 'maintainer' ? <Form.Item name="maintainer_team_id" label="绑定团队" rules={[{ required: true, message: '维护者必须绑定团队' }]}><Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} /></Form.Item> : null}</Form.Item>
      </Form>
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

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    try {
      const [nextTeams, nextUsers] = await Promise.all([fetchJson('/api/teams'), fetchJson('/api/auth/users')])
      setTeams(nextTeams)
      setUsers(nextUsers)
      if (clearNotice) setNotice(null)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
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
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally { setSubmitting(false) }
  }

  async function remove(account) {
    try {
      await fetchJson(`/api/users/${account.id}`, { method: 'DELETE' })
      setNotice({ type: 'success', text: '账号已删除。' })
      await load({ clearNotice: false })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    }
  }

  const columns = [
    { title: '账号', dataIndex: 'username', render: (value) => <Text strong>{value}</Text> },
    { title: '角色', dataIndex: 'role', render: (role) => <Tag color={role === 'admin' ? 'blue' : role === 'maintainer' ? 'gold' : 'default'}>{ROLE_LABELS[role] ?? role} · {role}</Tag> },
    { title: '绑定团队', key: 'team', render: (_, account) => teams.find((team) => team.id === account.maintainer_team_id)?.name ?? '—' },
    { title: '操作', key: 'actions', fixed: 'right', width: 180, render: (_, account) => <Space size={0}><Button type="link" size="small" icon={<EditOutlined />} onClick={() => setEditor({ ...account, password: '', maintainer_team_id: account.maintainer_team_id ? String(account.maintainer_team_id) : '' })}>编辑角色</Button>{account.id !== user.id && <Popconfirm title={`确定删除账号“${account.username}”？`} onConfirm={() => remove(account)}><Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button></Popconfirm>}</Space> },
  ]

  if (loading) return <div className="settings-page"><div className="workbench-state"><Spin size="small" />读取用户与权限…</div></div>
  return (
    <div className="settings-page">
      <header className="settings-page__intro"><div><Text className="workbench-eyebrow">系统管理 / 访问控制</Text><Title level={2}>用户与权限</Title><Text type="secondary">管理本地账号、角色和维护者的数据归属。</Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor(EMPTY_USER)}>新增账号</Button></header>
      {notice && <Alert className="settings-page__notice" type={notice.type} showIcon message={notice.text} />}
      <Card title="账号列表" extra={<Text type="secondary">共 {users.length} 个账号</Text>}><Table rowKey="id" size="small" columns={columns} dataSource={users} pagination={false} locale={{ emptyText: <Empty description="暂无账号" /> }} scroll={{ x: 700 }} /></Card>
      <UserEditorDrawer editor={editor} teams={teams} onClose={() => setEditor(null)} onSubmit={submit} submitting={submitting} />
    </div>
  )
}
