import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Spin, Tag, Typography } from 'antd'

import { fetchJson } from '../api'
import PageHeader from '../components/PageHeader'
import { formatGatewayDate, gatewayStatusInfo } from './gatewayStatus'
import './admin-pages.css'

const { Text } = Typography

function GatewayHealth({ health, testId }) {
  const info = gatewayStatusInfo(health?.status)
  const hasLastKnown = health?.status === 'UNKNOWN' && health?.last_known_status
  return (
    <div className="admin-health">
      <Tag data-testid={testId} color={info.color}>{health?.stale ? '状态已过期' : info.label}</Tag>
      {hasLastKnown && <Text type="secondary">上次状态：{gatewayStatusInfo(health.last_known_status).label}</Text>}
      {health?.error_message && <Text type="secondary">{health.error_message}</Text>}
      <span className="admin-health__meta">最近检测：{formatGatewayDate(health?.checked_at)}</span>
      {health?.latency_ms !== null && health?.latency_ms !== undefined && <span className="admin-health__meta">响应 {health.latency_ms} ms</span>}
    </div>
  )
}

function ConfigurationDetails({ configuration }) {
  return (
    <div className="admin-detail-grid">
      <div className="admin-detail"><div className="admin-detail__label">Gateway 地址</div><div className="admin-detail__value admin-detail__value--mono">{configuration.base_url}</div></div>
      <div className="admin-detail"><div className="admin-detail__label">协议版本</div><div className="admin-detail__value">{configuration.health?.contract_version ?? '尚未检测'}</div></div>
      <div className="admin-detail"><div className="admin-detail__label">请求超时</div><div className="admin-detail__value">{configuration.request_timeout_seconds} 秒</div></div>
      <div className="admin-detail"><div className="admin-detail__label">Bearer Token</div><div className="admin-detail__value">{configuration.token_configured ? '已配置（不回填）' : '未配置'}</div></div>
      <div className="admin-detail"><div className="admin-detail__label">最近更新</div><div className="admin-detail__value">{configuration.updated_by} · {formatGatewayDate(configuration.updated_at)}</div></div>
      <div className="admin-detail"><div className="admin-detail__label">配置 ID</div><div className="admin-detail__value admin-detail__value--mono">#{configuration.id}</div></div>
    </div>
  )
}

