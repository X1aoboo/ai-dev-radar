import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'

import { fetchJson } from '../api'
import PageHeader from '../components/PageHeader'
import StatusPage, { ContentLoadingState } from '../components/StatusPage'
import './admin-pages.css'

const { Text } = Typography

const EMPTY_USER = { id: null, username: '', password: '', role: 'viewer', maintainer_team_id: '' }
const ROLE_LABELS = { admin: '管理员', maintainer: '维护者', viewer: '查看者' }
const ROLE_DESCRIPTIONS = {
  admin: '管理全部账号、团队、产品/PI、Gateway 配置、采集和全部业务数据；保留至少一个管理员。',
  maintainer: '绑定一个团队，维护该团队 IR、成熟度等数据；账号权限不因团队范围自动扩展。',
  viewer: '只读访问分析、工作台和团队数据；不显示编辑、导入、配置等写入口。',
}
const USER_CONFLICTS = {
  'cannot delete the current user': '不能删除当前账号。',
  'cannot delete the last admin': '不能删除唯一的管理员账号。',
  'resource already exists': '账号名称已被使用，请修改后重试。',
}

function userErrorMessage(error) {
  if (error.status !== 409) return error.message
  return USER_CONFLICTS[error.message] ?? '账号或角色与现有权限关系冲突，操作未完成。'
}

