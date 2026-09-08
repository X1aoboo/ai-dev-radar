import { useCallback, useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', ...options })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new HttpError(response.status, body?.detail ?? `请求失败（${response.status}）`)
  }
  if (response.status === 204) return null
  return response.json()
}

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname || '/')

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname || '/')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  return [pathname, navigate]
}

function LoginPage({ onLogin, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onLogin({ username, password })
    } catch {
      // 登录错误已经由 App 转换为表单提示。
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={styles.centeredPage}>
      <form onSubmit={submit} style={styles.loginCard}>
        <h1 style={{ marginTop: 0 }}>ai-dev-radar</h1>
        <p style={styles.muted}>登录后查看研发提效看板。</p>
        <label style={styles.field}>
          账号
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label style={styles.field}>
          密码
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <button type="submit" disabled={submitting} style={styles.primaryButton}>
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>
    </main>
  )
}

function ForbiddenPage({ onNavigate }) {
  return (
    <main style={styles.centeredPage}>
      <section style={styles.loginCard}>
        <p style={styles.error}>403</p>
        <h1>无权访问</h1>
        <p style={styles.muted}>当前角色不能访问此页面。</p>
        <button type="button" onClick={() => onNavigate('/')} style={styles.primaryButton}>
          返回看板
        </button>
      </section>
    </main>
  )
}

