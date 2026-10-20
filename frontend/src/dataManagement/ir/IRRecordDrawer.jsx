import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Divider, Form, Input, InputNumber, Select, Space, Spin, Tag, Typography } from 'antd'

import { fetchJson } from '../../api'
import FocusRestoringDrawer from '../../components/FocusRestoringDrawer'
import {
  IR_AI_MODE_SUGGESTIONS,
  IR_PROGRESS_OPTIONS,
  IR_QUALITY_OPTIONS,
  irPersonText,
  parseOwnerText,
} from './irFields'

const { Text } = Typography

const EMPTY_FORM = {
  requirement_no: '',
  requirement_name: '',
  business_module: '',
  progress: '未开始',
  team_id: '',
  version_id: '',
  iteration_id: '',
  sa_owner_text: '',
  se_owner_text: '',
  sa_estimated_workload: null,
  sa_actual_workload: null,
  se_estimated_workload: null,
  se_actual_workload: null,
  ai_quality_level: '',
  ai_applicability: '',
  sa_ai_assisted: '',
  se_ai_assisted: '',
  ai_dev_mode: '',
  completed_at: '',
  remark: '',
}

const BOOL_FORM_OPTIONS = [
  { value: '', label: '待维护' },
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
]

function boolToForm(value) {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}

