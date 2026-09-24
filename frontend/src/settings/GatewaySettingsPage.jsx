import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, ConfigProvider, Drawer, Form, Input, InputNumber, Popconfirm, Space, Spin, Tag, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import { fetchJson } from '../api'
import PageHeader from '../components/PageHeader'
import '../dataManagement/dataManagement.css'
import { formatGatewayDate, gatewayStatusInfo } from './gatewayStatus'

const { Text } = Typography
const FormItem = Form.Item

function GatewayHealth({ health, testId }) {
  const info = gatewayStatusInfo(health?.status)
  const hasLastKnown = health?.status === 'UNKNOWN' && health?.last_known_status
  return (
    <div className="gateway-health">
      <Tag data-testid={testId} color={info.color}>{health?.stale ? '状态已过期' : info.label}</Tag>
      {hasLastKnown && <Text type="secondary">上次状态：{gatewayStatusInfo(health.last_known_status).label}</Text>}
      {health?.error_message && <Text type="secondary">{health.error_message}</Text>}
      <Text type="secondary">最近检测：{formatGatewayDate(health?.checked_at)}</Text>
      {health?.latency_ms !== null && health?.latency_ms !== undefined && <Text type="secondary">响应 {health.latency_ms} ms</Text>}
    </div>
  )
}

function ConfigurationDetails({ configuration }) {
  return (
    <dl className="gateway-details">
      <div><dt>Gateway 地址</dt><dd>{configuration.base_url}</dd></div>
      <div><dt>协议版本</dt><dd>{configuration.health?.contract_version ?? '尚未检测'}</dd></div>
      <div><dt>请求超时</dt><dd>{configuration.request_timeout_seconds} 秒</dd></div>
      <div><dt>Token</dt><dd>{configuration.token_configured ? '已配置' : '未配置'}</dd></div>
      <div><dt>最近更新</dt><dd>{configuration.updated_by} · {formatGatewayDate(configuration.updated_at)}</dd></div>
    </dl>
  )
}

function GatewayConfigDrawer({ open, seed, tokenRequired, submitting, onClose, onSubmit }) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({
      base_url: seed?.base_url ?? '',
      request_timeout_seconds: seed?.request_timeout_seconds ?? 30,
      bearer_token: '',
    })
  }, [form, open, seed])

  async function submit(values) {
    const saved = await onSubmit(values)
    if (!saved) form.setFieldValue('bearer_token', '')
  }

  return (
    <ConfigProvider locale={zhCN}>
      <Drawer
        rootClassName="gateway-editor-drawer"
        title={seed?.draft ? '编辑待启用配置' : seed?.active ? '编辑 Gateway 配置' : '配置 Gateway'}
        open={open}
        size={440}
        destroyOnClose
        onClose={onClose}
        styles={{ body: { padding: 24 } }}
        footer={<Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={() => form.submit()}>保存草稿</Button></Space>}
      >
        <Form noValidate form={form} layout="vertical" onFinish={submit}>
        <FormItem
          name="base_url"
          label="Gateway 地址"
          rules={[{ required: true, message: '请输入 Gateway 根地址。' }]}
          extra="只填写根地址，例如 https://gateway.example；生产环境必须使用 HTTPS。"
        >
          <Input type="url" autoComplete="url" placeholder="https://gateway.example" />
        </FormItem>
        <FormItem
          name="bearer_token"
          label="Bearer Token"
          rules={[
            ...(tokenRequired ? [{ required: true, message: '首次配置必须输入 Token。' }] : []),
            { max: 4096, message: 'Token 长度不能超过 4096 个字符。' },
          ]}
          extra={tokenRequired ? '首次配置需要输入 Token。保存后不会回填。' : '留空表示沿用当前 Active Token；保存后不会回填。'}
        >
          <Input.Password maxLength={4096} autoComplete="new-password" placeholder={tokenRequired ? '输入 Gateway Token' : '留空沿用 Active Token'} />
        </FormItem>
        <FormItem
          name="request_timeout_seconds"
          label="请求超时（秒）"
          rules={[{ required: true, message: '请输入请求超时时间。' }, { type: 'number', min: 0.01, message: '请求超时必须大于 0。' }]}
        >
          <InputNumber min={0.01} step={1} precision={2} style={{ width: '100%' }} />
        </FormItem>
        </Form>
      </Drawer>
    </ConfigProvider>
  )
}