function StringListInput({ label, values, onChange, placeholder }) {
  function update(index, value) {
    onChange(values.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  function remove(index) {
    onChange(values.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <fieldset style={styles.listField}>
      <legend>{label}</legend>
      {values.map((value, index) => (
        <div key={`${index}-${value}`} style={styles.inlineField}>
          <input
            value={value}
            placeholder={placeholder}
            onChange={(event) => update(index, event.target.value)}
          />
          <button type="button" onClick={() => remove(index)} style={styles.dangerButton}>移除</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, ''])} style={styles.secondaryButton}>
        添加一项
      </button>
    </fieldset>
  )
}

const emptyTeam = () => ({
  id: null,
  name: '',
  source_mapping: { product_versions: [], repos: [] },
})

const emptyActivity = () => ({ id: null, code: '', name: '', kind: 'general' })

const emptyMetric = () => ({
  id: null,
  activity_id: '',
  code: '',
  name: '',
  type: 'penetration',
  numerator_semantic: '',
  denominator_semantic: '',
  collect_method: 'manual_only',
})

const emptyUser = () => ({ id: null, username: '', password: '', role: 'viewer', maintainer_team_id: '' })

function ConfigPage({ user, onNavigate, onLogout, onSessionExpired }) {
  const [teams, setTeams] = useState([])
  const [catalog, setCatalog] = useState([])
  const [users, setUsers] = useState([])
  const [teamForm, setTeamForm] = useState(emptyTeam)
  const [activityForm, setActivityForm] = useState(emptyActivity)
  const [metricForm, setMetricForm] = useState(emptyMetric)
  const [userForm, setUserForm] = useState(emptyUser)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextTeams, nextCatalog, nextUsers] = await Promise.all([
        fetchJson('/api/teams'),
        fetchJson('/api/catalog'),
        fetchJson('/api/auth/users'),
      ])
      setTeams(nextTeams)
      setCatalog(nextCatalog)
      setUsers(nextUsers)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally {
      setLoading(false)
    }
  }, [onSessionExpired])

  useEffect(() => { load() }, [load])

  async function mutate(url, options, success) {
    try {
      await fetchJson(url, options)
      setMessage({ type: 'success', text: success })
      await load()
      return true
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
      return false
    }
  }

  function structuredMapping(mapping) {
    return {
      product_versions: mapping.product_versions.map((item) => item.trim()).filter(Boolean),
      repos: mapping.repos.map((item) => item.trim()).filter(Boolean),
    }
  }

  async function submitTeam(event) {
    event.preventDefault()
    const editing = Boolean(teamForm.id)
    const success = await mutate(
      editing ? `/api/teams/${teamForm.id}` : '/api/teams',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamForm.name, source_mapping: structuredMapping(teamForm.source_mapping) }),
      },
      editing ? '团队已更新。' : '团队已创建。',
    )
    if (success) setTeamForm(emptyTeam())
  }

  async function submitActivity(event) {
    event.preventDefault()
    const editing = Boolean(activityForm.id)
    const success = await mutate(
      editing ? `/api/activities/${activityForm.id}` : '/api/activities',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activityForm.code, name: activityForm.name, kind: activityForm.kind }),
      },
      editing ? '活动已更新。' : '活动已创建。',
    )
    if (success) setActivityForm(emptyActivity())
  }

  async function submitMetric(event) {
    event.preventDefault()
    const editing = Boolean(metricForm.id)
    const success = await mutate(
      editing ? `/api/metrics/${metricForm.id}` : '/api/metrics',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metricForm,
          id: undefined,
          activity_id: Number(metricForm.activity_id),
          denominator_semantic: metricForm.denominator_semantic || null,
        }),
      },
      editing ? '指标已更新。' : '指标已创建。',
    )
    if (success) setMetricForm(emptyMetric())
  }

  async function submitUser(event) {
    event.preventDefault()
    const editing = Boolean(userForm.id)
    const body = editing
      ? {
          role: userForm.role,
          maintainer_team_id: userForm.role === 'maintainer' ? Number(userForm.maintainer_team_id) : null,
        }
      : {
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          maintainer_team_id: userForm.role === 'maintainer' ? Number(userForm.maintainer_team_id) : null,
        }
    const success = await mutate(
      editing ? `/api/users/${userForm.id}` : '/api/users',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      editing ? '用户角色已更新。' : '用户已创建。',
    )
    if (success) setUserForm(emptyUser())
  }

  if (loading) {
    return <p style={styles.loading}>加载配置中…</p>
  }

  return (
    <main style={styles.page}>
      <Navigation user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <h1>配置管理</h1>
      <p style={styles.muted}>仅管理员可以修改团队、指标目录和账号权限。</p>
      {message && <p role="alert" style={message.type === 'error' ? styles.error : styles.success}>{message.text}</p>}

      <section style={styles.configSection}>
        <h2>团队管理</h2>
        <div style={styles.configGrid}>
          <form onSubmit={submitTeam} style={styles.card}>
            <h3>{teamForm.id ? '编辑团队' : '新增团队'}</h3>
            <label style={styles.field}>名称<input required value={teamForm.name} onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })} /></label>
            <StringListInput label="产品版本号" values={teamForm.source_mapping.product_versions} placeholder="SCC 27.1.RC1" onChange={(product_versions) => setTeamForm({ ...teamForm, source_mapping: { ...teamForm.source_mapping, product_versions } })} />
            <StringListInput label="代码仓地址" values={teamForm.source_mapping.repos} placeholder="https://git.example.com/team/main.git" onChange={(repos) => setTeamForm({ ...teamForm, source_mapping: { ...teamForm.source_mapping, repos } })} />
            <button type="submit" style={styles.primaryButton}>{teamForm.id ? '保存团队' : '创建团队'}</button>{' '}
            {teamForm.id && <button type="button" onClick={() => setTeamForm(emptyTeam())} style={styles.secondaryButton}>取消</button>}
          </form>
          <div style={styles.card}>
            <h3>现有团队</h3>
            <table style={styles.table}><thead><tr><th>名称</th><th>版本号</th><th>仓库</th><th>操作</th></tr></thead><tbody>
              {teams.map((team) => <tr key={team.id}><td>{team.name}</td><td>{team.source_mapping.product_versions.join('、') || '—'}</td><td>{team.source_mapping.repos.join('、') || '—'}</td><td style={styles.actions}><button type="button" onClick={() => setTeamForm({ ...team, source_mapping: { product_versions: team.source_mapping.product_versions ?? [], repos: team.source_mapping.repos ?? [] } })} style={styles.secondaryButton}>编辑</button><button type="button" onClick={() => window.confirm(`删除团队“${team.name}”？`) && mutate(`/api/teams/${team.id}`, { method: 'DELETE' }, '团队已删除。')} style={styles.dangerButton}>删除</button></td></tr>)}
            </tbody></table>
          </div>
        </div>
      </section>

      <section style={styles.configSection}>
        <h2>指标目录管理</h2>
        <div style={styles.configGrid}>
          <form onSubmit={submitActivity} style={styles.card}>
            <h3>{activityForm.id ? '编辑活动' : '新增活动'}</h3>
            <label style={styles.field}>代码<input required pattern="[a-z0-9-]+" value={activityForm.code} onChange={(event) => setActivityForm({ ...activityForm, code: event.target.value })} /></label>
            <label style={styles.field}>名称<input required value={activityForm.name} onChange={(event) => setActivityForm({ ...activityForm, name: event.target.value })} /></label>
            <label style={styles.field}>类别<select value={activityForm.kind} onChange={(event) => setActivityForm({ ...activityForm, kind: event.target.value })}><option value="key">关键研发活动</option><option value="general">通用研发能力</option></select></label>
            <button type="submit" style={styles.primaryButton}>{activityForm.id ? '保存活动' : '创建活动'}</button>{' '}
            {activityForm.id && <button type="button" onClick={() => setActivityForm(emptyActivity())} style={styles.secondaryButton}>取消</button>}
          </form>
          <form onSubmit={submitMetric} style={styles.card}>
            <h3>{metricForm.id ? '编辑指标' : '新增指标'}</h3>
            <label style={styles.field}>所属活动<select required value={metricForm.activity_id} onChange={(event) => setMetricForm({ ...metricForm, activity_id: event.target.value })}><option value="">请选择</option>{catalog.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label>
            <label style={styles.field}>代码<input required pattern="[a-z0-9-]+" value={metricForm.code} onChange={(event) => setMetricForm({ ...metricForm, code: event.target.value })} /></label>
            <label style={styles.field}>名称<input required value={metricForm.name} onChange={(event) => setMetricForm({ ...metricForm, name: event.target.value })} /></label>
            <label style={styles.field}>类型<select value={metricForm.type} onChange={(event) => setMetricForm({ ...metricForm, type: event.target.value })}>{['penetration', 'efficiency', 'count', 'boolean', 'ratio'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label style={styles.field}>分子语义<input required value={metricForm.numerator_semantic} onChange={(event) => setMetricForm({ ...metricForm, numerator_semantic: event.target.value })} /></label>
            <label style={styles.field}>分母语义<input value={metricForm.denominator_semantic} onChange={(event) => setMetricForm({ ...metricForm, denominator_semantic: event.target.value })} /></label>
            <p style={styles.muted}>采集方式：仅补录（第一版尚未接入自动采集器）</p>
            <button type="submit" style={styles.primaryButton}>{metricForm.id ? '保存指标' : '创建指标'}</button>{' '}
            {metricForm.id && <button type="button" onClick={() => setMetricForm(emptyMetric())} style={styles.secondaryButton}>取消</button>}
          </form>
        </div>
        <div style={styles.card}>
          <h3>现有目录</h3>
          <table style={styles.table}><thead><tr><th>活动</th><th>指标</th><th>类型 / 采集</th><th>分子 / 分母</th><th>操作</th></tr></thead><tbody>
            {catalog.flatMap((activity) => activity.metrics.map((metric) => <tr key={metric.id}><td>{activity.name}<br /><small>{activity.kind}</small></td><td>{metric.name}<br /><small>{metric.code}</small></td><td>{metric.type} / {metric.collect_method}</td><td>{metric.numerator_semantic} / {metric.denominator_semantic ?? '—'}</td><td style={styles.actions}><button type="button" onClick={() => setMetricForm({ ...metric, activity_id: String(metric.activity_id), denominator_semantic: metric.denominator_semantic ?? '' })} style={styles.secondaryButton}>编辑指标</button><button type="button" onClick={() => window.confirm(`删除指标“${metric.name}”？`) && mutate(`/api/metrics/${metric.id}`, { method: 'DELETE' }, '指标已删除。')} style={styles.dangerButton}>删除指标</button></td></tr>))}
          </tbody></table>
          <p style={styles.muted}>活动编辑与删除可在新增活动表单中完成；仍包含指标或事实记录的条目不能删除。</p>
          <div style={styles.activityActions}>{catalog.map((activity) => <span key={activity.id}><button type="button" onClick={() => setActivityForm(activity)} style={styles.secondaryButton}>编辑 {activity.name}</button><button type="button" onClick={() => window.confirm(`删除活动“${activity.name}”？`) && mutate(`/api/activities/${activity.id}`, { method: 'DELETE' }, '活动已删除。')} style={styles.dangerButton}>删除</button></span>)}</div>
        </div>
      </section>

      <section style={styles.configSection}>
        <h2>用户与角色管理</h2>
        <div style={styles.configGrid}>
          <form onSubmit={submitUser} style={styles.card}>
            <h3>{userForm.id ? '分配角色' : '新增账号'}</h3>
            {!userForm.id && <><label style={styles.field}>账号<input required value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} /></label><label style={styles.field}>初始密码<input required minLength="8" type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></label></>}
            <label style={styles.field}>角色<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value, maintainer_team_id: event.target.value === 'maintainer' ? userForm.maintainer_team_id : '' })}><option value="admin">admin</option><option value="maintainer">maintainer</option><option value="viewer">viewer</option></select></label>
            {userForm.role === 'maintainer' && <label style={styles.field}>绑定团队<select required value={userForm.maintainer_team_id} onChange={(event) => setUserForm({ ...userForm, maintainer_team_id: event.target.value })}><option value="">请选择</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
            <button type="submit" style={styles.primaryButton}>{userForm.id ? '保存角色' : '创建账号'}</button>{' '}
            {userForm.id && <button type="button" onClick={() => setUserForm(emptyUser())} style={styles.secondaryButton}>取消</button>}
          </form>
          <div style={styles.card}>
            <h3>现有账号</h3>
            <table style={styles.table}><thead><tr><th>账号</th><th>角色</th><th>绑定团队</th><th>操作</th></tr></thead><tbody>
              {users.map((account) => <tr key={account.id}><td>{account.username}</td><td>{account.role}</td><td>{teams.find((team) => team.id === account.maintainer_team_id)?.name ?? '—'}</td><td style={styles.actions}><button type="button" onClick={() => setUserForm({ ...account, password: '', maintainer_team_id: account.maintainer_team_id ? String(account.maintainer_team_id) : '' })} style={styles.secondaryButton}>编辑角色</button>{account.id !== user.id && <button type="button" onClick={() => window.confirm(`删除账号“${account.username}”？`) && mutate(`/api/users/${account.id}`, { method: 'DELETE' }, '账号已删除。')} style={styles.dangerButton}>删除</button>}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      </section>
    </main>
  )
}

function ManualEntryPage({ user, onNavigate, onLogout, onSessionExpired }) {
  const [teams, setTeams] = useState([])
  const [catalog, setCatalog] = useState([])
  const [versions, setVersions] = useState([])
  const [teamId, setTeamId] = useState('')
  const [scope, setScope] = useState('iteration')
  const [iterationId, setIterationId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [facts, setFacts] = useState([])
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadingFacts, setLoadingFacts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      fetchJson('/api/teams'),
      fetchJson('/api/catalog'),
      fetchJson('/api/versions'),
    ])
      .then(([nextTeams, nextCatalog, nextVersions]) => {
        if (!active) return
        setTeams(nextTeams)
        setCatalog(nextCatalog)
        setVersions(nextVersions)
      })
      .catch((error) => {
        if (!active) return
        setMessage({ type: 'error', text: error.message })
        if (error.status === 401) onSessionExpired()
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [onSessionExpired])

  const availableTeams = user.role === 'maintainer'
    ? teams.filter((team) => team.id === user.maintainer_team_id)
    : teams
  const allIterations = versions.flatMap((version) => version.iterations.map((iteration) => ({
    ...iteration,
    versionName: version.name,
  })))

  useEffect(() => {
    if (teamId || !availableTeams.length) return
    setTeamId(String(availableTeams[0].id))
  }, [availableTeams, teamId])

  useEffect(() => {
    if (!iterationId && allIterations.length) setIterationId(String(allIterations[0].id))
  }, [allIterations, iterationId])

  const loadCurrentFacts = useCallback(async () => {
    const selectedMetrics = catalog
      .filter((activity) => activity.kind === (scope === 'iteration' ? 'key' : 'general'))
      .flatMap((activity) => activity.metrics)
    const readyForQuery = teamId && (
      scope === 'iteration'
        ? iterationId
        : periodStart && periodEnd
    )
    if (!readyForQuery) {
      setFacts([])
      setValues(Object.fromEntries(selectedMetrics.map((metric) => [metric.id, { numerator: '', denominator: '' }])))
      return
    }

    const params = new URLSearchParams({ team_id: teamId })
    if (scope === 'iteration') {
      params.set('iteration_id', iterationId)
    } else {
      params.set('start_date', periodStart)
      params.set('end_date', periodEnd)
    }

    setLoadingFacts(true)
    try {
      const nextFacts = await fetchJson(`/api/facts?${params.toString()}`)
      const nextValues = Object.fromEntries(selectedMetrics.map((metric) => {
        const fact = nextFacts.find((item) => item.metric_id === metric.id)
        return [metric.id, {
          numerator: fact?.numerator ?? '',
          denominator: fact?.denominator ?? '',
        }]
      }))
      setFacts(nextFacts)
      setValues(nextValues)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      if (error.status === 401) onSessionExpired()
    } finally {
      setLoadingFacts(false)
    }
  }, [catalog, iterationId, onSessionExpired, periodEnd, periodStart, scope, teamId])

  useEffect(() => { loadCurrentFacts() }, [loadCurrentFacts])

  const selectedMetrics = catalog
    .filter((activity) => activity.kind === (scope === 'iteration' ? 'key' : 'general'))
    .flatMap((activity) => activity.metrics)

  function updateValue(metricId, field, value) {
    setValues((previous) => ({
      ...previous,
      [metricId]: { ...(previous[metricId] ?? {}), [field]: value },
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setMessage(null)
    if (scope === 'period' && periodStart > periodEnd) {
      setMessage({ type: 'error', text: '周期开始日期不能晚于结束日期。' })
      return
    }
    const missing = selectedMetrics.filter((metric) => {
      const value = values[metric.id] ?? {}
      return value.numerator === '' || (metric.denominator_semantic && value.denominator === '')
    })
    if (missing.length) {
      setMessage({ type: 'error', text: `请填写全部指标的${missing.map((metric) => metric.name).join('、')}。` })
      return
    }

    setSubmitting(true)
    let savedCount = 0
    let failedMetric = null
    try {
      for (const metric of selectedMetrics) {
        failedMetric = metric
        const value = values[metric.id]
        const payload = {
          team_id: Number(teamId),
          metric_id: metric.id,
          numerator: Number(value.numerator),
          denominator: metric.denominator_semantic ? Number(value.denominator) : null,
        }
        if (scope === 'iteration') payload.iteration_id = Number(iterationId)
        else {
          payload.start_date = periodStart
          payload.end_date = periodEnd
        }
        await fetchJson('/api/facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        savedCount += 1
      }
      setMessage({ type: 'success', text: `已保存 ${selectedMetrics.length} 条补录记录。` })
      await loadCurrentFacts()
    } catch (error) {
      const prefix = savedCount
        ? `已保存 ${savedCount} 条；指标“${failedMetric?.name ?? '未知'}”提交失败：`
        : ''
      setMessage({ type: 'error', text: `${prefix}${error.message}` })
      if (error.status === 401) onSessionExpired()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p style={styles.loading}>加载补录目录中…</p>

  const selectedTeam = availableTeams.find((team) => String(team.id) === teamId)
  const selectedIteration = allIterations.find((iteration) => String(iteration.id) === iterationId)

  return (
    <main style={styles.page}>
      <Navigation user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <h1>数据补录</h1>
      <p style={styles.muted}>补录会追加事实记录；重复补录不会删除历史，当前看板取最新人工记录。</p>
      {message && <p role="alert" style={message.type === 'error' ? styles.error : styles.success}>{message.text}</p>}

      <section style={styles.card}>
        <div style={styles.manualSelectionGrid}>
          <label style={styles.field}>
            团队
            <select value={teamId} disabled={user.role === 'maintainer'} onChange={(event) => setTeamId(event.target.value)}>
              {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            补录范围
            <select value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="iteration">迭代（关键研发活动）</option>
              <option value="period">周期（通用研发能力）</option>
            </select>
          </label>
          {scope === 'iteration' ? (
            <label style={styles.field}>
              迭代
              <select value={iterationId} onChange={(event) => setIterationId(event.target.value)}>
                {allIterations.map((iteration) => <option key={iteration.id} value={iteration.id}>{iteration.versionName} / {iteration.name}</option>)}
              </select>
            </label>
          ) : (
            <>
              <label style={styles.field}>周期开始<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
              <label style={styles.field}>周期结束<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
            </>
          )}
        </div>
        {scope === 'iteration' && selectedIteration && (
          <p style={styles.muted}>迭代时间：{selectedIteration.start_date} 至 {selectedIteration.end_date}</p>
        )}
        {selectedTeam && <p style={styles.muted}>当前团队：{selectedTeam.name}</p>}
      </section>

      <form onSubmit={submit} style={{ ...styles.card, marginTop: '1.25rem' }}>
        <h2>{scope === 'iteration' ? '关键研发活动指标' : '通用研发能力指标'}</h2>
        {loadingFacts ? <p style={styles.loading}>读取已有记录中…</p> : selectedMetrics.length === 0 ? (
          <p style={styles.muted}>当前目录没有可补录指标。</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead><tr><th>指标</th><th>分子</th><th>分母</th><th>当前记录</th></tr></thead>
                <tbody>
                  {selectedMetrics.map((metric) => {
                    const value = values[metric.id] ?? { numerator: '', denominator: '' }
                    const fact = facts.find((item) => item.metric_id === metric.id)
                    return (
                      <tr key={metric.id}>
                        <td><strong>{metric.name}</strong><br /><small>{metric.numerator_semantic}</small></td>
                        <td><input required type="number" step="any" value={value.numerator} onChange={(event) => updateValue(metric.id, 'numerator', event.target.value)} /></td>
                        <td>{metric.denominator_semantic ? <><input required type="number" step="any" value={value.denominator} onChange={(event) => updateValue(metric.id, 'denominator', event.target.value)} /><br /><small>{metric.denominator_semantic}</small></> : <span style={styles.muted}>不适用</span>}</td>
                        <td>{fact ? <small>{fact.source === 'manual' ? 'manual' : 'auto'} / {fact.entered_by}<br />{new Date(fact.entered_at).toLocaleString('zh-CN')}</small> : <span style={styles.muted}>暂无</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button type="submit" disabled={submitting || !teamId || (scope === 'iteration' ? !iterationId : !periodStart || !periodEnd)} style={styles.primaryButton}>
              {submitting ? '保存中…' : '保存全部指标'}
            </button>
          </>
        )}
      </form>
    </main>
  )
}

function Navigation({ user, onNavigate, onLogout }) {
  return (
    <nav style={styles.navigation} aria-label="主导航">
      <button type="button" onClick={() => onNavigate('/')} style={styles.navButton}>
        看板
      </button>
      {user?.role === 'admin' && (
        <button type="button" onClick={() => onNavigate('/config')} style={styles.navButton}>
          配置
        </button>
      )}
      {(user?.role === 'admin' || user?.role === 'maintainer') && (
        <button type="button" onClick={() => onNavigate('/manual-entry')} style={styles.navButton}>
          补录
        </button>
      )}
      <span style={styles.spacer} />
      {user && <span style={styles.muted}>{user.username}（{user.role}）</span>}
      {onLogout && (
        <button type="button" onClick={onLogout} style={styles.navButton}>
          登出
        </button>
      )}
    </nav>
  )
}

function Dashboard({ user, onNavigate, onLogout, onSessionExpired }) {
  const [catalog, setCatalog] = useState(null)
  const [teams, setTeams] = useState(null)
  const [facts, setFacts] = useState(null)
  const [error, setError] = useState(null)
  const chartRef = useRef(null)

  useEffect(() => {
    let active = true
    Promise.all([
      fetchJson('/api/catalog'),
      fetchJson('/api/teams'),
      fetchJson('/api/facts'),
    ])
      .then(([nextCatalog, nextTeams, nextFacts]) => {
        if (!active) return
        setCatalog(nextCatalog)
        setTeams(nextTeams)
        setFacts(nextFacts)
      })
      .catch((nextError) => {
        if (active) setError(nextError)
        if (active && nextError.status === 401) onSessionExpired()
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!teams || !facts || !chartRef.current) return undefined
    const counts = Object.entries(
      facts.reduce((acc, fact) => ((acc[fact.team_id] = (acc[fact.team_id] ?? 0) + 1), acc), {}),
    )
    const chart = echarts.init(chartRef.current)
    chart.setOption({
      grid: { left: 80, right: 24, top: 24, bottom: 32 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: counts.map(([id]) => teams.find((team) => team.id === Number(id))?.name ?? id),
      },
      series: [{ type: 'bar', barMaxWidth: 24, data: counts.map(([, count]) => count) }],
    })
    return () => chart.dispose()
  }, [teams, facts])

  if (error) {
    return (
      <main style={styles.page}>
        <Navigation user={user} onNavigate={onNavigate} onLogout={onLogout} />
        <p style={styles.error}>后端连接失败：{error.message}</p>
      </main>
    )
  }
  if (!catalog || !teams || !facts) {
    return <p style={styles.loading}>加载中…</p>
  }

  return (
    <main style={styles.page}>
      <Navigation user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <h1>研发提效看板</h1>
      <p>
        活动 {catalog.length} 个（关键 {catalog.filter((activity) => activity.kind === 'key').length} / 通用{' '}
        {catalog.filter((activity) => activity.kind === 'general').length}）、团队 {teams.length} 个、事实记录{' '}
        {facts.length} 条。
      </p>
      <ul>
        {catalog.map((activity) => (
          <li key={activity.code}>
            {activity.name}（{activity.kind === 'key' ? '关键研发活动' : '通用研发能力'}）：
            {activity.metrics.map((metric) => `${metric.name}[${metric.type}]`).join('、')}
          </li>
        ))}
      </ul>
      <div ref={chartRef} style={{ width: '100%', height: 240 }} />
    </main>
  )
}

const styles = {
  page: { fontFamily: 'system-ui, sans-serif', margin: '2rem' },
  centeredPage: {
    alignItems: 'center',
    background: '#f7f8fa',
    display: 'flex',
    fontFamily: 'system-ui, sans-serif',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  loginCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    maxWidth: 360,
    padding: '2rem',
    width: 'calc(100% - 4rem)',
  },
  field: { display: 'grid', gap: 6, margin: '1rem 0' },
  primaryButton: {
    background: '#2563eb',
    border: 0,
    borderRadius: 6,
    color: 'white',
    cursor: 'pointer',
    padding: '0.65rem 1rem',
  },
  navigation: { alignItems: 'center', display: 'flex', gap: 8, marginBottom: '2rem' },
  navButton: { background: 'transparent', border: 0, cursor: 'pointer', padding: '0.4rem 0.6rem' },
  spacer: { flex: 1 },
  card: { border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.5rem' },
  configSection: { marginTop: '2.5rem' },
  configGrid: { alignItems: 'start', display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 2fr)' },
  manualSelectionGrid: { alignItems: 'end', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' },
  listField: { border: '1px solid #cbd5e1', borderRadius: 6, display: 'grid', gap: 8, margin: '1rem 0', padding: '0.75rem' },
  inlineField: { alignItems: 'center', display: 'flex', gap: 8 },
  secondaryButton: { background: 'white', border: '1px solid #94a3b8', borderRadius: 6, cursor: 'pointer', padding: '0.4rem 0.6rem' },
  dangerButton: { background: 'white', border: '1px solid #dc2626', borderRadius: 6, color: '#b91c1c', cursor: 'pointer', padding: '0.4rem 0.6rem' },
  success: { color: '#15803d' },
  table: { borderCollapse: 'collapse', fontSize: '0.9rem', width: '100%' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  activityActions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  muted: { color: '#64748b' },
  error: { color: '#b91c1c' },
  loading: { fontFamily: 'system-ui, sans-serif', margin: '2rem' },
}

export default function App() {
  const [pathname, navigate] = usePathname()
  const [user, setUser] = useState(undefined)
  const [authError, setAuthError] = useState(null)
  const [returnPath, setReturnPath] = useState(null)

  useEffect(() => {
    fetchJson('/api/auth/me')
      .then(setUser)
      .catch((error) => {
        if (error.status === 401) {
          setUser(null)
          if (pathname !== '/login') {
            setReturnPath(pathname)
            navigate('/login')
          }
        } else {
          setAuthError(error.message)
        }
      })
  }, [])

  async function login(credentials) {
    try {
      const loggedInUser = await fetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      setAuthError(null)
      setUser(loggedInUser)
      const destination = pathname === '/login' ? (returnPath ?? '/') : pathname
      setReturnPath(null)
      navigate(destination)
    } catch (error) {
      setAuthError(error.status === 401 ? '账号或密码错误。' : error.message)
      throw error
    }
  }

  async function logout() {
    await fetchJson('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null)
    navigate('/login')
  }

  function sessionExpired() {
    setAuthError('会话已过期，请重新登录。')
    setUser(null)
    setReturnPath(pathname)
    navigate('/login')
  }

  if (user === undefined) {
    if (authError) {
      return <p style={styles.error}>认证服务不可用：{authError}</p>
    }
    return <p style={styles.loading}>加载中…</p>
  }
  if (!user) {
    return <LoginPage onLogin={login} error={authError} />
  }

  if (pathname === '/config' && user.role !== 'admin') {
    return <ForbiddenPage onNavigate={navigate} />
  }
  if (pathname === '/manual-entry' && !['admin', 'maintainer'].includes(user.role)) {
    return <ForbiddenPage onNavigate={navigate} />
  }
  if (pathname === '/config') {
    return <ConfigPage user={user} onNavigate={navigate} onLogout={logout} onSessionExpired={sessionExpired} />
  }
  if (pathname === '/manual-entry') {
    return <ManualEntryPage user={user} onNavigate={navigate} onLogout={logout} onSessionExpired={sessionExpired} />
  }
  return (
    <Dashboard
      user={user}
      onNavigate={navigate}
      onLogout={logout}
      onSessionExpired={sessionExpired}
    />
  )
}
