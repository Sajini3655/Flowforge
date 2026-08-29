import { useEffect, useState, useCallback } from 'react'

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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

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

  const handleLogout = useCallback((reason?: string) => {
    setToken('')
    setUserEmail('')
    localStorage.removeItem('flowforge_token')
    localStorage.removeItem('flowforge_user')
    setJobs([])
    setApis([])
    setError(null)
    if (reason) {
      setAuthError(reason)
    }
  }, [])

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
        if (res.status === 401) {
          throw new Error('Invalid email or password.')
        }
        throw new Error(`Authentication failed (HTTP ${res.status}).`)
      }
      const data = await res.json()
      if (data.token) {
        setToken(data.token)
        const email = data.user?.email || emailInput
        setUserEmail(email)
        localStorage.setItem('flowforge_token', data.token)
        localStorage.setItem('flowforge_user', email)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      setAuthError(msg)
    } finally {
      setAuthLoading(false)
    }
  }

  const loadData = useCallback(async () => {
    // Strictly do not fetch protected endpoints when unauthenticated
    if (!token) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      }

      const [jobsRes, apisRes] = await Promise.all([
        fetch(`${API_BASE}/jobs`, { headers }),
        fetch(`${API_BASE}/apis`, { headers }),
      ])

      // If token expired or rejected, clear session cleanly and return to sign in
      if (jobsRes.status === 401 || apisRes.status === 401) {
        handleLogout('Your session has expired. Please sign in again.')
        return
      }

      if (!jobsRes.ok || !apisRes.ok) {
        throw new Error(`Data fetch failed (jobs: ${jobsRes.status}, apis: ${apisRes.status})`)
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
  }, [token, handleLogout])

  async function createDemoJob() {
    if (!token) return
    setError(null)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': `demo-${Date.now()}`,
        'Authorization': `Bearer ${token}`,
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

      if (res.status === 401) {
        handleLogout('Your session has expired. Please sign in again.')
        return
      }

      if (!res.ok) {
        throw new Error(`Job creation returned HTTP ${res.status}`)
      }

      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating job'
      setError(msg)
    }
  }

  // Effect is conditionally triggered only when token is present
  useEffect(() => {
    if (token) {
      loadData()
    }
  }, [token, loadData])

  function getStatusClass(status: string) {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'status-tag status-completed'
      case 'RUNNING':
        return 'status-tag status-running'
      case 'FAILED':
        return 'status-tag status-failed'
      case 'SUBMITTED':
      case 'QUEUED':
      default:
        return 'status-tag status-submitted'
    }
  }

  // --- UNMISTAKABLE CLEAN LANDING & SIGN IN VIEW ---
  if (!token) {
    return (
      <main className="container">
        <header className="hero-header">
          <p className="eyebrow">API Management & Distributed Workflow Platform</p>
          <h1>FlowForge</h1>
          <p className="subtitle">
            Manage APIs, submit workflow jobs, and monitor distributed processing.
          </p>
        </header>

        <section className="login-card">
          <div className="login-card-header">
            <h2>Sign In to Console</h2>
            <p>Access the API catalog, job orchestrator, and real-time system metrics.</p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="admin@flowforge.local"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                required
              />
            </div>

            {authError && <div className="auth-error-banner">{authError}</div>}

            <button type="submit" className="primary-btn signin-btn" disabled={authLoading}>
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="demo-credentials-callout">
            <span className="badge-demo">Demo Credentials</span>
            <span><code>admin@flowforge.local</code> / <code>Admin123!</code></span>
          </div>
        </section>

        <section className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🛡️</div>
            <h3>API Gateway & Security</h3>
            <p>Managed endpoint catalog with WSO2 API Manager and RS256 asymmetric JWT verification.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Transactional Outbox</h3>
            <p>Guaranteed event publishing via PostgreSQL CDC outbox pattern and RabbitMQ retries with DLQ.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Distributed Reliability</h3>
            <p>Atomic Redis distributed locking to prevent duplicate workflow runs with idempotency checks.</p>
          </div>
        </section>
      </main>
    )
  }

  // --- AUTHENTICATED DASHBOARD VIEW ---
  return (
    <main className="container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">FlowForge Platform</p>
          <h1>Dashboard</h1>
          <p className="subtitle">
            Manage APIs, submit workflow jobs, and monitor distributed processing.
          </p>
        </div>

        <div className="session-pill">
          <div className="user-details">
            <span className="auth-badge">Active Session</span>
            <strong>{userEmail || 'admin@flowforge.local'}</strong>
          </div>
          <button className="secondary logout-btn" onClick={() => handleLogout()}>
            Sign Out
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="dashboard-status-bar">
        <div className="status-item">
          <span className="status-indicator online"></span>
          <span>PostgreSQL: <strong>Connected</strong></span>
        </div>
        <div className="status-item">
          <span className="status-indicator online"></span>
          <span>RabbitMQ: <strong>Connected</strong></span>
        </div>
        <div className="status-item">
          <span className="status-indicator online"></span>
          <span>Redis: <strong>Connected</strong></span>
        </div>
      </div>

      <section className="actions">
        <button onClick={createDemoJob}>
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
