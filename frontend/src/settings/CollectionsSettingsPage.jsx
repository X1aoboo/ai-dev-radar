import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Switch, Table, Tag, Typography } from 'antd'
import { Link } from 'react-router'

import { fetchJson } from '../api'
import PageHeader from '../components/PageHeader'
import StatusPage, { ContentLoadingState } from '../components/StatusPage'
import '../dataManagement/dataManagement.css'
import { formatGatewayDate, gatewayStatusInfo } from './gatewayStatus'

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

function GatewaySummary({ state, error }) {
  if (error) return <Card title="AI 研发数据网关"><Alert type="error" showIcon message="无法读取 Gateway 状态" description="请稍后重试；如果问题持续，请查看网关配置。" /></Card>
  const active = state?.active
  const health = active?.health
  const info = gatewayStatusInfo(health?.status ?? 'UNCONFIGURED')
  const statusLabel = health?.stale ? '状态已过期' : info.label
  const note = !active
    ? '尚未配置，IR 采集无法运行。'
    : health?.status === 'CONNECTED'
      ? null
      : ['AUTH_FAILED', 'SERVICE_MISMATCH', 'PROTOCOL_INCOMPATIBLE', 'UNREACHABLE', 'DEGRADED'].includes(health?.status)
        ? '当前采集可能无法执行。'
        : health?.stale
          ? `上次状态：${gatewayStatusInfo(health.last_known_status).label}；采集仍会尝试连接。`
          : '当前状态未知；采集仍会尝试连接。'

  return (
    <Card className="workbench-section-gap gateway-summary" title="AI 研发数据网关" extra={<Tag color={info.color}>{statusLabel}</Tag>}>
      {active ? <div className="gateway-summary__details">
        <Text>地址：{active.base_url}</Text>
        <Text>Token：{active.token_configured ? '已配置' : '未配置'}</Text>
        {health?.latency_ms !== null && health?.latency_ms !== undefined && <Text>响应：{health.latency_ms} ms</Text>}
        <Text>最近检测：{formatGatewayDate(health?.checked_at)}</Text>
      </div> : <Text type="secondary">尚未配置 AI 研发数据网关。</Text>}
      {note && <Text type={active ? 'warning' : 'secondary'}>{note}</Text>}
      {health?.error_message && <Text type="secondary">{health.error_message}</Text>}
      <Link to="/settings/gateway">查看数据网关 →</Link>
    </Card>
  )
}