function UserEditorModal({ editor, teams, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (!editor) return
    form.setFieldsValue({
      username: editor.username ?? '',
      password: '',
      role: editor.role ?? 'viewer',
      maintainer_team_id: editor.maintainer_team_id ? String(editor.maintainer_team_id) : '',
    })
  }, [editor, form])

  return (
    <Modal
      className="admin-modal"
      open={Boolean(editor)}
      title={editor?.id ? '编辑用户角色' : '新增用户'}
      okText={editor?.id ? '保存角色' : '创建账号'}
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form noValidate form={form} layout="vertical" onFinish={onSubmit}>
        {!editor?.id && (
          <>
            <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
              <Input autoComplete="username" maxLength={50} />
            </Form.Item>
            <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </>
        )}
        <Form.Item name="role" label="角色" rules={[{ required: true }]}>
          <Select options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label: `${label} · ${value}` }))} />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.role !== next.role}>
          {({ getFieldValue }) => getFieldValue('role') === 'maintainer' ? (
            <Form.Item name="maintainer_team_id" label="绑定团队" rules={[{ required: true, message: '维护者必须绑定团队' }]}>
              <Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} placeholder="选择团队" />
            </Form.Item>
          ) : null}
        </Form.Item>
        <Text type="secondary" className="admin-field-note">账号和初始密码只在新增时填写；编辑只调整角色和团队绑定。</Text>
      </Form>
    </Modal>
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
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    setLoadError(null)
    try {
      const [nextTeams, nextUsers] = await Promise.all([
        fetchJson('/api/teams/options'),
        fetchJson('/api/auth/users'),
      ])
      setTeams(nextTeams)
      setUsers(nextUsers)
      if (clearNotice) setNotice(null)
    } catch (error) {
      setLoadError(error)
      if (error.status === 401) onSessionExpired()
    } finally {
      setLoading(false)
    }
  }, [onSessionExpired])

  useEffect(() => { load() }, [load])

  async function submit(values) {
    setSubmitting(true)
    try {
      const editing = Boolean(editor.id)
      const payload = editing
        ? { role: values.role, maintainer_team_id: values.role === 'maintainer' ? Number(values.maintainer_team_id) : null }
        : {
            username: values.username.trim(),
            password: values.password,
            role: values.role,
            maintainer_team_id: values.role === 'maintainer' ? Number(values.maintainer_team_id) : null,
          }
      await fetchJson(editing ? `/api/users/${editor.id}` : '/api/users', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setEditor(null)
      setNotice({ type: 'success', text: editing ? '用户角色已更新。' : '用户已创建。' })
      await load({ clearNotice: false })
    } catch (error) {
      setNotice({ type: 'error', text: userErrorMessage(error) })
      if (error.status === 401) onSessionExpired()
    } finally {
      setSubmitting(false)
    }
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

  const counts = useMemo(() => ({
    admin: users.filter((account) => account.role === 'admin').length,
    maintainer: users.filter((account) => account.role === 'maintainer').length,
    viewer: users.filter((account) => account.role === 'viewer').length,
  }), [users])

  const filteredUsers = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return users.filter((account) => {
      if (roleFilter !== 'all' && account.role !== roleFilter) return false
      if (!query) return true
      const teamName = teams.find((team) => team.id === account.maintainer_team_id)?.name ?? ''
      return [account.username, ROLE_LABELS[account.role], teamName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [keyword, roleFilter, teams, users])

  const teamName = (account) => teams.find((team) => team.id === account.maintainer_team_id)?.name ?? '—'

  const columns = [
    {
      title: '账号',
      dataIndex: 'username',
      render: (value, account) => (
        <div className="admin-account-cell">
          <span className="admin-account-avatar">{String(value || '?').slice(0, 1).toUpperCase()}</span>
          <span><span className="admin-account-name">{value}</span>{account.id === user.id && <span className="admin-current-badge">当前账号</span>}</span>
        </div>
      ),
    },
    { title: '角色', dataIndex: 'role', render: (role) => <span className={`admin-role-tag admin-role-tag--${role}`}>{ROLE_LABELS[role] ?? role} · {role}</span> },
    { title: '绑定团队', key: 'team', render: (_, account) => account.role === 'maintainer' ? teamName(account) : '—' },
    { title: '当前账号', key: 'current', width: 110, render: (_, account) => account.id === user.id ? <Tag color="blue">已登录</Tag> : '—' },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, account) => (
        <Space size={0}>
          <Button type="link" size="small" aria-label={`编辑账号 ${account.username} 角色`} icon={<EditOutlined />} onClick={() => setEditor({ ...account, password: '', maintainer_team_id: account.maintainer_team_id ? String(account.maintainer_team_id) : '' })}>编辑角色</Button>
          {account.id !== user.id && (
            <Popconfirm okText="删除" cancelText="取消" title={`确定删除账号“${account.username}”？`} description="该账号将无法继续登录；删除成功后无法恢复。" onConfirm={() => remove(account)}>
              <Button type="link" danger size="small" aria-label={`删除账号 ${account.username}`} icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="admin-page">
      <PageHeader
        title="用户与权限"
        description="管理本地账号、角色和维护者的数据归属。身份上下文只读取团队名称用于绑定，不携带产品、PI 或 Gateway 数据。"
        actions={!loading && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor(EMPTY_USER)}>新增账号</Button>}
      />

      {notice && <Alert className="settings-page__notice" type={notice.type} showIcon message={notice.text} />}

      <section className="admin-summary" aria-label="账号概览">
        <div className="admin-summary__cell"><div className="admin-summary__label">账号</div><div className="admin-summary__value"><strong className="admin-summary__number">{users.length}</strong><span className="admin-summary__unit">个</span></div><div className="admin-summary__note">本地账号</div></div>
        <div className="admin-summary__cell"><div className="admin-summary__label">管理员</div><div className="admin-summary__value"><strong className="admin-summary__number">{counts.admin}</strong><span className="admin-summary__unit">个</span></div><div className="admin-summary__note">全局管理权限</div></div>
        <div className="admin-summary__cell"><div className="admin-summary__label">维护者</div><div className="admin-summary__value"><strong className="admin-summary__number">{counts.maintainer}</strong><span className="admin-summary__unit">个</span></div><div className="admin-summary__note">各绑定一个团队</div></div>
        <div className="admin-summary__cell"><div className="admin-summary__label">查看者</div><div className="admin-summary__value"><strong className="admin-summary__number">{counts.viewer}</strong><span className="admin-summary__unit">个</span></div><div className="admin-summary__note">只读账号</div></div>
      </section>

      <div className="admin-toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={keyword}
          placeholder="搜索账号"
          aria-label="搜索账号"
          style={{ width: 260 }}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Select
          value={roleFilter}
          aria-label="角色筛选"
          style={{ width: 150 }}
          options={[{ value: 'all', label: '角色：全部' }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
          onChange={setRoleFilter}
        />
        <span className="admin-toolbar__note">当前账号 {user.username ?? 'admin'} · 共 {filteredUsers.length} 个账号</span>
      </div>

      {loadError ? (
        <StatusPage status="error" layout="compact" title="用户列表暂时无法加载" description="请重试；如果问题持续，请稍后再试。" actions={<Button type="primary" onClick={() => load()}>重试</Button>} />
      ) : loading ? (
        <ContentLoadingState label="读取用户与权限…" />
      ) : (
        <section className="admin-table-card" aria-label="用户与权限列表">
          <div className="admin-table-head"><div><h2>账号</h2><span>维护本地身份、角色和维护者团队绑定</span></div><span>共 {filteredUsers.length} 个</span></div>
          <Table
            className="operational-table"
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={filteredUsers}
            pagination={false}
            locale={{ emptyText: <Empty description="没有匹配的账号" /> }}
            scroll={{ x: 760 }}
          />
          <div className="admin-panel__body admin-note">不能删除当前账号或最后一个管理员；维护者必须绑定一个团队。</div>
        </section>
      )}

      <div className="admin-role-cards">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <div className="admin-role-card" key={role}>
            <div className="admin-role-card__head"><h3>{label}</h3><span className={`admin-role-tag admin-role-tag--${role}`}>{role}</span></div>
            <p>{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      <UserEditorModal editor={editor} teams={teams} onClose={() => setEditor(null)} onSubmit={submit} submitting={submitting} />
    </div>
  )
}
