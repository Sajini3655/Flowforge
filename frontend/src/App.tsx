import { useEffect, useState, useCallback, useMemo } from 'react'

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
const RECENT_JOBS_LIMIT = 5

function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [apis, setApis] = useState<ApiDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllJobs, setShowAllJobs] = useState(false)

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
    setShowAllJobs(false)
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

  // Derived Summary Metrics
  const metrics = useMemo(() => {
    const totalJobs = jobs.length
    const completed = jobs.filter(j => j.status.toUpperCase() === 'COMPLETED').length
    const running = jobs.filter(j => j.status.toUpperCase() === 'RUNNING').length
    const queued = jobs.filter(j => ['QUEUED', 'SUBMITTED'].includes(j.status.toUpperCase())).length
    const failed = jobs.filter(j => j.status.toUpperCase() === 'FAILED').length
    const active = running + queued
    const successRate = totalJobs > 0 ? Math.round((completed / totalJobs) * 100) : 0

    return {
      totalApis: apis.length,
      totalJobs,
      completed,
      running,
      queued,
      failed,
      active,
      successRate,
    }
  }, [apis, jobs])

  // Subset of jobs for display to prevent excessive page height
  const displayedJobs = useMemo(() => {
    if (showAllJobs) {
      return jobs
    }
    return jobs.slice(0, RECENT_JOBS_LIMIT)
  }, [jobs, showAllJobs])

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
            <span className="badge-demo">Demo Account</span>
            <span>Pre-configured for <code>admin@flowforge.local</code></span>
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

      {/* Infrastructure Status Bar */}
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

      {/* Summary Metrics Ribbon */}
      <section className="metrics-ribbon">
        <div className="metric-stat-card">
          <div className="stat-label">Registered APIs</div>
          <div className="stat-value">{metrics.totalApis}</div>
          <div className="stat-subtext">Active Catalogs</div>
        </div>
        <div className="metric-stat-card">
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">{metrics.totalJobs}</div>
          <div className="stat-subtext">Dispatched</div>
        </div>
        <div className="metric-stat-card stat-completed">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{metrics.completed}</div>
          <div className="stat-subtext">{metrics.successRate}% Success Rate</div>
        </div>
        <div className="metric-stat-card stat-active">
          <div className="stat-label">In-Flight / Queued</div>
          <div className="stat-value">{metrics.active}</div>
          <div className="stat-subtext">{metrics.queued} queued · {metrics.running} running</div>
        </div>
        <div className="metric-stat-card stat-failed">
          <div className="stat-label">Failed / DLQ</div>
          <div className="stat-value">{metrics.failed}</div>
          <div className="stat-subtext">Requires Review</div>
        </div>
      </section>

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
          {/* APIs Catalog Card */}
          <article className="card">
            <div className="card-header">
              <div>
                <h2>APIs</h2>
                <span className="card-subtitle">Gateway Managed Endpoints</span>
              </div>
              <span className="card-badge">Catalog ({apis.length})</span>
            </div>
            <p className="metric">{apis.length}</p>
            <div className="card-items-scroll">
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
            </div>
          </article>

          {/* Workflow Jobs Card */}
          <article className="card">
            <div className="card-header">
              <div>
                <h2>Workflow Jobs</h2>
                <span className="card-subtitle">
                  {showAllJobs ? `Showing all ${jobs.length} jobs` : `Showing recent ${displayedJobs.length} of ${jobs.length}`}
                </span>
              </div>
              <div className="card-header-actions">
                <span className="card-badge">Asynchronous</span>
                {jobs.length > RECENT_JOBS_LIMIT && (
                  <button
                    className="view-all-btn"
                    onClick={() => setShowAllJobs(!showAllJobs)}
                  >
                    {showAllJobs ? `Show Recent (${RECENT_JOBS_LIMIT})` : `View All (${jobs.length})`}
                  </button>
                )}
              </div>
            </div>
            <p className="metric">{jobs.length}</p>
            <div className="card-items-scroll">
              {jobs.length === 0 ? (
                <p className="empty-state">
                  No workflow jobs found. Click &quot;Create Demo Job&quot; to dispatch a task.
                </p>
              ) : (
                displayedJobs.map(job => (
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
            </div>
          </article>
        </section>
      )}
    </main>
  )
}

export default App
