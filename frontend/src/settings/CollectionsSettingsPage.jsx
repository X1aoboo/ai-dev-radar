import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Spin, Tag, Typography } from 'antd'

import { fetchJson } from '../api'
import PageHeader from '../components/PageHeader'
import '../dataManagement/dataManagement.css'

const { Text, Title } = Typography

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
  return ({ succeeded: '成功', partial: '部分失败', failed: '失败', running: '运行中' })[status] ?? status
}

export default function CollectionsSettingsPage({ onSessionExpired }) {
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [runs, setRuns] = useState([])
  const [window, setWindow] = useState({ start_at: '', end_at: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async ({ clearNotice = true } = {}) => {
    setLoading(true)
    try {
      const data = await fetchJson('/api/collection-schedules')
      setSchedule(data.schedules.find((item) => item.domain === 'ir') ?? DEFAULT_SCHEDULE)
      setRuns(data.recent_runs ?? [])
      if (clearNotice) setNotice(null)
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
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

  return (
    <div className="workbench-page collection-settings-page">
      <PageHeader className="workbench-page-intro" eyebrow="系统管理 / 数据采集" title="数据采集" description="IR 采集先进入团队独立的待确认批次；确认后才写入正式 IR。" />
      {notice && <Alert className="workbench-notice" type={notice.type} showIcon message={notice.text} closable onClose={() => setNotice(null)} />}
      {loading ? <div className="workbench-state"><Spin size="small" /><Text type="secondary">加载采集配置…</Text></div> : <>
        <Card title="IR 定时计划" extra={<Tag color={schedule.enabled ? 'green' : 'default'}>{schedule.enabled ? '已启用' : '已禁用'}</Tag>}>
          <form noValidate aria-label="IR 定时计划" className="collection-form" onSubmit={saveSchedule}>
            <label className="collection-toggle"><input aria-label="启用 IR 定时采集" type="checkbox" checked={schedule.enabled} onChange={(event) => setSchedule((current) => ({ ...current, enabled: event.target.checked }))} />启用 IR 定时采集</label>
            <label>采集周期<select aria-label="采集周期" value={schedule.cadence} onChange={(event) => updateCadence(event.target.value)}>{CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {schedule.cadence === 'hourly' ? <label>每小时第几分钟<input aria-label="每小时第几分钟" type="number" min="0" max="59" value={schedule.minute} onChange={(event) => setSchedule((current) => ({ ...current, minute: event.target.value === '' ? '' : Number(event.target.value) }))} /></label> : <label>执行时间<input aria-label="执行时间" type="time" value={scheduledTime} onChange={(event) => updateTime(event.target.value)} /></label>}
            {schedule.cadence === 'weekly' && <label>星期<select aria-label="星期" value={schedule.day_of_week ?? 0} onChange={(event) => setSchedule((current) => ({ ...current, day_of_week: Number(event.target.value) }))}>{WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}
            {schedule.cadence === 'monthly' && <label>每月日期（1–28）<input aria-label="每月日期" type="number" min="1" max="28" value={schedule.day_of_month ?? 1} onChange={(event) => setSchedule((current) => ({ ...current, day_of_month: event.target.value === '' ? '' : Number(event.target.value) }))} /></label>}
            <Text type="secondary">时区固定为 Asia/Shanghai。每次运行只采集上一个完整周期。</Text>
            <Button type="primary" htmlType="submit" loading={saving}>保存计划</Button>
          </form>
        </Card>

        <Card className="workbench-section-gap" title="手动触发 IR 采集">
          <form noValidate aria-label="手动触发 IR 采集" className="collection-form" onSubmit={runNow}>
            <Text type="secondary">留空使用上一个完整调度周期；也可指定带时区的半开时间段 [开始, 结束)。单次最多 10000 条，超量时请缩短窗口。</Text>
            <div className="collection-window-fields">
              <label>开始时间（Asia/Shanghai）<input aria-label="开始时间" type="datetime-local" value={window.start_at} onChange={(event) => setWindow((current) => ({ ...current, start_at: event.target.value }))} /></label>
              <label>结束时间（Asia/Shanghai）<input aria-label="结束时间" type="datetime-local" value={window.end_at} onChange={(event) => setWindow((current) => ({ ...current, end_at: event.target.value }))} /></label>
            </div>
            <Button type="primary" htmlType="submit" loading={running}>立即采集</Button>
          </form>
        </Card>

        <Card className="workbench-section-gap" title="最近运行结果">
          {runs.length === 0 ? <Text type="secondary">暂无采集运行记录。</Text> : <div className="collection-runs">
            {runs.map((run) => <section className="collection-run" key={run.id}>
              <div className="collection-run__heading"><Text strong>#{run.id} · {run.trigger_type === 'manual' ? '手动' : '定时'} · {runStatusLabel(run.status)}</Text><Text type="secondary">{run.window_start_at} → {run.window_end_at}</Text></div>
              <ul>{run.team_results.map((result) => <li key={`${run.id}-${result.team_id}`}><Text>{result.team_name}</Text> <Tag color={result.status === 'failed' ? 'red' : result.status === 'skipped' ? 'default' : 'green'}>{result.status === 'failed' ? '失败' : result.status === 'skipped' ? '跳过' : '成功'}</Tag> <Text type="secondary">{result.message}</Text>{result.code && <Text code>{result.code}</Text>}{result.retryable && <Text type="warning">可重试</Text>}{result.batch_id && <Text type="secondary"> · 暂存批次 #{result.batch_id}（{result.record_count} 行）</Text>}</li>)}</ul>
            </section>)}
          </div>}
        </Card>
      </>}
    </div>
  )
}