function formToBool(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function formatTimestamp(value) {
  if (!value) return '—'
  const text = String(value)
  return text.includes('T') ? `${text.slice(0, 10)} ${text.slice(11, 19)}` : text
}

const AUDIT_ACTIONS = {
  create: '新增',
  update: '编辑',
  bulk_update: '批量编辑',
  import_confirm: '导入确认',
  collector_confirm: '采集确认',
}

function formFromRecord(record, refs, user) {
  if (!record) {
    const teamId = user.role === 'maintainer'
      ? String(user.maintainer_team_id)
      : String(refs.teams[0]?.id ?? '')
    return { ...EMPTY_FORM, team_id: teamId }
  }
  return {
    requirement_no: record.requirement_no ?? '',
    requirement_name: record.requirement_name ?? '',
    business_module: record.business_module ?? '',
    progress: record.progress ?? '未开始',
    team_id: String(record.team_id ?? ''),
    version_id: String(record.version_id ?? ''),
    iteration_id: String(record.iteration_id ?? ''),
    sa_owner_text: irPersonText(record.sa_owner_name || record.sa_employee_name, record.sa_employee_id),
    se_owner_text: irPersonText(record.se_owner_name || record.se_employee_name, record.se_employee_id),
    sa_estimated_workload: record.sa_estimated_workload ?? null,
    sa_actual_workload: record.sa_actual_workload ?? null,
    se_estimated_workload: record.se_estimated_workload ?? null,
    se_actual_workload: record.se_actual_workload ?? null,
    ai_quality_level: record.ai_quality_level ?? '',
    ai_applicability: boolToForm(record.ai_applicability),
    sa_ai_assisted: boolToForm(record.sa_ai_assisted),
    se_ai_assisted: boolToForm(record.se_ai_assisted),
    ai_dev_mode: record.ai_dev_mode ?? '',
    completed_at: record.completed_at ?? '',
    remark: record.remark ?? '',
  }
}

export default function IRRecordDrawer({ editor, refs, user, onClose, onSaved, onSessionExpired }) {
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
    form.setFieldsValue(formFromRecord(editor.record, refs, user))
    setError(null)
  }, [editor, form, refs.teams, user.role, user.maintainer_team_id])

  useEffect(() => {
    if (!record?.id) {
      setAuditLogs([])
      return undefined
    }
    let active = true
    setAuditLoading(true)
    fetchJson(`/api/data/ir/${record.id}/audit-logs`)
      .then((data) => { if (active) setAuditLogs(Array.isArray(data) ? data : []) })
      .catch((nextError) => {
        if (active) setAuditLogs([])
        if (nextError.status === 401) onSessionExpired()
      })
      .finally(() => { if (active) setAuditLoading(false) })
    return () => { active = false }
  }, [record?.id, onSessionExpired])

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
      if (!version) throw new Error('请选择 PI')
      const sa = parseOwnerText(values.sa_owner_text)
      const se = parseOwnerText(values.se_owner_text)
      const payload = {
        requirement_type: 'IR',
        requirement_no: values.requirement_no.trim(),
        requirement_name: values.requirement_name.trim(),
        business_module: values.business_module.trim(),
        progress: values.progress || null,
        product_id: version.product_id,
        version_id: Number(values.version_id),
        iteration_id: Number(values.iteration_id),
        completed_at: values.completed_at,
        sa_owner_name: sa.name,
        sa_employee_id: sa.employeeId,
        se_owner_name: se.name,
        se_employee_id: se.employeeId,
        sa_estimated_workload: numberOrNull(values.sa_estimated_workload),
        sa_actual_workload: numberOrNull(values.sa_actual_workload),
        se_estimated_workload: numberOrNull(values.se_estimated_workload),
        se_actual_workload: numberOrNull(values.se_actual_workload),
        ai_quality_level: values.ai_quality_level || null,
        ai_applicability: formToBool(values.ai_applicability),
        sa_ai_assisted: formToBool(values.sa_ai_assisted),
        se_ai_assisted: formToBool(values.se_ai_assisted),
        ai_dev_mode: values.ai_dev_mode?.trim() || null,
        remark: values.remark?.trim() || null,
      }
      await fetchJson(record ? `/api/data/ir/${record.id}` : '/api/data/ir', {
        method: record ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      onSaved(record ? 'IR 需求已更新。' : 'IR 需求已创建。')
    } catch (nextError) {
      if (nextError.status === 401) onSessionExpired()
      setError(nextError.message || '保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FocusRestoringDrawer
      rootClassName="ir-record-drawer"
      title={record ? `编辑 IR · ${record.requirement_no}` : '新增 IR 需求'}
      open={Boolean(editor)}
      size={820}
      onClose={onClose}
      destroyOnClose
      footer={(
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>保存需求</Button>
        </Space>
      )}
    >
      {error && <Alert className="ir-drawer__error" type="error" showIcon message={error} />}
      <Form noValidate form={form} layout="vertical" onFinish={save} initialValues={EMPTY_FORM}>
        <Divider titlePlacement="left" plain>需求信息</Divider>
        <div className="ir-form-grid">
          <Form.Item label="需求类型"><Tag className="ir-tag ir-tag--neutral">IR</Tag></Form.Item>
          <Form.Item name="requirement_no" label="需求编号" rules={[{ required: true, message: '请输入需求编号' }]}>
            <Input disabled={Boolean(record)} placeholder="IR20260709000000" />
          </Form.Item>
          <Form.Item name="requirement_name" label="需求标题" rules={[{ required: true, message: '请输入需求标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="business_module" label="所属功能" rules={[{ required: true, message: '请输入所属功能' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="progress" label="进展" rules={[{ required: true, message: '请选择进展' }]}>
            <Select options={IR_PROGRESS_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} />
          </Form.Item>
        </div>

        <Divider titlePlacement="left" plain>归属</Divider>
        <div className="ir-form-grid">
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

        <Divider titlePlacement="left" plain>责任人</Divider>
        <div className="ir-form-grid">
          <Form.Item name="sa_owner_text" label="SA（可选）" extra="填写“姓名 工号”，工号未匹配只警告">
            <Input placeholder="XXX 00123456" />
          </Form.Item>
          <Form.Item
            name="se_owner_text"
            label="SE"
            rules={record ? [] : [{ required: true, message: '请填写 SE' }]}
            extra={record ? '填写“姓名 工号”；旧数据可先留空，后续待补充' : '新增时必填，填写“姓名 工号”'}
          >
            <Input placeholder="YYY 00654321" />
          </Form.Item>
        </div>

        <Divider titlePlacement="left" plain>工作量（人天）</Divider>
        <div className="ir-form-grid ir-form-grid--four">
          <Form.Item name="sa_estimated_workload" label="预估工作量(SA)"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="sa_actual_workload" label="实际工作量(SA)"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="se_estimated_workload" label="预估工作量(SE)"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="se_actual_workload" label="实际工作量(SE)"><InputNumber min={0} step="any" style={{ width: '100%' }} /></Form.Item>
        </div>

        <Divider titlePlacement="left" plain>AI 属性</Divider>
        <div className="ir-form-grid">
          <Form.Item name="ai_quality_level" label="AI质检等级">
            <Select allowClear options={IR_QUALITY_OPTIONS.map((item) => ({ value: item.value, label: item.label }))} />
          </Form.Item>
          <Form.Item name="ai_applicability" label="AI适用性"><Select options={BOOL_FORM_OPTIONS} /></Form.Item>
          <Form.Item name="sa_ai_assisted" label="SA是否使用AI"><Select options={BOOL_FORM_OPTIONS} /></Form.Item>
          <Form.Item name="se_ai_assisted" label="SE是否使用AI"><Select options={BOOL_FORM_OPTIONS} /></Form.Item>
          <Form.Item name="ai_dev_mode" label="AI研发模式">
            <Input list="ir-ai-mode-options" placeholder="设计开发一体化 / 超级单兵 / 全栈开发" />
          </Form.Item>
          <datalist id="ir-ai-mode-options">
            {IR_AI_MODE_SUGGESTIONS.map((item) => <option key={item} value={item} />)}
          </datalist>
        </div>

        <Divider titlePlacement="left" plain>时间与备注</Divider>
        <div className="ir-form-grid">
          <Form.Item name="completed_at" label="设计时间" rules={[{ required: true, message: '请选择设计时间' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={3} maxLength={2000} showCount /></Form.Item>
        </div>
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
                  <Text type="secondary">{formatTimestamp(log.created_at)}</Text>
                </div>
                {log.changes && (
                  <Text type="secondary" className="ir-audit__changes">
                    {Object.keys(log.changes).map((field) => field).join('、')}
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
