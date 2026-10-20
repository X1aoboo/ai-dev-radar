import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Switch, Table, Tag, Typography } from 'antd'
import { Link } from 'react-router'

import { fetchJson } from '../api'
import PageHeader from '../components/PageHeader'
import StatusPage, { ContentLoadingState } from '../components/StatusPage'
import { formatGatewayDate, gatewayStatusInfo } from './gatewayStatus'
import './admin-pages.css'

const { Text } = Typography

const DEFAULT_SCHEDULE = {
  domain: 'ir',
  enabled: false,
  cadence: 'daily',
  minute: 0,
  hour: 2,
  day_of_week: null,
  day_of_month: null,
  timezone: 'Asia/Shanghai',
}

const CADENCES = [
  ['hourly', '每小时'],
  ['daily', '每天'],
  ['weekly', '每周'],
  ['monthly', '每月'],
]
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const HARD_BLOCK_STATUSES = new Set(['UNCONFIGURED', 'AUTH_FAILED', 'SERVICE_MISMATCH', 'PROTOCOL_INCOMPATIBLE'])

function zonedIso(value) {
  return value ? `${value}:00+08:00` : null
}

function runStatusLabel(status) {
  return ({ succeeded: '成功', partial: '部分失败', failed: '失败', running: '运行中', skipped: '跳过' })[status] ?? status
}

function runStatusTone(status) {
  return ({ succeeded: 'success', partial: 'warning', failed: 'error', running: 'info', retryable: 'info', skipped: 'neutral', enabled: 'success', disabled: 'neutral' })[status] ?? 'neutral'
}

const RUN_MESSAGES = {
  gateway_not_configured: 'AI 研发数据网关尚未配置。',
  gateway_auth_failed: 'Gateway 认证失败，请检查当前配置。',
  gateway_service_mismatch: 'Gateway 服务身份不匹配。',
  gateway_protocol_incompatible: 'Gateway readiness 响应或协议版本不兼容。',
  gateway_configuration_error: '采集网关配置无效。',
  gateway_https_required: '生产环境的采集网关必须使用 HTTPS。',
  gateway_timeout: '采集网关请求超时。',
  gateway_unavailable: '采集网关暂时不可用。',
  gateway_http_error: '采集网关返回错误响应。',
  request_id_mismatch: '采集网关返回的请求标识不匹配。',
  too_many_records: '返回记录超过单次采集上限，请缩短时间窗口。',
  invalid_team_mapping: '团队产品版本映射无效，请检查配置。',
  collection_processing_error: '采集结果处理失败。',
}

function statusLabel(status, label = runStatusLabel(status)) {
  return <span className={`operational-status-tag operational-status-tag--${runStatusTone(status)}`}>{label}</span>
}

function formatRunTime(value) {
  if (!value) return '—'
  const normalized = String(value).replace('T', ' ')
  return normalized.length > 16 ? normalized.slice(0, 16) : normalized
}

function scheduleSummary(schedule) {
  const time = `${String(schedule.hour ?? 0).padStart(2, '0')}:${String(schedule.minute ?? 0).padStart(2, '0')}`
  if (schedule.cadence === 'hourly') return `每小时第 ${schedule.minute ?? 0} 分钟`
  if (schedule.cadence === 'weekly') return `每周${WEEKDAYS[schedule.day_of_week ?? 0]} ${time}`
  if (schedule.cadence === 'monthly') return `每月 ${schedule.day_of_month ?? 1} 日 ${time}`
  return `每天 ${time}`
}

function summarizeTeams(run) {
  const results = run.team_results ?? []
  if (!results.length) return '暂无团队结果'
  return [
    ['succeeded', '成功'],
    ['failed', '失败'],
    ['skipped', '跳过'],
  ].map(([status, label]) => {
    const count = results.filter((result) => result.status === status).length
    return count ? `${count} ${label}` : null
  }).filter(Boolean).join(' · ')
}

function countRunRecords(run) {
  const results = run.team_results ?? []
  return results.length ? results.reduce((count, result) => count + (result.record_count ?? 0), 0) : '—'
}