function actionLabel(action) {
  return ({
    DRAFT_SAVED: '保存草稿',
    CONNECTION_TESTED: '测试连接',
    DRAFT_ACTIVATED: '启用配置',
    DRAFT_DISCARDED: '放弃草稿',
  })[action] ?? action
}

function auditSummary(changes = {}) {
  const details = []
  if (changes.base_url) details.push(`地址：${changes.base_url.to}`)
  if (changes.request_timeout_seconds) details.push(`超时：${changes.request_timeout_seconds.to} 秒`)
  if (typeof changes.token_changed === 'boolean') details.push(changes.token_changed ? 'Token 已更换' : '沿用当前 Token')
  if (changes.activation_check) details.push('启用前实时检测')
  if (changes.previous_active_config_id) details.push(`替换配置 #${changes.previous_active_config_id}`)
  if (changes.result_discarded) details.push('配置在检测期间发生变化，结果已丢弃')
  return details.join(' · ') || '无配置字段变更'
}

export default function GatewaySettingsPage({ onSessionExpired }) {
  const [gateway, setGateway] = useState({ active: null, draft: null })
  const [gatewayLoaded, setGatewayLoaded] = useState(false)
  const [audits, setAudits] = useState([])
  const [auditError, setAuditError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSeed, setEditorSeed] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(null)
  const [activating, setActivating] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    const [stateResult, auditResult] = await Promise.allSettled([
      fetchJson('/api/gateway'),
      fetchJson('/api/gateway/audits?limit=50'),
    ])
    if (stateResult.status === 'fulfilled') {
      setGateway({ active: stateResult.value.active ?? null, draft: stateResult.value.draft ?? null })
      setGatewayLoaded(true)
    } else {
      setNotice({ type: 'error', text: stateResult.reason.message })
      if (stateResult.reason.status === 401) onSessionExpired()
    }
    if (auditResult.status === 'fulfilled') {
      setAudits(auditResult.value)
      setAuditError(null)
    } else {
      setAuditError(auditResult.reason.message)
      if (auditResult.reason.status === 401) onSessionExpired()
    }
    if (clearNotice && stateResult.status === 'fulfilled') setNotice(null)
    setLoading(false)
  }, [onSessionExpired])

  useEffect(() => { load() }, [load])

  function openEditor() {
    setEditorSeed({
      active: gateway.active,
      draft: gateway.draft,
      base_url: gateway.draft?.base_url ?? gateway.active?.base_url ?? '',
      request_timeout_seconds: gateway.draft?.request_timeout_seconds ?? gateway.active?.request_timeout_seconds ?? 30,
    })
    setEditorOpen(true)
  }

  async function saveDraft(values) {
    setSaving(true)
    try {
      await fetchJson('/api/gateway/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: values.base_url.trim(),
          bearer_token: values.bearer_token ?? '',
          request_timeout_seconds: Number(values.request_timeout_seconds),
        }),
      })
      setEditorOpen(false)
      setNotice({ type: 'success', text: 'Gateway 草稿已保存。测试连接通过后才能启用。' })
      await load({ clearNotice: false })
      return true
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
      return false
    } finally {
      setSaving(false)
    }
  }

  async function testConnection(scope) {
    setTesting(scope)
    try {
      const data = await fetchJson(`/api/gateway/${scope}/check`, { method: 'POST' })
      setGateway({ active: data.active ?? null, draft: data.draft ?? null })
      const info = gatewayStatusInfo(data[scope]?.health?.status)
      setNotice({ type: data[scope]?.health?.status === 'CONNECTED' ? 'success' : 'warning', text: `连接检测完成：${info.label}。` })
      await load({ clearNotice: false })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally {
      setTesting(null)
    }
  }

  async function activateDraft() {
    setActivating(true)
    try {
      await fetchJson('/api/gateway/draft/activate', { method: 'POST' })
      setNotice({ type: 'success', text: 'Gateway 配置已启用。' })
      await load({ clearNotice: false })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
      await load({ clearNotice: false })
    } finally {
      setActivating(false)
    }
  }

  async function discardDraft() {
    setDiscarding(true)
    try {
      await fetchJson('/api/gateway/draft', { method: 'DELETE' })
      setNotice({ type: 'success', text: 'Gateway 草稿已放弃。当前 Active 配置未更改。' })
      await load({ clearNotice: false })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally {
      setDiscarding(false)
    }
  }

  const activeStatus = gateway.active?.health?.status
  const draftStatus = gateway.draft?.health?.status

  return (
    <div className="settings-page gateway-settings-page">
      <PageHeader
        title="数据网关"
        description="管理 Radar 调用的 AI 研发数据网关连接，并在启用前验证候选配置。"
        actions={gatewayLoaded && !gateway.draft && <Button type="primary" onClick={openEditor}>{gateway.active ? '编辑配置' : '配置 Gateway'}</Button>}
      />
      {notice && <Alert className="settings-page__notice" type={notice.type} showIcon message={notice.text} />}

      {!gatewayLoaded ? <div className="workbench-state">{loading ? <Spin size="small" /> : null}<Text type="secondary">{loading ? '读取 Gateway 配置…' : '无法读取 Gateway 配置。'}</Text></div> : <>
        <Card title="当前连接" extra={<Tag color={gatewayStatusInfo(activeStatus ?? 'UNCONFIGURED').color}>{gatewayStatusInfo(activeStatus ?? 'UNCONFIGURED').label}</Tag>}>
          {gateway.active ? <>
            <GatewayHealth health={gateway.active.health} testId="gateway-active-status" />
            <ConfigurationDetails configuration={gateway.active} />
            <Space wrap>
              <Button loading={testing === 'active'} disabled={Boolean(testing)} onClick={() => testConnection('active')}>立即检测</Button>
            </Space>
          </> : <div className="gateway-empty">
            <Text>尚未配置 AI 研发数据网关。</Text>
            <Text type="secondary">保存候选配置后，测试连接并启用才会影响 IR 采集。</Text>
            <Button type="primary" onClick={openEditor}>配置 Gateway</Button>
          </div>}
        </Card>

        {gateway.draft && <Card className="workbench-section-gap" title="待启用配置" extra={<Tag color={gatewayStatusInfo(draftStatus).color}>{gatewayStatusInfo(draftStatus).label}</Tag>}>
          <GatewayHealth health={gateway.draft.health} testId="gateway-draft-status" />
          <ConfigurationDetails configuration={gateway.draft} />
          <div className="gateway-actions">
            <Space wrap>
              <Button onClick={openEditor}>编辑草稿</Button>
              <Button loading={testing === 'draft'} disabled={Boolean(testing) || activating} onClick={() => testConnection('draft')}>测试连接</Button>
              <Button type="primary" loading={activating} disabled={draftStatus !== 'CONNECTED' || Boolean(testing)} onClick={activateDraft}>启用配置</Button>
            </Space>
            {draftStatus !== 'CONNECTED' && <Text type="secondary">只有最新检测结果为“已连接”时才能启用；启用时还会再次检测。</Text>}
            <Popconfirm open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen} title="放弃待启用配置？" description="草稿和最近测试状态将被删除；当前 Active 配置不变。" okText="放弃草稿" cancelText="继续编辑" onConfirm={() => { setDiscardConfirmOpen(false); discardDraft() }}>
              <Button danger type="link" loading={discarding} onClick={() => setDiscardConfirmOpen(true)}>放弃草稿</Button>
            </Popconfirm>
          </div>
        </Card>}

        <Card className="workbench-section-gap" title="配置操作记录" extra={<Text type="secondary">最近 50 条 · 北京时间</Text>}>
          {auditError ? <Alert type="error" showIcon message={auditError} /> : audits.length === 0 ? <Text type="secondary">暂无配置操作记录。</Text> : <ul className="gateway-audit-list">
            {audits.map((audit) => <li key={audit.id}>
              <div className="gateway-audit-item__heading">
                <Text strong>{actionLabel(audit.action)}</Text>
                {audit.result_status && <Tag color={gatewayStatusInfo(audit.result_status).color}>{gatewayStatusInfo(audit.result_status).label}</Tag>}
                <Text type="secondary">{audit.actor} · {formatGatewayDate(audit.created_at)}</Text>
              </div>
              <Text type="secondary">{auditSummary(audit.changes)}</Text>
            </li>)}
          </ul>}
        </Card>
      </>}

      <GatewayConfigDrawer
        open={editorOpen}
        seed={editorSeed}
        tokenRequired={!gateway.active?.token_configured}
        submitting={saving}
        onClose={() => setEditorOpen(false)}
        onSubmit={saveDraft}
      />
    </div>
  )
}
