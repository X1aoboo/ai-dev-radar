import { useEffect, useRef, useState } from 'react'
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

function PlaceholderPage({ title, user, onNavigate, onLogout }) {
  return (
    <main style={styles.page}>
      <Navigation user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <section style={styles.card}>
        <h1>{title}</h1>
        <p style={styles.muted}>页面入口已受权限保护，业务内容将在后续功能票中实现。</p>
      </section>
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
    return <PlaceholderPage title="配置" user={user} onNavigate={navigate} onLogout={logout} />
  }
  if (pathname === '/manual-entry') {
    return <PlaceholderPage title="补录" user={user} onNavigate={navigate} onLogout={logout} />
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
