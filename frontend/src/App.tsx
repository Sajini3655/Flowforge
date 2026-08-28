import { useEffect, useState } from 'react'

type Job = {
  id: string
  type: string
  requestPayload: string
  result: string | null
  status: string
  attemptCount?: number
  idempotencyKey?: string | null
}

type ApiDefinition = {
  id: number
  name: string
  description: string
  version: string
  basePath: string
  backendUrl: string
  status: string
}

const API_BASE = 'http://localhost:8080/api'

function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [apis, setApis] = useState<ApiDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Authentication state
  const [token, setToken] = useState<string>(() => localStorage.getItem('flowforge_token') || '')
  const [userEmail, setUserEmail] = useState<string>(() => localStorage.getItem('flowforge_user') || '')
  const [emailInput, setEmailInput] = useState('admin@flowforge.local')
  const [passwordInput, setPasswordInput] = useState('Admin123!')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput }),
      })
      if (!res.ok) {
        throw new Error(`Login failed with status ${res.status}`)
      }
      const data = await res.json()
      if (data.token) {
        setToken(data.token)
        setUserEmail(emailInput)
        localStorage.setItem('flowforge_token', data.token)
        localStorage.setItem('flowforge_user', emailInput)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      setAuthError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    setToken('')
    setUserEmail('')
    localStorage.removeItem('flowforge_token')
    localStorage.removeItem('flowforge_user')
    setJobs([])
    setApis([])
  }

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const [jobsRes, apisRes] = await Promise.all([
        fetch(`${API_BASE}/jobs`, { headers }),
        fetch(`${API_BASE}/apis`, { headers }),
      ])

      if (jobsRes.status === 401 || apisRes.status === 401) {
        setError('Authentication required. Log in above to access workflow jobs and registered APIs.')
        setJobs([])
        setApis([])
        return
      }

      const jobsData = await jobsRes.json()
      const apisData = await apisRes.json()

      setJobs(Array.isArray(jobsData) ? jobsData : [])
      setApis(Array.isArray(apisData) ? apisData : [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to FlowForge backend'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function createDemoJob() {
    setError(null)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': `demo-${Date.now()}`,
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'DATA_AGGREGATION',
          requestPayload: JSON.stringify({
            datasetId: Math.floor(Math.random() * 1000) + 1,
            format: 'PARQUET',
            timestamp: new Date().toISOString(),
          }),
        }),
      })

      if (!res.ok) {
        throw new Error(`Job creation returned HTTP ${res.status}`)
      }

      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating job'
      setError(msg)
    }
  }

  useEffect(() => {
    loadData()
  }, [token])

  function getStatusClass(status: string) {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'status-tag status-completed'
      case 'RUNNING':
        return 'status-tag status-running'
      case 'FAILED':
        return 'status-tag status-failed'
      case 'SUBMITTED':
      default:
        return 'status-tag status-submitted'
    }
  }

  return (
    <main className="container">
      <header>
        <p className="eyebrow">API Management + Distributed Workflow Platform</p>
        <h1>FlowForge</h1>
        <p className="subtitle">
          Distributed asynchronous workflow processing with Transactional Outbox, RabbitMQ, and Redis locking.
        </p>
      </header>

      {/* Authentication & Session Header */}
      <section className="auth-card">
        {token ? (
          <div className="auth-session">
            <div className="auth-user-info">
              <span className="auth-badge">Active Session</span>
              <strong>{userEmail || 'Authenticated User'}</strong>
            </div>
            <button className="secondary logout-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-inputs">
              <input
                type="email"
                placeholder="Email address"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                required
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
            {authError && <p className="auth-error-msg">{authError}</p>}
          </form>
        )}
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="actions">
        <button onClick={createDemoJob} disabled={!token}>
          Create Demo Job
        </button>
        <button className="secondary" onClick={loadData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {loading ? (
        <p className="loading-indicator">Loading system data...</p>
      ) : (
        <section className="grid">
          <article className="card">
            <div className="card-header">
              <h2>APIs</h2>
              <span className="card-badge">Catalog</span>
            </div>
            <p className="metric">{apis.length}</p>
            {apis.length === 0 ? (
              <p className="empty-state">No API definitions registered.</p>
            ) : (
              apis.map(api => (
                <div className="item" key={api.id}>
                  <div className="item-title-row">
                    <strong>{api.name}</strong>
                    <span className="status-tag status-completed">{api.status}</span>
                  </div>
                  <span>{api.version} · {api.basePath}</span>
                  <small className="monospace">{api.backendUrl}</small>
                </div>
              ))
            )}
          </article>

          <article className="card">
            <div className="card-header">
              <h2>Workflow Jobs</h2>
              <span className="card-badge">Asynchronous</span>
            </div>
            <p className="metric">{jobs.length}</p>
            {jobs.length === 0 ? (
              <p className="empty-state">
                No workflow jobs found. Click &quot;Create Demo Job&quot; to dispatch a task.
              </p>
            ) : (
              jobs.map(job => (
                <div className="item" key={job.id}>
                  <div className="item-title-row">
                    <strong>{job.type}</strong>
                    <span className={getStatusClass(job.status)}>{job.status}</span>
                  </div>
                  <small className="monospace">{job.id}</small>
                  {job.result && <span className="job-result">{job.result}</span>}
                </div>
              ))
            )}
          </article>
        </section>
      )}
    </main>
  )
}

export default App