function RunTeamDetails({ run }) {
  const columns = [
    { title: '团队', dataIndex: 'team_name' },
    { title: '结果', dataIndex: 'status', render: (status) => statusLabel(status) },
    { title: '记录数', dataIndex: 'record_count', align: 'right' },
    { title: '暂存批次', dataIndex: 'batch_id', render: (id) => id ? `#${id}` : '—' },
    {
      title: '结果说明',
      key: 'message',
      render: (_, result) => <span>{RUN_MESSAGES[result.code] ?? result.message ?? '—'}{result.code && <> <Text code>{result.code}</Text></>}{result.retryable && <> {statusLabel('retryable', '可重试')}</>}</span>,
    },
  ]
  return <div className="settings-run-detail"><Table className="operational-table" aria-label={`运行 ${run.id} 的团队结果`} rowKey="team_id" size="small" columns={columns} dataSource={run.team_results ?? []} pagination={false} locale={{ emptyText: '暂无团队结果。' }} scroll={{ x: 680 }} /></div>
}

function gatewayStateLabel(status) {
  return gatewayStatusInfo(status?.status ?? 'UNCONFIGURED').label
}

export default function CollectionsSettingsPage({ onSessionExpired }) {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [gatewayStatus, setGatewayStatus] = useState(null)
  const [gatewayError, setGatewayError] = useState(null)
  const [scope, setScope] = useState(null)
  const [runs, setRuns] = useState([])
  const [window, setWindow] = useState({ start_at: '', end_at: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    setLoadError(null)
    try {
      const [scheduleResult, gatewayResult] = await Promise.allSettled([
        fetchJson('/api/collection-schedules'),
        fetchJson('/api/gateway/status'),
      ])
      if (scheduleResult.status === 'rejected') throw scheduleResult.reason
      const data = scheduleResult.value
      setSchedule(data.schedules.find((item) => item.domain === 'ir') ?? DEFAULT_SCHEDULE)
      setScope(data.scope ?? null)
      setRuns(data.recent_runs ?? [])
      if (gatewayResult.status === 'fulfilled') {
        setGatewayStatus(gatewayResult.value)
        setGatewayError(null)
      } else {
        setGatewayError(gatewayResult.reason.message)
        if (gatewayResult.reason.status === 401) onSessionExpired()
      }
      if (clearNotice) setNotice(null)
    } catch (error) {
      setLoadError(error)
      if (error.status === 401) onSessionExpired()
    } finally {
      setLoading(false)
    }
  }, [onSessionExpired])

  useEffect(() => { load() }, [load])

  const statusKey = gatewayStatus?.status ?? 'UNCONFIGURED'
  const gatewayBlocked = gatewayError || !gatewayStatus?.configured || HARD_BLOCK_STATUSES.has(statusKey)
  const gatewaySoftWarning = !gatewayBlocked && (gatewayStatus?.stale || ['DEGRADED', 'UNKNOWN', 'UNREACHABLE'].includes(statusKey))
  const latestRun = runs[0]
  const scopeText = scope ? `${scope.team_count} 团队 / ${scope.pi_count} PI` : '—'
  const guardMessage = gatewayBlocked
    ? gatewayError ? '无法读取 Gateway 就绪状态，采集暂不可用。' : statusKey === 'UNCONFIGURED' || !gatewayStatus?.configured ? '尚未配置 Gateway，先完成配置和启用后才能采集。' : 'Gateway 当前为硬错误状态，先处理连接配置后再采集。'
    : gatewaySoftWarning ? 'Gateway 当前状态不是“已连接”，采集仍会尝试连接；运行可能失败。' : null

  function updateCadence(cadence) {
    setSchedule((current) => ({
      ...current,
      cadence,
      hour: cadence === 'hourly' ? null : current.hour ?? 2,
      day_of_week: cadence === 'weekly' ? current.day_of_week ?? 0 : null,
      day_of_month: cadence === 'monthly' ? current.day_of_month ?? 1 : null,
    }))
  }

  function updateTime(value) {
    const [hour, minute] = value.split(':').map(Number)
    setSchedule((current) => ({ ...current, hour, minute }))
  }

  async function saveSchedule(event) {
    event?.preventDefault()
    setSaving(true)
    try {
      const payload = {
        enabled: schedule.enabled,
        cadence: schedule.cadence,
        minute: Number(schedule.minute),
        hour: schedule.hour === null ? null : Number(schedule.hour),
        day_of_week: schedule.day_of_week === null ? null : Number(schedule.day_of_week),
        day_of_month: schedule.day_of_month === null ? null : Number(schedule.day_of_month),
      }
      const saved = await fetchJson('/api/collection-schedules/ir', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setSchedule(saved)
      await load({ clearNotice: false })
      setNotice({ type: 'success', text: 'IR 采集计划已保存并立即生效。' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally {
      setSaving(false)
    }
  }

  async function runNow(event) {
    event?.preventDefault()
    if (gatewayBlocked) {
      setNotice({ type: 'error', text: guardMessage })
      return
    }
    if (Boolean(window.start_at) !== Boolean(window.end_at)) {
      setNotice({ type: 'error', text: '开始时间和结束时间需要同时填写。' })
      return
    }
    if (window.start_at && window.start_at >= window.end_at) {
      setNotice({ type: 'error', text: '开始时间必须早于结束时间。' })
      return
    }
    setRunning(true)
    try {
      const payload = window.start_at
        ? { start_at: zonedIso(window.start_at), end_at: zonedIso(window.end_at) }
        : {}
      const run = await fetchJson('/api/collection-schedules/ir/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await load({ clearNotice: false })
      setNotice({ type: run.status === 'failed' ? 'error' : 'success', text: `手动采集完成：${runStatusLabel(run.status)}。` })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally {
      setRunning(false)
    }
  }

  const scheduledTime = schedule.cadence === 'hourly'
    ? null
    : `${String(schedule.hour ?? 0).padStart(2, '0')}:${String(schedule.minute ?? 0).padStart(2, '0')}`
  const runColumns = [
    { title: '开始时间', dataIndex: 'started_at', render: formatRunTime, width: 150 },
    { title: '触发方式', dataIndex: 'trigger_type', width: 90, render: (type) => type === 'manual' ? '手动' : '定时' },
    { title: '采集窗口', key: 'window', width: 280, render: (_, run) => <span className="admin-run-window">{run.window_start_at} → {run.window_end_at}</span> },
    { title: '状态', dataIndex: 'status', width: 110, render: (status) => statusLabel(status) },
    { title: '运行说明', key: 'error', width: 260, render: (_, run) => run.error_code ? <span className="admin-run-message">{RUN_MESSAGES[run.error_code] ?? run.message ?? '—'} <Text code>{run.error_code}</Text>{run.retryable && <> {statusLabel('retryable', '可重试')}</>}</span> : '—' },
    { title: '团队结果', key: 'teams', render: (_, run) => summarizeTeams(run) },
    { title: '记录数', key: 'records', align: 'right', width: 80, render: (_, run) => countRunRecords(run) },
  ]

  return (
    <div className="admin-page">
      <PageHeader
        title="数据采集"
        description="按团队执行 IR 采集，先进入独立的待确认批次；确认后才写入正式 IR。采集范围由产品/PI 层级决定，本页只读取 Gateway 就绪状态。"
        actions={<Button type="primary" loading={running} disabled={gatewayBlocked} onClick={() => runNow()}>立即采集</Button>}
      />

      {notice && <Alert className="settings-page__notice" type={notice.type} showIcon message={notice.text} closable onClose={() => setNotice(null)} />}

      {loading ? (
        <ContentLoadingState label="加载采集配置…" />
      ) : loadError ? (
        <StatusPage status="error" layout="compact" title="采集配置暂时无法加载" description="请重试；如果问题持续，请稍后再试。" actions={<Button type="primary" onClick={() => load()}>重试</Button>} />
      ) : (
        <>
          <div className="admin-readiness">
            <span className={`dot dot--${gatewayStatusInfo(statusKey).color === 'green' ? 'success' : gatewayStatusInfo(statusKey).color === 'red' ? 'danger' : 'warning'}`} />
            <strong>AI 研发数据网关 · {gatewayStateLabel(gatewayStatus)}</strong>
            <span className="admin-readiness__meta">{gatewayStatus?.checked_at ? `最近检测 ${formatGatewayDate(gatewayStatus.checked_at)}` : '尚未检测'}{gatewayStatus?.latency_ms !== null && gatewayStatus?.latency_ms !== undefined ? ` · ${gatewayStatus.latency_ms} ms` : ''}{gatewayStatus?.stale ? ' · 状态已过期' : ''}</span>
            {gatewayStatus?.contract_version && <span className="admin-readiness__meta">协议 {gatewayStatus.contract_version}</span>}
            <Link className="admin-readiness__link" to="/settings/gateway">查看数据网关 →</Link>
          </div>
          {guardMessage && <Alert type={gatewayBlocked ? 'error' : 'warning'} showIcon message={guardMessage} />}

          <section className="admin-summary" aria-label="采集概览">
            <div className="admin-summary__cell"><div className="admin-summary__label">定时采集</div><div className="admin-summary__value">{statusLabel(schedule.enabled ? 'enabled' : 'disabled', schedule.enabled ? '已启用' : '已禁用')}</div><div className="admin-summary__note">下一次 {schedule.enabled ? scheduleSummary(schedule) : '未启用'}</div></div>
            <div className="admin-summary__cell"><div className="admin-summary__label">执行周期</div><div className="admin-summary__value"><span className="admin-summary__text">{scheduleSummary(schedule)}</span></div><div className="admin-summary__note">Asia/Shanghai</div></div>
            <div className="admin-summary__cell"><div className="admin-summary__label">最近运行</div><div className="admin-summary__value">{latestRun ? statusLabel(latestRun.status) : <span className="admin-summary__text">暂无</span>}</div><div className="admin-summary__note">{latestRun ? `${formatRunTime(latestRun.started_at)} · ${summarizeTeams(latestRun)}` : '尚未运行'}</div></div>
            <div className="admin-summary__cell"><div className="admin-summary__label">采集范围</div><div className="admin-summary__value"><span className="admin-summary__text">{scopeText}</span></div><div className="admin-summary__note">由产品/PI 层级自动派生</div></div>
          </section>

          <div className="admin-grid-2">
            <section className="admin-panel">
              <div className="admin-panel__head"><div><h2 className="admin-panel__title">定时采集</h2><div className="admin-panel__sub">每次运行采集上一个完整周期</div></div>{statusLabel(schedule.enabled ? 'enabled' : 'disabled', schedule.enabled ? '已启用' : '已禁用')}</div>
              <div className="admin-panel__body">
                <div className="admin-switch-row"><Switch aria-label="启用 IR 定时采集" checked={schedule.enabled} disabled={saving || (gatewayBlocked && !schedule.enabled)} onChange={(enabled) => setSchedule((current) => ({ ...current, enabled }))} /><span className="admin-switch-row__label">启用 IR 定时采集</span><span className="admin-form-note">保存后立即生效</span></div>
                <form noValidate aria-label="IR 定时计划" onSubmit={saveSchedule}>
                  <div className="admin-form-grid">
                    <div className="admin-field"><label htmlFor="collection-cadence">采集周期</label><select id="collection-cadence" aria-label="采集周期" className="admin-control" disabled={saving} value={schedule.cadence} onChange={(event) => updateCadence(event.target.value)}>{CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                    {schedule.cadence === 'hourly' ? <div className="admin-field"><label htmlFor="collection-minute">每小时第几分钟</label><input id="collection-minute" aria-label="每小时第几分钟" className="admin-control" disabled={saving} type="number" min="0" max="59" value={schedule.minute} onChange={(event) => setSchedule((current) => ({ ...current, minute: event.target.value === '' ? '' : Number(event.target.value) }))} /></div> : <div className="admin-field"><label htmlFor="collection-time">执行时间</label><input id="collection-time" aria-label="执行时间" className="admin-control" disabled={saving} type="time" value={scheduledTime} onChange={(event) => updateTime(event.target.value)} /></div>}
                    {schedule.cadence === 'weekly' && <div className="admin-field"><label htmlFor="collection-weekday">星期</label><select id="collection-weekday" aria-label="星期" className="admin-control" disabled={saving} value={schedule.day_of_week ?? 0} onChange={(event) => setSchedule((current) => ({ ...current, day_of_week: Number(event.target.value) }))}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></div>}
                    {schedule.cadence === 'monthly' && <div className="admin-field"><label htmlFor="collection-monthday">每月日期（1–28）</label><input id="collection-monthday" aria-label="每月日期" className="admin-control" disabled={saving} type="number" min="1" max="28" value={schedule.day_of_month ?? 1} onChange={(event) => setSchedule((current) => ({ ...current, day_of_month: event.target.value === '' ? '' : Number(event.target.value) }))} /></div>}
                    <div className="admin-field"><label>时区</label><div className="admin-control admin-control--readonly">Asia/Shanghai</div></div>
                  </div>
                  <div className="admin-form-actions"><Button type="primary" htmlType="submit" loading={saving} disabled={gatewayBlocked && schedule.enabled}>保存计划</Button><span className="admin-form-note">定时任务使用当前 Active Gateway 配置。</span></div>
                </form>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel__head"><div><h2 className="admin-panel__title">手动采集</h2><div className="admin-panel__sub">默认使用上一个完整周期；需要时可指定半开区间</div></div></div>
              <div className="admin-panel__body">
                <div className="admin-manual-period"><strong>默认：上一个完整周期</strong><div>窗口由当前填报周期决定 · {scopeText}</div></div>
                <form noValidate aria-label="手动触发 IR 采集" onSubmit={runNow}>
                  <div className="admin-disclosure"><details><summary>自定义时间范围</summary><div className="admin-disclosure__body"><div className="admin-form-grid"><div className="admin-field"><label htmlFor="collection-start">开始时间（Asia/Shanghai）</label><input id="collection-start" aria-label="开始时间" className="admin-control" type="datetime-local" value={window.start_at} onChange={(event) => setWindow((current) => ({ ...current, start_at: event.target.value }))} /></div><div className="admin-field"><label htmlFor="collection-end">结束时间（Asia/Shanghai）</label><input id="collection-end" aria-label="结束时间" className="admin-control" type="datetime-local" value={window.end_at} onChange={(event) => setWindow((current) => ({ ...current, end_at: event.target.value }))} /></div></div><span className="admin-form-note">窗口按 [开始, 结束) 计算，单次最多 10000 条；超量时请缩短窗口。</span></div></details></div>
                  <div className="admin-form-actions"><Button type="primary" htmlType="submit" loading={running} disabled={gatewayBlocked}>立即采集</Button><span className="admin-form-note">采集结果进入待确认批次。</span></div>
                </form>
                {latestRun && <div className="admin-last-run"><div className="admin-last-run__label">最近一次运行</div><div className="admin-last-run__value">{statusLabel(latestRun.status)}<span>{formatRunTime(latestRun.started_at)}</span><span className="muted">{summarizeTeams(latestRun)}</span></div><div className="admin-last-run__note">采集窗口：{latestRun.window_start_at} → {latestRun.window_end_at}</div></div>}
              </div>
            </section>
          </div>

          <section className="admin-table-card" aria-labelledby="collection-history-heading">
            <div className="admin-table-head"><div><h2 id="collection-history-heading">运行历史</h2><span>查看采集窗口、团队结果和暂存记录</span></div><span>最近 {runs.length} 条</span></div>
            <Table className="operational-table" rowKey="id" size="middle" columns={runColumns} dataSource={runs} pagination={false} expandable={{ expandedRowRender: (run) => <RunTeamDetails run={run} />, rowExpandable: (run) => Boolean(run.team_results?.length), expandRowByClick: false }} locale={{ emptyText: '暂无采集运行记录。' }} scroll={{ x: 1000 }} />
            <div className="admin-panel__body admin-note">运行仅创建待确认批次，确认后写入正式 IR；团队结果按团队隔离。</div>
          </section>
        </>
      )}
    </div>
  )
}