function GatewayConfigModal({ open, seed, tokenRequired, submitting, onClose, onSubmit }) {
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
    <Modal
      className="admin-modal gateway-config-modal"
      open={open}
      title={seed?.draft ? '编辑待启用配置' : seed?.active ? '编辑 Gateway 配置' : '配置 Gateway'}
      width={560}
      okText="保存草稿"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form noValidate form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="base_url"
          label="Gateway 地址"
          rules={[{ required: true, message: '请输入 Gateway 根地址。' }]}
          extra="只填写根地址，例如 https://gateway.example；生产环境必须使用 HTTPS。"
        >
          <Input type="url" autoComplete="url" placeholder="https://gateway.example" />
        </Form.Item>
        <Form.Item
          name="bearer_token"
          label="Bearer Token"
          rules={[
            ...(tokenRequired ? [{ required: true, message: '首次配置必须输入 Token。' }] : []),
            { max: 4096, message: 'Token 长度不能超过 4096 个字符。' },
          ]}
          extra={tokenRequired ? '首次配置需要输入 Token。保存后不会回填。' : '留空表示沿用当前 Active Token；保存后不会回填。'}
        >
          <Input.Password maxLength={4096} autoComplete="new-password" placeholder={tokenRequired ? '输入 Gateway Token' : '留空沿用 Active Token'} />
        </Form.Item>
        <Form.Item
          name="request_timeout_seconds"
          label="请求超时（秒）"
          rules={[{ required: true, message: '请输入请求超时时间。' }, { type: 'number', min: 0.01, message: '请求超时必须大于 0。' }]}
        >
          <InputNumber min={0.01} step={1} precision={2} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
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

  const active = gateway.active
  const draft = gateway.draft
  const activeStatus = active?.health?.status
  const draftStatus = draft?.health?.status
  const activeInfo = gatewayStatusInfo(activeStatus ?? 'UNCONFIGURED')

  const checklist = draft ? [
    { title: 'Readiness 可用', note: draftStatus === 'CONNECTED' ? '最近一次 readiness 返回 ready' : `当前状态：${gatewayStatusInfo(draftStatus).label}`, ok: draftStatus === 'CONNECTED' },
    { title: '服务身份匹配', note: draft.health?.service_id ? `service = ${draft.health.service_id}` : '尚未检测到服务标识', ok: Boolean(draft.health?.service_id) },
    { title: '协议主版本兼容', note: draft.health?.contract_version ? `contract ${draft.health.contract_version}` : '尚未检测到协议版本', ok: Boolean(draft.health?.contract_version) },
  ] : []

  return (
    <div className="admin-page">
      <PageHeader
        title="数据网关"
        description="管理 Radar 调用的 AI 研发数据网关连接，并在启用前验证候选配置。采集任务只读取这里的就绪状态，不复制连接配置。"
        actions={gatewayLoaded && !draft ? <Button type="primary" onClick={openEditor}>{active ? '编辑配置' : '配置 Gateway'}</Button> : null}
      />
      {notice && <Alert className="settings-page__notice" type={notice.type} showIcon message={notice.text} />}

      {!gatewayLoaded ? (
        <div className="admin-empty"><Spin size="small" /><Text type="secondary">{loading ? '读取 Gateway 配置…' : '无法读取 Gateway 配置。'}</Text></div>
      ) : (
        <>
          <section className="admin-summary" aria-label="Gateway 概览">
            <div className="admin-summary__cell"><div className="admin-summary__label">当前连接</div><div className="admin-summary__value"><Tag color={activeInfo.color}>{active ? activeInfo.label : '未配置'}</Tag></div><div className="admin-summary__note">{active ? 'AI 研发数据网关 · Active' : '尚未配置 Gateway'}</div></div>
            <div className="admin-summary__cell"><div className="admin-summary__label">协议版本</div><div className="admin-summary__value"><span className="admin-summary__text">{active?.health?.contract_version ?? '—'}</span></div><div className="admin-summary__note">readiness contract</div></div>
            <div className="admin-summary__cell"><div className="admin-summary__label">最近检测</div><div className="admin-summary__value"><span className="admin-summary__text">{active?.health?.checked_at ? formatGatewayDate(active.health.checked_at) : '尚未检测'}</span></div><div className="admin-summary__note">{active?.health?.latency_ms !== null && active?.health?.latency_ms !== undefined ? `响应 ${active.health.latency_ms} ms` : '—'}</div></div>
            <div className="admin-summary__cell"><div className="admin-summary__label">配置更新时间</div><div className="admin-summary__value"><span className="admin-summary__text">{active ? formatGatewayDate(active.updated_at) : '—'}</span></div><div className="admin-summary__note">{active ? `${active.updated_by} · Active #${active.id}` : '—'}</div></div>
          </section>

          <div className="admin-layout">
            <div className="admin-stack">
              <section className="admin-panel">
                <div className="admin-panel__head"><div><h2 className="admin-panel__title">当前连接</h2><div className="admin-panel__sub">Active 配置 · 正在影响 IR 采集</div></div><Tag color={activeInfo.color}>{active ? activeInfo.label : '未配置'}</Tag></div>
                <div className="admin-panel__body">
                  {active ? (
                    <>
                      <GatewayHealth health={active.health} testId="gateway-active-status" />
                      <ConfigurationDetails configuration={active} />
                      <div className="admin-actions"><Button loading={testing === 'active'} disabled={Boolean(testing)} onClick={() => testConnection('active')}>立即检测</Button></div>
                    </>
                  ) : (
                    <div className="admin-empty"><Text>尚未配置 AI 研发数据网关。</Text><Text type="secondary">保存候选配置后，测试连接并启用才会影响 IR 采集。</Text><Button type="primary" onClick={openEditor}>配置 Gateway</Button></div>
                  )}
                </div>
              </section>

              {draft && (
                <section className="admin-panel">
                  <div className="admin-panel__head"><div><h2 className="admin-panel__title">待启用配置</h2><div className="admin-panel__sub">Draft · 不影响 Active 配置</div></div><Tag color={gatewayStatusInfo(draftStatus).color}>{gatewayStatusInfo(draftStatus).label} · 待启用</Tag></div>
                  <div className="admin-panel__body">
                    <GatewayHealth health={draft.health} testId="gateway-draft-status" />
                    <ConfigurationDetails configuration={draft} />
                    <div className="admin-note">只有最新检测结果为“已连接”时才能启用；启用时会再次实时检测，成功后才替换 Active 配置。</div>
                    <div className="admin-actions">
                      <Button onClick={openEditor}>编辑草稿</Button>
                      <Button loading={testing === 'draft'} disabled={Boolean(testing) || activating} onClick={() => testConnection('draft')}>测试连接</Button>
                      <Button type="primary" loading={activating} disabled={draftStatus !== 'CONNECTED' || Boolean(testing)} onClick={activateDraft}>启用配置</Button>
                      <Popconfirm open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen} title="放弃待启用配置？" description="草稿和最近测试状态将被删除；当前 Active 配置不变。" okText="放弃草稿" cancelText="继续编辑" onConfirm={() => { setDiscardConfirmOpen(false); discardDraft() }}>
                        <Button danger type="link" loading={discarding} onClick={() => setDiscardConfirmOpen(true)}>放弃草稿</Button>
                      </Popconfirm>
                    </div>
                    {draftStatus !== 'CONNECTED' && <div className="admin-note">只有最新检测结果为“已连接”时才能启用。</div>}
                  </div>
                </section>
              )}
            </div>

            <aside className="admin-stack">
              <section className="admin-panel">
                <div className="admin-panel__head"><div><h2 className="admin-panel__title">启用检查清单</h2><div className="admin-panel__sub">候选配置通过后才可替换 Active</div></div></div>
                <div className="admin-panel__body">
                  {draft ? <div className="admin-checklist">{checklist.map((item) => <div className="admin-check" key={item.title}><span className="admin-check__icon">{item.ok ? '✓' : '·'}</span><div><div className="admin-check__title">{item.title}</div><div className="admin-check__note">{item.note}</div></div></div>)}</div> : <div className="admin-empty"><Text type="secondary">保存候选配置后显示检查项。</Text></div>}
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel__head"><div><h2 className="admin-panel__title">配置操作记录</h2><div className="admin-panel__sub">最近 50 条 · 北京时间</div></div></div>
                <div className="admin-panel__body">
                  {auditError ? <Alert type="error" showIcon message={auditError} /> : audits.length === 0 ? <Text type="secondary">暂无配置操作记录。</Text> : (
                    <ul className="admin-audit-list">
                      {audits.map((audit) => (
                        <li className="admin-audit" key={audit.id}>
                          <span className="admin-audit__dot" />
                          <div>
                            <div className="admin-audit__head"><span className="admin-audit__title">{actionLabel(audit.action)}</span>{audit.result_status && <Tag color={gatewayStatusInfo(audit.result_status).color}>{gatewayStatusInfo(audit.result_status).label}</Tag>}</div>
                            <div className="admin-audit__meta">{audit.actor} · {formatGatewayDate(audit.created_at)}</div>
                            <div className="admin-audit__summary">{auditSummary(audit.changes)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}

      <GatewayConfigModal
        open={editorOpen}
        seed={editorSeed}
        tokenRequired={!active?.token_configured}
        submitting={saving}
        onClose={() => setEditorOpen(false)}
        onSubmit={saveDraft}
      />
    </div>
  )
}
