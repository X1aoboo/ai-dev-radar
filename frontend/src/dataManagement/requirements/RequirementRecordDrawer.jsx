import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Divider, Form, Input, InputNumber, Select, Space, Spin, Tag, Typography } from 'antd'

import { fetchJson } from '../../api'
import FocusRestoringDrawer from '../../components/FocusRestoringDrawer'
import {
  BOOL_FORM_OPTIONS,
  formatRequirementTimestamp,
} from './requirementProfiles'

const { Text } = Typography

const AUDIT_ACTIONS = {
  create: '新增',
  update: '编辑',
  bulk_update: '批量编辑',
  import_confirm: '导入确认',
  collector_confirm: '采集确认',
}

const OWNER_DISPLAY_KEYS = new Set(['team_name', 'version_name', 'iteration_name'])

function fieldOptions(field) {
  return (field.options ?? []).map((option) => (typeof option === 'string'
    ? { value: option, label: option }
    : { value: option.value, label: option.label }))
}

export default function RequirementRecordDrawer({ profile, editor, refs, user, readOnly = false, onClose, onSaved, onSessionExpired }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const record = editor?.record ?? null
  const teamId = Form.useWatch('team_id', form)
  const versionId = Form.useWatch('version_id', form)

  useEffect(() => {
    if (!editor) return
    form.setFieldsValue(profile.formFromRecord(editor.record, refs, user))
    setError(null)
  }, [editor, form, profile, refs.teams, user.role, user.maintainer_team_id])

  useEffect(() => {
    if (!record?.id) {
      setAuditLogs([])
      return undefined
    }
    let active = true
    setAuditLoading(true)
    fetchJson(`${profile.apiBase}/${record.id}/audit-logs`)
      .then((data) => { if (active) setAuditLogs(Array.isArray(data) ? data : []) })
      .catch((nextError) => {
        if (active) setAuditLogs([])
        if (nextError.status === 401) onSessionExpired()
      })
      .finally(() => { if (active) setAuditLoading(false) })
    return () => { active = false }
  }, [profile.apiBase, record?.id, onSessionExpired])

  const versions = useMemo(() => {
    const teamProducts = refs.products.filter((product) => String(product.team_id) === String(teamId))
    const productIds = new Set(teamProducts.map((product) => product.id))
    return refs.versions.filter((version) => productIds.has(version.product_id))
  }, [refs.products, refs.versions, teamId])
  const selectedVersion = refs.versions.find((version) => String(version.id) === String(versionId))
  const iterations = selectedVersion?.iterations ?? []

  async function save(values) {
    setSaving(true)
    setError(null)
    try {
      const version = refs.versions.find((item) => String(item.id) === String(values.version_id))
      const payload = profile.payloadFromForm(values, { version })
      await fetchJson(record ? `${profile.apiBase}/${record.id}` : profile.apiBase, {
        method: record ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onSaved(record ? `${profile.recordLabel}已更新。` : `${profile.recordLabel}已创建。`)
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setError(nextError.message || '保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  function requiredRule(field) {
    if (!field.required) return []
    if (record && profile.key === 'design' && field.key === 'progress') return []
    return [{ required: true, message: `${field.type === 'enum' ? '请选择' : '请输入'}${field.label}` }]
  }

  function textControl(field) {
    if (field.key === 'remark') return <Input.TextArea rows={3} maxLength={2000} showCount />
    if (field.key === 'ai_dev_mode') {
      return <Input list={`${profile.key}-ai-mode-options`} placeholder={profile.aiModeSuggestions.slice(0, 3).join(' / ')} />
    }
    if (field.key === 'requirement_no') {
      return <Input disabled={Boolean(record)} placeholder="IR20260709000000" />
    }
    return <Input />
  }

  function fieldControl(field) {
    if (field.type === 'enum') {
      return <Select allowClear={!field.required} options={fieldOptions(field)} />
    }
    if (field.type === 'bool') return <Select options={BOOL_FORM_OPTIONS} />
    if (field.type === 'number') return <InputNumber min={0} step="any" style={{ width: '100%' }} />
    if (field.type === 'date') return <Input type="date" />
    return textControl(field)
  }

  function renderGroupFields(group) {
    if (group.key === 'ownership') {
      return (
        <div className="ir-form-grid" key="ownership">
          <Form.Item name="team_id" label="归属组" rules={[{ required: true, message: '请选择归属组' }]}>
            <Select
              disabled={user.role === 'maintainer'}
              options={refs.teams.map((team) => ({ value: String(team.id), label: team.name }))}
              onChange={() => form.setFieldsValue({ version_id: '', iteration_id: '' })}
            />
          </Form.Item>
          <Form.Item name="version_id" label="PI" rules={[{ required: true, message: '请选择 PI' }]}>
            <Select
              options={versions.map((version) => ({ value: String(version.id), label: version.name }))}
              onChange={() => form.setFieldsValue({ iteration_id: '' })}
            />
          </Form.Item>
          <Form.Item name="iteration_id" label="迭代" rules={[{ required: true, message: '请选择迭代' }]}>
            <Select options={iterations.map((iteration) => ({ value: String(iteration.id), label: iteration.name }))} />
          </Form.Item>
        </div>
      )
    }
    if (group.key === 'people') {
      return (
        <div className="ir-form-grid" key="people">
          {profile.ownerSpecs.map((spec) => (
            <Form.Item
              key={spec.key}
              name={spec.formKey}
              label={spec.label}
              rules={record && profile.key !== 'development' ? [] : (spec.required ? [{ required: true, message: `请填写${spec.label}` }] : [])}
              extra={profile.key === 'development' ? '填写“姓名 工号”，工号未匹配只警告' : record ? '历史数据可先留空，后续补充' : '填写“姓名 工号”，工号未匹配只警告'}
            >
              <Input placeholder={spec.placeholder} />
            </Form.Item>
          ))}
        </div>
      )
    }
    const groupFields = profile.fields
      .filter((field) => field.group === group.key && !OWNER_DISPLAY_KEYS.has(field.key))
    if (!groupFields.length) return null
    return (
      <div className={`ir-form-grid${group.key === 'workload' ? ' ir-form-grid--four' : ''}`} key={group.key}>
        {groupFields.map((field) => (
          <Form.Item
            key={field.key}
            name={field.key}
            label={field.label}
            rules={requiredRule(field)}
            extra={field.key === 'ai_dev_mode' ? '自由文本；可使用建议值或手工填写' : undefined}
          >
            {fieldControl(field)}
          </Form.Item>
        ))}
        {group.key === 'ai' && (
          <datalist id={`${profile.key}-ai-mode-options`}>
            {profile.aiModeSuggestions.map((item) => <option key={item} value={item} />)}
          </datalist>
        )}
      </div>
    )
  }

  return (
    <FocusRestoringDrawer
      rootClassName="ir-record-drawer"
      title={record ? `编辑${profile.recordLabel} · ${record.requirement_no}` : `新增${profile.recordLabel}`}
      open={Boolean(editor)}
      size={820}
      onClose={onClose}
      destroyOnClose
      footer={(
        <Space>
          <Button onClick={onClose}>{readOnly ? '关闭' : '取消'}</Button>
          {!readOnly && <Button type="primary" loading={saving} onClick={() => form.submit()}>保存需求</Button>}
        </Space>
      )}
    >
      {error && <Alert className="ir-drawer__error" type="error" showIcon message={error} />}
      <Form noValidate form={form} layout="vertical" disabled={readOnly} onFinish={save} initialValues={profile.formFromRecord(null, refs, user)}>
        {profile.groups.map((group) => {
          const content = renderGroupFields(group)
          if (!content) return null
          return <React.Fragment key={group.key}><Divider titlePlacement="left" plain>{group.label}</Divider>{content}</React.Fragment>
        })}
      </Form>

      {record && (
        <section className="ir-audit" aria-label="变更记录">
          <div className="ir-audit__heading">
            <Text strong>变更记录</Text>
            {auditLoading && <Spin size="small" />}
          </div>
          {!auditLoading && !auditLogs.length && <Text type="secondary">暂无变更记录。</Text>}
          {auditLogs.slice(0, 12).map((log) => (
            <div key={log.id} className="ir-audit__item">
              <span className="ir-audit__dot" aria-hidden="true" />
              <div>
                <div className="ir-audit__line">
                  <Text strong>{AUDIT_ACTIONS[log.action] ?? log.action}</Text>
                  <Text type="secondary">{log.actor}</Text>
                  <Text type="secondary">{formatRequirementTimestamp(log.created_at)}</Text>
                </div>
                {log.changes && (
                  <Text type="secondary" className="ir-audit__changes">
                    {Object.keys(log.changes).map((field) => profile.fieldLabels[field] ?? profile.ownerLabels[field] ?? field).join('、')}
                  </Text>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </FocusRestoringDrawer>
  )
}