export default function CollectionsSettingsPage({ onSessionExpired }) {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [gatewayState, setGatewayState] = useState(null)
  const [gatewayError, setGatewayError] = useState(null)
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
        fetchJson('/api/gateway'),
      ])
      if (scheduleResult.status === 'rejected') throw scheduleResult.reason
      const data = scheduleResult.value
      setSchedule(data.schedules.find((item) => item.domain === 'ir') ?? DEFAULT_SCHEDULE)
      setRuns(data.recent_runs ?? [])
      if (gatewayResult.status === 'fulfilled') {
        setGatewayState(gatewayResult.value)
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
    event.preventDefault()
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
    event.preventDefault()
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
  const latestRun = runs[0]
  const runColumns = [
    { title: '开始时间', dataIndex: 'started_at', render: formatRunTime },
    { title: '触发方式', dataIndex: 'trigger_type', render: (type) => type === 'manual' ? '手动' : '定时' },
    { title: '采集窗口', key: 'window', render: (_, run) => <span className="collection-window">{run.window_start_at} → {run.window_end_at}</span> },
    { title: '状态', dataIndex: 'status', render: (status) => statusLabel(status) },
    { title: '运行说明', key: 'error', render: (_, run) => run.error_code ? <span>{RUN_MESSAGES[run.error_code] ?? run.message ?? '—'} <Text code>{run.error_code}</Text>{run.retryable && <> {statusLabel('retryable', '可重试')}</>}</span> : '—' },
    { title: '团队结果', key: 'teams', render: (_, run) => summarizeTeams(run) },
    { title: '记录数', key: 'records', align: 'right', render: (_, run) => countRunRecords(run) },
  ]

  return (
    <div className="workbench-page collection-settings-page">
      <PageHeader className="workbench-page-intro" title="数据采集" description="IR 采集先进入团队独立的待确认批次；确认后才写入正式 IR。" />
      {notice && <Alert className="workbench-notice" type={notice.type} showIcon message={notice.text} closable onClose={() => setNotice(null)} />}
      {loading
        ? <ContentLoadingState label="加载采集配置…" />
        : loadError
          ? <StatusPage status="error" layout="compact" title="采集配置暂时无法加载" description="请重试；如果问题持续，请稍后再试。" actions={<Button type="primary" onClick={() => load()}>重试</Button>} />
          : <>
            <div className="settings-summary" aria-label="IR 采集当前状态">
              <div className="settings-summary__item"><span className="settings-summary__label">定时采集</span><span className="settings-summary__value">{statusLabel(schedule.enabled ? 'enabled' : 'disabled', schedule.enabled ? '已启用' : '已禁用')}</span></div>
              <div className="settings-summary__item"><span className="settings-summary__label">执行周期</span><span className="settings-summary__value">{scheduleSummary(schedule)}</span></div>
              <div className="settings-summary__item"><span className="settings-summary__label">时区</span><span className="settings-summary__value">Asia/Shanghai</span></div>
              {latestRun && <div className="settings-summary__item"><span className="settings-summary__label">最近运行</span><span className="settings-summary__value">{statusLabel(latestRun.status)} {formatRunTime(latestRun.started_at)}</span></div>}
            </div>
            <GatewaySummary state={gatewayState} error={gatewayError} />
            <section className="settings-section">
              <div className="settings-section__header"><div><h2 className="settings-section__title">定时采集</h2><p className="settings-section__description">每次运行采集上一个完整周期。</p></div>{statusLabel(schedule.enabled ? 'enabled' : 'disabled', schedule.enabled ? '已启用' : '已禁用')}</div>
              <form noValidate aria-label="IR 定时计划" className="collection-form collection-form--schedule" onSubmit={saveSchedule}>
                <div className="collection-toggle"><Switch aria-label="启用 IR 定时采集" checked={schedule.enabled} disabled={saving} onChange={(enabled) => setSchedule((current) => ({ ...current, enabled }))} /><span>启用 IR 定时采集</span></div>
                <label>采集周期<select aria-label="采集周期" disabled={saving} value={schedule.cadence} onChange={(event) => updateCadence(event.target.value)}>{CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {schedule.cadence === 'hourly' ? <label>每小时第几分钟<input aria-label="每小时第几分钟" disabled={saving} type="number" min="0" max="59" value={schedule.minute} onChange={(event) => setSchedule((current) => ({ ...current, minute: event.target.value === '' ? '' : Number(event.target.value) }))} /></label> : <label>执行时间<input aria-label="执行时间" disabled={saving} type="time" value={scheduledTime} onChange={(event) => updateTime(event.target.value)} /></label>}
                {schedule.cadence === 'weekly' && <label>星期<select aria-label="星期" disabled={saving} value={schedule.day_of_week ?? 0} onChange={(event) => setSchedule((current) => ({ ...current, day_of_week: Number(event.target.value) }))}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}
                {schedule.cadence === 'monthly' && <label>每月日期（1–28）<input aria-label="每月日期" disabled={saving} type="number" min="1" max="28" value={schedule.day_of_month ?? 1} onChange={(event) => setSchedule((current) => ({ ...current, day_of_month: event.target.value === '' ? '' : Number(event.target.value) }))} /></label>}
                <Text type="secondary">时区固定为 Asia/Shanghai。</Text>
                <Button type="primary" htmlType="submit" loading={saving}>保存计划</Button>
              </form>
            </section>

            <section className="settings-section">
              <div className="settings-section__header"><div><h2 className="settings-section__title">手动采集</h2><p className="settings-section__description">默认使用上一个完整周期；需要时可指定半开区间。</p></div></div>
              <form noValidate aria-label="手动触发 IR 采集" className="collection-form collection-form--manual" onSubmit={runNow}>
                <details className="settings-disclosure">
                  <summary>自定义时间范围</summary>
                  <div className="collection-window-fields">
                    <label>开始时间（Asia/Shanghai）<input aria-label="开始时间" type="datetime-local" value={window.start_at} onChange={(event) => setWindow((current) => ({ ...current, start_at: event.target.value }))} /></label>
                    <label>结束时间（Asia/Shanghai）<input aria-label="结束时间" type="datetime-local" value={window.end_at} onChange={(event) => setWindow((current) => ({ ...current, end_at: event.target.value }))} /></label>
                  </div>
                  <Text type="secondary">窗口按 [开始, 结束) 计算，单次最多 10000 条；超量时请缩短窗口。</Text>
                </details>
                <Button htmlType="submit" loading={running}>立即采集</Button>
              </form>
            </section>

            <section className="operational-workspace" aria-labelledby="collection-history-heading">
              <div className="operational-workspace__header"><div><h2 id="collection-history-heading" className="operational-workspace__title">运行历史</h2><p className="settings-section__description">查看采集窗口、团队结果和暂存记录。</p></div><span className="operational-workspace__count">{runs.length} 条</span></div>
              <Table className="operational-table" rowKey="id" size="small" columns={runColumns} dataSource={runs} pagination={false} expandable={{ expandedRowRender: (run) => <RunTeamDetails run={run} />, rowExpandable: (run) => Boolean(run.team_results?.length), expandRowByClick: false }} locale={{ emptyText: '暂无采集运行记录。' }} scroll={{ x: 900 }} />
            </section>
          </>}
    </div>
  )
}
