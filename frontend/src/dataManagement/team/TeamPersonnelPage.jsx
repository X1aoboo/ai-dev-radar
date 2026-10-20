import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, Tag, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, ExportOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'

import { downloadFile, fetchJson } from '../../api'
import PageHeader from '../../components/PageHeader'
import { TEAM_ROLES, TEAM_ROLE_VALUES, roleMeta, roleOptions } from './teamRoles'
import TeamImportModal from './TeamImportModal'
import './team-personnel.css'

const { Text } = Typography

function teamErrorMessage(error) {
  const message = error?.message ?? ''
  if (message.includes('team is referenced by facts or maintainers')) return '该团队仍有事实或维护者关联，无法删除。'
  if (message.includes('team is referenced by products') || message.includes('team is referenced by versions')) return '该团队仍有关联产品，无法删除。'
  if (message.includes('resource already exists')) return '名称或工号已被使用，请修改后重试。'
  if (message.includes('team member not found')) return '成员不存在，请刷新后重试。'
  return message || '操作失败，请稍后重试。'
}

function initialOf(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase()
}

function RoleTag({ role }) {
  const meta = roleMeta(role)
  return <Tag className={`team-role-tag team-role-tag--${meta.tone}`}>{meta.label}</Tag>
}

function TeamDialog({ editor, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (!editor) return
    form.setFieldsValue({ name: editor.name ?? '' })
  }, [editor, form])
  return (
    <Modal
      className="team-personnel-modal"
      open={Boolean(editor)}
      title={editor?.id ? '编辑团队' : '新增团队'}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit({ name: String(values.name).trim() })}>
        <Form.Item name="name" label="团队名称" rules={[{ required: true, whitespace: true, message: '请输入团队名称' }]}>
          <Input autoFocus maxLength={100} placeholder="例如：团队A" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function MemberDialog({ editor, teams, defaultTeamId, onClose, onSubmit, submitting }) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (!editor) return
    form.setFieldsValue({
      team_id: editor.team_id ?? (defaultTeamId ? String(defaultTeamId) : undefined),
      employee_id: editor.employee_id ?? '',
      name: editor.name ?? '',
      role: editor.role ?? 'SA',
    })
  }, [editor, defaultTeamId, form])
  return (
    <Modal
      className="team-personnel-modal"
      open={Boolean(editor)}
      title="新增成员"
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => onSubmit({
        team_id: Number(values.team_id),
        employee_id: String(values.employee_id).trim(),
        name: String(values.name).trim(),
        role: values.role,
      })}>
        <Form.Item name="team_id" label="所属团队" rules={[{ required: true, message: '请选择团队' }]}>
          <Select options={teams.map((team) => ({ value: String(team.id), label: team.name }))} placeholder="选择团队" />
        </Form.Item>
        <div className="team-personnel-modal__grid">
          <Form.Item name="employee_id" label="工号" rules={[{ required: true, whitespace: true, message: '请输入工号' }]}>
            <Input maxLength={50} placeholder="例如：A003" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, whitespace: true, message: '请输入姓名' }]}>
            <Input maxLength={100} placeholder="例如：张三" />
          </Form.Item>
        </div>
        <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
          <Select options={roleOptions('')} placeholder="选择团队角色" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function TeamPersonnelPage({ user, refs, onRefresh, onSessionExpired }) {
  const canEdit = user.role === 'admin'
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savingMember, setSavingMember] = useState(null)
  const [teamEditor, setTeamEditor] = useState(null)
  const [memberEditor, setMemberEditor] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState(null)

  const visibleTeams = useMemo(() => (
    user.role === 'maintainer'
      ? refs.teams.filter((team) => team.id === user.maintainer_team_id)
      : refs.teams
  ), [refs.teams, user.role, user.maintainer_team_id])

  const visibleTeamIds = useMemo(() => new Set(visibleTeams.map((team) => team.id)), [visibleTeams])
  const members = useMemo(() => refs.members.filter((member) => visibleTeamIds.has(member.team_id)), [refs.members, visibleTeamIds])
  const teamById = useMemo(() => new Map(visibleTeams.map((team) => [team.id, team])), [visibleTeams])

  useEffect(() => {
    if (selectedTeamId && !visibleTeams.some((team) => team.id === selectedTeamId)) setSelectedTeamId(null)
  }, [selectedTeamId, visibleTeams])

  useEffect(() => {
    if (editingId && !members.some((member) => member.id === editingId)) {
      setEditingId(null)
      setDraft(null)
    }
  }, [editingId, members])

  const teamCounts = useMemo(() => {
    const counts = new Map(visibleTeams.map((team) => [team.id, 0]))
    members.forEach((member) => counts.set(member.team_id, (counts.get(member.team_id) ?? 0) + 1))
    return counts
  }, [visibleTeams, members])

  const roleCounts = useMemo(() => {
    const counts = new Map(TEAM_ROLE_VALUES.map((role) => [role, 0]))
    let legacy = 0
    members.forEach((member) => {
      if (counts.has(member.role)) counts.set(member.role, counts.get(member.role) + 1)
      else legacy += 1
    })
    return { counts, legacy }
  }, [members])

  const standardRoleCount = TEAM_ROLES.filter((role) => (roleCounts.counts.get(role.value) ?? 0) > 0).length
  const averageMembers = visibleTeams.length ? (members.length / visibleTeams.length).toFixed(1) : '0'
  const selectedTeam = selectedTeamId ? teamById.get(selectedTeamId) : null
  const selectedLabel = selectedTeam?.name ?? '全部团队'

  const roleFilterOptions = useMemo(() => {
    const legacyRoles = [...new Set(members.map((member) => member.role).filter((role) => role && !TEAM_ROLE_VALUES.includes(role)))]
    return [
      { value: 'all', label: '角色：全部' },
      ...TEAM_ROLES.map((role) => ({ value: role.value, label: role.label })),
      ...legacyRoles.map((role) => ({ value: role, label: `${role}（历史）` })),
    ]
  }, [members])

  const filteredMembers = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return members
      .filter((member) => {
        if (selectedTeamId && member.team_id !== selectedTeamId) return false
        if (roleFilter !== 'all' && member.role !== roleFilter) return false
        if (!query) return true
        const teamName = teamById.get(member.team_id)?.name ?? ''
        return [member.name, member.employee_id, member.role, teamName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      })
      .sort((left, right) => {
        const teamOrder = (teamById.get(left.team_id)?.name ?? '').localeCompare(teamById.get(right.team_id)?.name ?? '', 'zh-CN')
        return teamOrder || left.employee_id.localeCompare(right.employee_id, 'zh-CN')
      })
  }, [keyword, members, roleFilter, selectedTeamId, teamById])

  const roleRows = TEAM_ROLES.map((role) => ({ ...role, count: roleCounts.counts.get(role.value) ?? 0 }))
  if (roleCounts.legacy > 0) roleRows.push({ value: '其他', label: '其他（历史）', tone: 'other', count: roleCounts.legacy })
  const maxRoleCount = Math.max(1, ...roleRows.map((role) => role.count))

  function notify(type, text) {
    setNotice({ type, text })
  }

  function openCreateTeam() {
    setTeamEditor({ id: null, name: '' })
  }

  function openEditTeam(team) {
    setTeamEditor({ id: team.id, name: team.name })
  }

  function openCreateMember() {
    if (!visibleTeams.length) {
      notify('warning', '请先创建团队，再新增成员。')
      return
    }
    setMemberEditor({ id: null, team_id: String(selectedTeamId ?? visibleTeams[0].id) })
  }

  async function saveTeam(values) {
    setSubmitting(true)
    try {
      const editing = Boolean(teamEditor?.id)
      await fetchJson(editing ? `/api/teams/${teamEditor.id}` : '/api/teams', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name }),
      })
      setTeamEditor(null)
      notify('success', editing ? '团队已更新。' : '团队已创建。')
      await onRefresh()
    } catch (error) {
      notify('error', teamErrorMessage(error))
      if (error.status === 401) onSessionExpired()
    } finally {
      setSubmitting(false)
    }
  }

  async function saveMember(values) {
    setSubmitting(true)
    try {
      await fetchJson('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      setMemberEditor(null)
      notify('success', '成员已添加。')
      await onRefresh()
    } catch (error) {
      notify('error', teamErrorMessage(error))
      if (error.status === 401) onSessionExpired()
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadTemplate() {
    try {
      await downloadFile('/api/teams/import-template', '团队人员导入模板.xlsx')
    } catch (error) {
      notify('error', '模板下载失败，请稍后重试。')
      if (error.status === 401) onSessionExpired()
    }
  }

  async function exportTeams() {
    setExporting(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await downloadFile('/api/teams/export', `团队人员导出_${today}.xlsx`)
    } catch (error) {
      notify('error', '导出失败，请稍后重试。')
      if (error.status === 401) onSessionExpired()
    } finally {
      setExporting(false)
    }
  }

  function beginEdit(member) {
    if (!canEdit) return
    setEditingId(member.id)
    setDraft({ ...member, team_id: String(member.team_id) })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveEdit() {
    if (!draft) return
    if (!draft.name.trim() || !draft.employee_id.trim() || !draft.role) {
      notify('warning', '姓名、工号和角色不能为空。')
      return
    }
    setSavingMember(draft.id)
    try {
      await fetchJson(`/api/team-members/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: Number(draft.team_id),
          employee_id: draft.employee_id.trim(),
          name: draft.name.trim(),
          role: draft.role,
        }),
      })
      setEditingId(null)
      setDraft(null)
      notify('success', '成员信息已保存。')
      await onRefresh()
    } catch (error) {
      notify('error', teamErrorMessage(error))
      if (error.status === 401) onSessionExpired()
    } finally {
      setSavingMember(null)
    }
  }

  async function removeMember(member) {
    try {
      await fetchJson(`/api/team-members/${member.id}`, { method: 'DELETE' })
      notify('success', '成员已删除。')
      await onRefresh()
    } catch (error) {
      notify('error', teamErrorMessage(error))
      if (error.status === 401) onSessionExpired()
    }
  }

  async function removeTeam(team) {
    try {
      await fetchJson(`/api/teams/${team.id}`, { method: 'DELETE' })
      if (selectedTeamId === team.id) setSelectedTeamId(null)
      notify('success', '团队已删除。')
      await onRefresh()
    } catch (error) {
      notify('error', teamErrorMessage(error))
      if (error.status === 401) onSessionExpired()
    }
  }

  return (
    <div className="team-personnel">
      <PageHeader
        eyebrow="People Directory"
        title="团队与人员"
        description="维护团队和成员主数据；人员信息集中列表呈现，支持行内编辑。产品、版本和迭代请在「产品与版本」页面维护。"
        actions={(
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>
            {canEdit && <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>导入 Excel</Button>}
            <Button icon={<ExportOutlined />} loading={exporting} onClick={exportTeams}>导出 Excel</Button>
            {canEdit && <Button icon={<PlusOutlined />} onClick={openCreateTeam}>新增团队</Button>}
            {canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreateMember}>新增成员</Button> : <Tag>只读</Tag>}
          </Space>
        )}
      />

      {notice && <Alert className="team-personnel__notice" type={notice.type} showIcon closable message={notice.text} onClose={() => setNotice(null)} />}
      {refs.error && <Alert className="team-personnel__notice" type="error" showIcon message="团队人员数据加载失败" description={refs.error.message} />}

      <section className="team-summary" aria-label="团队人员概览">
        <div className="team-summary__cell"><div className="team-summary__label">团队</div><div className="team-summary__value"><strong>{visibleTeams.length}</strong><span>个</span></div><div className="team-summary__note">当前组织下的统计与权限单位</div></div>
        <div className="team-summary__cell"><div className="team-summary__label">成员</div><div className="team-summary__value"><strong>{members.length}</strong><span>人</span></div><div className="team-summary__note">全部团队成员</div></div>
        <div className="team-summary__cell"><div className="team-summary__label">角色</div><div className="team-summary__value"><strong>{standardRoleCount}</strong><span>种</span></div><div className="team-summary__note">SA / SE / MDE / 开发 / 测试</div></div>
        <div className="team-summary__cell"><div className="team-summary__label">平均每队</div><div className="team-summary__value"><strong>{averageMembers}</strong><span>人</span></div><div className="team-summary__note">团队人员分布</div></div>
      </section>

      <div className="team-workspace">
        <aside className="team-panel" aria-label="团队目录">
          <div className="team-panel__head">
            <div><h2 className="team-panel__title">团队</h2><div className="team-panel__meta">{visibleTeams.length} 个团队 · {members.length} 名成员</div></div>
          </div>
          <div className="team-panel__list">
            <div className="team-panel__item team-panel__item--all">
              <button type="button" className={`team-panel__main ${selectedTeamId === null ? 'active' : ''}`} onClick={() => setSelectedTeamId(null)}>
                <span className="team-panel__name">全部团队</span>
                <span className="team-panel__count">{members.length} 名成员</span>
              </button>
            </div>
            {visibleTeams.map((team) => (
              <div key={team.id} className={`team-panel__item ${selectedTeamId === team.id ? 'is-selected' : ''}`}>
                <button type="button" className={`team-panel__main ${selectedTeamId === team.id ? 'active' : ''}`} onClick={() => setSelectedTeamId(team.id)}>
                  <span className="team-panel__name">{team.name}</span>
                  <span className="team-panel__count">{teamCounts.get(team.id) ?? 0} 名成员</span>
                </button>
                {canEdit && (
                  <div className="team-panel__actions">
                    <button type="button" className="team-icon-btn" aria-label={`编辑团队 ${team.name}`} onClick={() => openEditTeam(team)}><EditOutlined /></button>
                    <Popconfirm okText="删除" cancelText="取消" title={`确定删除团队“${team.name}”？`} description="有事实记录或维护者关联时无法删除；删除成功后无法恢复。" onConfirm={() => removeTeam(team)}>
                      <button type="button" className="team-icon-btn team-icon-btn--danger" aria-label={`删除团队 ${team.name}`}><DeleteOutlined /></button>
                    </Popconfirm>
                  </div>
                )}
              </div>
            ))}
            {!visibleTeams.length && <div className="team-panel__empty">暂无团队</div>}
          </div>
          <div className="team-role-block">
            <div className="team-role-block__title">角色分布</div>
            {roleRows.map((role) => (
              <div key={role.value} className="team-role-row">
                <span className="team-role-row__label">{role.label}</span>
                <span className="team-role-row__bar"><i style={{ width: `${Math.max(3, (role.count / maxRoleCount) * 100)}%` }} /></span>
                <span className="team-role-row__count">{role.count}</span>
              </div>
            ))}
          </div>
          <div className="team-panel__note"><strong>团队仅维护名称和成员。</strong>产品、版本和迭代在「产品与版本」页面维护。</div>
        </aside>

        <section className="team-people" aria-labelledby="team-people-title">
          <div className="team-people__head">
            <div className="team-people__head-main"><h2 id="team-people-title">人员列表</h2><span>{filteredMembers.length} 人 · {selectedLabel}</span></div>
            {canEdit && <Button size="small" icon={<PlusOutlined />} onClick={openCreateMember}>新增成员</Button>}
          </div>
          <div className="team-people__toolbar">
            <label className="team-search"><SearchOutlined aria-hidden="true" /><Input variant="borderless" value={keyword} placeholder="搜索姓名或工号" aria-label="搜索姓名或工号" onChange={(event) => setKeyword(event.target.value)} /></label>
            <Select className="team-role-filter" size="small" value={roleFilter} options={roleFilterOptions} aria-label="角色筛选" onChange={setRoleFilter} />
            <span className="team-people__filter-note">当前：{selectedLabel} · {filteredMembers.length} 人</span>
          </div>
          <div className="team-people__table-scroll">
            <Spin spinning={refs.loading}>
              <table className="team-table">
                <colgroup>
                  <col style={{ width: '26%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '26%' }} />
                </colgroup>
                <thead>
                  <tr><th>姓名</th><th>工号</th><th>角色</th><th>所属团队</th><th className="team-table__actions-head">操作</th></tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const isEditing = editingId === member.id
                    return (
                      <tr key={member.id} className={isEditing ? 'is-editing' : ''} onDoubleClick={() => beginEdit(member)}>
                        <td>
                          {isEditing ? (
                            <Input size="small" value={draft.name} aria-label="姓名" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                          ) : (
                            <div className="team-person"><span className="team-person__avatar">{initialOf(member.name)}</span><span className="team-person__name">{member.name}</span></div>
                          )}
                        </td>
                        <td>{isEditing ? <Input size="small" value={draft.employee_id} aria-label="工号" onChange={(event) => setDraft({ ...draft, employee_id: event.target.value })} /> : <span className="team-mono">{member.employee_id}</span>}</td>
                        <td>
                          {isEditing ? (
                            <Select size="small" value={draft.role} options={roleOptions(draft.role)} aria-label="角色" onChange={(value) => setDraft({ ...draft, role: value })} />
                          ) : <RoleTag role={member.role} />}
                        </td>
                        <td>
                          {isEditing ? (
                            <Select size="small" value={draft.team_id} options={visibleTeams.map((team) => ({ value: String(team.id), label: team.name }))} aria-label="所属团队" onChange={(value) => setDraft({ ...draft, team_id: value })} />
                          ) : (
                            <span className="team-cell"><i className="team-cell__dot" />{teamById.get(member.team_id)?.name ?? '—'}</span>
                          )}
                        </td>
                        <td>
                          <div className="team-table__actions">
                            {isEditing ? (
                              <>
                                <Button size="small" type="primary" aria-label={`保存成员 ${member.name}`} loading={savingMember === member.id} onClick={saveEdit}>保存</Button>
                                <Button size="small" aria-label={`取消编辑成员 ${member.name}`} onClick={cancelEdit}>取消</Button>
                              </>
                            ) : canEdit ? (
                              <>
                                <Button size="small" type="link" aria-label={`编辑成员 ${member.name}`} onClick={() => beginEdit(member)}>编辑</Button>
                                <Popconfirm okText="删除" cancelText="取消" title={`确定删除成员“${member.name}”？`} description="删除成功后无法恢复。" onConfirm={() => removeMember(member)}>
                                  <Button size="small" type="link" danger aria-label={`删除成员 ${member.name}`}>删除</Button>
                                </Popconfirm>
                              </>
                            ) : <Text type="secondary">只读</Text>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!filteredMembers.length && <div className="team-people__empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前筛选条件下没有成员。" /></div>}
            </Spin>
          </div>
          <div className="team-people__foot"><span>共 <strong>{filteredMembers.length}</strong> 名成员 · {selectedLabel}；双击行或点击“编辑”可修改姓名、工号、角色和所属团队。</span><span>只展示团队人员主数据</span></div>
        </section>
      </div>

      <TeamDialog editor={teamEditor} onClose={() => setTeamEditor(null)} onSubmit={saveTeam} submitting={submitting} />
      <MemberDialog editor={memberEditor} teams={visibleTeams} defaultTeamId={selectedTeamId ?? visibleTeams[0]?.id} onClose={() => setMemberEditor(null)} onSubmit={saveMember} submitting={submitting} />
      <TeamImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={onRefresh}
        onSessionExpired={onSessionExpired}
      />
    </div>
  )
}
