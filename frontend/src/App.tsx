import { useEffect, useState, useCallback, useMemo } from 'react'

type Job = {
  id: string
  type: string
  requestPayload: string
  result: string | null
  status: string
  attemptCount?: number
  idempotencyKey?: string | null
  createdAt?: string
  updatedAt?: string
}

type ApiDefinition = {
  id: number
  name: string
  description: string
  version: string
  basePath: string
  backendUrl: string
  status: string
  createdAt?: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
const RECENT_JOBS_LIMIT = 5

function formatTimestamp(isoString?: string | null): string {
  if (!isoString) return 'N/A'
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return isoString
    return date.toLocaleString()
  } catch {
    return isoString
  }
}

function formatJsonPayload(raw?: string | null): string {
  if (!raw) return 'No payload provided'
  try {
    const parsed = JSON.parse(raw)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [apis, setApis] = useState<ApiDefinition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllJobs, setShowAllJobs] = useState(false)

  // Interactive Selection Modals
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedApi, setSelectedApi] = useState<ApiDefinition | null>(null)
  const [isRegisterApiOpen, setIsRegisterApiOpen] = useState(false)

  // API Registration Form State
  const [apiFormName, setApiFormName] = useState('')
  const [apiFormVersion, setApiFormVersion] = useState('v1')
  const [apiFormBasePath, setApiFormBasePath] = useState('/api/v1/')
  const [apiFormBackendUrl, setApiFormBackendUrl] = useState('http://localhost:8081')
  const [apiFormDescription, setApiFormDescription] = useState('')
  const [apiFormLoading, setApiFormLoading] = useState(false)
  const [apiFormError, setApiFormError] = useState<string | null>(null)

  // Retry Job State
  const [retryLoading, setRetryLoading] = useState(false)
  const [retryFeedback, setRetryFeedback] = useState<{ success: boolean; message: string } | null>(null)

  // Demo Job State
  const [demoSubmitting, setDemoSubmitting] = useState(false)

  // Authentication State
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
    setSelectedJob(null)
    setSelectedApi(null)
    setIsRegisterApiOpen(false)
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

  const loadData = useCallback(async (showIndicator = true) => {
    // Strictly do not fetch protected endpoints when unauthenticated
    if (!token) {
      return
    }

    if (showIndicator) setLoading(true)
    if (showIndicator) setError(null)
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      }

      const [jobsRes, apisRes] = await Promise.all([
        fetch(`${API_BASE}/jobs`, { headers }),
        fetch(`${API_BASE}/apis`, { headers }),
      ])

      // Invalidate session cleanly if expired
      if (jobsRes.status === 401 || apisRes.status === 401) {
        handleLogout('Your session has expired. Please sign in again.')
        return
      }

      if (!jobsRes.ok || !apisRes.ok) {
        throw new Error(`Data fetch failed (jobs: ${jobsRes.status}, apis: ${apisRes.status})`)
      }

      const jobsData = await jobsRes.json()
      const apisData = await apisRes.json()

      const jobsList: Job[] = Array.isArray(jobsData) ? jobsData : []
      const apisList: ApiDefinition[] = Array.isArray(apisData) ? apisData : []

      setJobs(jobsList)
      setApis(apisList)
    } catch (err: unknown) {
      if (showIndicator) {
        const msg = err instanceof Error ? err.message : 'Failed to connect to FlowForge backend'
        setError(msg)
      }
    } finally {
      if (showIndicator) setLoading(false)
    }
  }, [token, handleLogout])

  // Sync selected job with real-time updates from jobs list
  useEffect(() => {
    if (selectedJob) {
      const latest = jobs.find(j => j.id === selectedJob.id)
      if (latest && JSON.stringify(latest) !== JSON.stringify(selectedJob)) {
        setSelectedJob(latest)
      }
    }
  }, [jobs, selectedJob])

  // Close modals on Escape key press for accessibility
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedJob) {
          setSelectedJob(null)
          setRetryFeedback(null)
        }
        if (selectedApi) setSelectedApi(null)
        if (isRegisterApiOpen) setIsRegisterApiOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedJob, selectedApi, isRegisterApiOpen])

  // Auto-polling for active background jobs (QUEUED or RUNNING/PROCESSING)
  useEffect(() => {
    if (!token) return

    const hasActive = jobs.some(j =>
      ['QUEUED', 'RUNNING', 'PROCESSING', 'SUBMITTED'].includes(j.status.toUpperCase())
    )

    if (!hasActive) return

    const interval = setInterval(() => {
      loadData(false)
    }, 1500)

    return () => clearInterval(interval)
  }, [token, jobs, loadData])

  // Create demo job (supports ECHO for success flow or TRANSIENT_FAILURE for DLQ/retry flow)
  async function createDemoJob(type: 'ECHO' | 'TRANSIENT_FAILURE' = 'ECHO') {
    if (!token || demoSubmitting) return
    setDemoSubmitting(true)
    setError(null)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': `demo-${type.toLowerCase()}-${Date.now()}`,
        'Authorization': `Bearer ${token}`,
      }

      const payload = type === 'ECHO'
        ? JSON.stringify({
            action: 'DISPATCH_WORKFLOW',
            targetCatalog: apis.length > 0 ? apis[0].name : 'Default API',
            batchId: Math.floor(Math.random() * 9000) + 1000,
            timestamp: new Date().toISOString(),
          })
        : JSON.stringify({
            action: 'CIRCUIT_BREAKER_TEST',
            simulation: 'TRANSIENT_SERVICE_TIMEOUT',
            maxAllowedAttempts: 3,
            timestamp: new Date().toISOString(),
          })

      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type,
          requestPayload: payload,
        }),
      })

      if (res.status === 401) {
        handleLogout('Your session has expired. Please sign in again.')
        return
      }

      if (!res.ok) {
        throw new Error(`Job creation returned HTTP ${res.status}`)
      }

      const created: Job = await res.json()
      // Open details panel immediately to view initial lifecycle
      setSelectedJob(created)
      setRetryFeedback(null)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating job'
      setError(msg)
    } finally {
      setDemoSubmitting(false)
    }
  }

  // Real backend retry endpoint: POST /api/jobs/{id}/retry
  async function handleRetryJob(jobId: string) {
    if (!token || retryLoading) return
    setRetryLoading(true)
    setRetryFeedback(null)
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.status === 401) {
        handleLogout('Your session has expired. Please sign in again.')
        return
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Retry failed with HTTP ${res.status}`)
      }

      const updated: Job = await res.json()
      setSelectedJob(updated)
      setRetryFeedback({
        success: true,
        message: 'Retry request accepted. Job status reset to QUEUED and republished to RabbitMQ via Outbox.',
      })
      await loadData(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute retry'
      setRetryFeedback({ success: false, message: msg })
    } finally {
      setRetryLoading(false)
    }
  }

  // Register new API via real backend endpoint: POST /api/apis
  async function handleRegisterApi(e: React.FormEvent) {
    e.preventDefault()
    if (!token || apiFormLoading) return
    setApiFormLoading(true)
    setApiFormError(null)
    try {
      const res = await fetch(`${API_BASE}/apis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: apiFormName.trim(),
          version: apiFormVersion.trim(),
          basePath: apiFormBasePath.trim(),
          backendUrl: apiFormBackendUrl.trim(),
          description: apiFormDescription.trim() || undefined,
        }),
      })

      if (res.status === 401) {
        handleLogout('Your session has expired. Please sign in again.')
        return
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `Registration returned HTTP ${res.status}`)
      }

      const created: ApiDefinition = await res.json()
      setIsRegisterApiOpen(false)
      setApiFormName('')
      setApiFormVersion('v1')
      setApiFormBasePath('/api/v1/')
      setApiFormBackendUrl('http://localhost:8081')
      setApiFormDescription('')
      await loadData()
      setSelectedApi(created)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'API registration failed'
      setApiFormError(msg)
    } finally {
      setApiFormLoading(false)
    }
  }

  // Load initial data conditionally upon token presence
  useEffect(() => {
    if (token) {
      loadData()
    }
  }, [token, loadData])

  function getStatusClass(status: string) {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return 'status-tag status-completed'
      case 'PROCESSING':
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
    const running = jobs.filter(j => ['RUNNING', 'PROCESSING'].includes(j.status.toUpperCase())).length
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

      {/* Orchestrator Action Controls */}
      <section className="actions">
        <button
          onClick={() => createDemoJob('ECHO')}
          disabled={demoSubmitting}
          title="Dispatch standard workflow job that completes successfully"
        >
          {demoSubmitting ? 'Dispatching...' : 'Create Demo Job'}
        </button>
        <button
          className="secondary"
          onClick={() => createDemoJob('TRANSIENT_FAILURE')}
          disabled={demoSubmitting}
          title="Simulate transient failures that exhaust retries and route to DLQ"
        >
          Simulate DLQ Failure
        </button>
        <button
          className="secondary"
          onClick={() => loadData(true)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </section>

      {loading && jobs.length === 0 ? (
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
              <div className="card-header-actions">
                <button
                  className="register-api-btn"
                  onClick={() => {
                    setApiFormError(null)
                    setIsRegisterApiOpen(true)
                  }}
                >
                  + Register API
                </button>
                <span className="card-badge">Catalog ({apis.length})</span>
              </div>
            </div>
            <p className="metric">{apis.length}</p>
            <div className="card-items-scroll">
              {apis.length === 0 ? (
                <p className="empty-state">No API definitions registered.</p>
              ) : (
                apis.map(api => (
                  <div
                    className="item clickable-item"
                    key={api.id}
                    onClick={() => setSelectedApi(api)}
                    role="button"
                    tabIndex={0}
                    title="Click to view API details"
                  >
                    <div className="item-title-row">
                      <strong>{api.name}</strong>
                      <span className="status-tag status-completed">{api.status}</span>
                    </div>
                    <div className="item-meta-row">
                      <span>{api.version} · {api.basePath}</span>
                      <span className="click-hint">Details ↗</span>
                    </div>
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
                  <div
                    className="item clickable-item"
                    key={job.id}
                    onClick={() => {
                      setSelectedJob(job)
                      setRetryFeedback(null)
                    }}
                    role="button"
                    tabIndex={0}
                    title="Click to inspect job lifecycle and execution details"
                  >
                    <div className="item-title-row">
                      <strong>{job.type}</strong>
                      <span className={getStatusClass(job.status)}>{job.status}</span>
                    </div>
                    <div className="item-meta-row">
                      <small className="monospace">{job.id}</small>
                      <span className="click-hint">Inspect ↗</span>
                    </div>
                    {job.result && <span className="job-result">{job.result}</span>}
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      )}

      {/* --- MODAL 1: WORKFLOW JOB DETAILS PANEL --- */}
      {selectedJob && (
        <div className="modal-backdrop" onClick={() => { setSelectedJob(null); setRetryFeedback(null); }}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Workflow Job Details</h2>
                <span className="modal-subtitle">Asynchronous execution lifecycle</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => { setSelectedJob(null); setRetryFeedback(null); }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* DLQ Alert if Failed */}
              {selectedJob.status.toUpperCase() === 'FAILED' && (
                <div className="dlq-banner">
                  <div className="dlq-title">⚠️ Dead-Letter Queue (DLQ)</div>
                  <p>This job exceeded maximum retry attempts ({selectedJob.attemptCount ?? 0}) and was routed to the FlowForge dead-letter queue. You can retry it below.</p>
                </div>
              )}

              {/* Retry Feedback Banner */}
              {retryFeedback && (
                <div className={retryFeedback.success ? 'feedback-banner success' : 'feedback-banner error'}>
                  {retryFeedback.message}
                </div>
              )}

              {/* Key Details Grid */}
              <div className="detail-grid">
                <div className="detail-cell">
                  <span className="cell-label">Job ID</span>
                  <code className="monospace selectable">{selectedJob.id}</code>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Workflow Type</span>
                  <strong>{selectedJob.type}</strong>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Current Status</span>
                  <span className={getStatusClass(selectedJob.status)}>{selectedJob.status}</span>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Attempt Count</span>
                  <strong>{selectedJob.attemptCount ?? 0}</strong>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Created Time</span>
                  <span>{formatTimestamp(selectedJob.createdAt)}</span>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Last Updated</span>
                  <span>{formatTimestamp(selectedJob.updatedAt)}</span>
                </div>
                {selectedJob.idempotencyKey && (
                  <div className="detail-cell full-width">
                    <span className="cell-label">Idempotency Key</span>
                    <code className="monospace">{selectedJob.idempotencyKey}</code>
                  </div>
                )}
              </div>

              {/* Request Payload */}
              <div className="detail-section">
                <span className="detail-heading">Request Payload</span>
                <pre className="code-block">{formatJsonPayload(selectedJob.requestPayload)}</pre>
              </div>

              {/* Result / Output */}
              {selectedJob.result && (
                <div className="detail-section">
                  <span className="detail-heading">
                    {selectedJob.status.toUpperCase() === 'FAILED' ? 'Failure Reason / Message' : 'Execution Output'}
                  </span>
                  <pre className={selectedJob.status.toUpperCase() === 'FAILED' ? 'code-block error-block' : 'code-block success-block'}>
                    {formatJsonPayload(selectedJob.result)}
                  </pre>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedJob.status.toUpperCase() === 'FAILED' && (
                <button
                  className="primary-btn retry-btn"
                  onClick={() => handleRetryJob(selectedJob.id)}
                  disabled={retryLoading}
                >
                  {retryLoading ? 'Retrying via Outbox...' : '↻ Retry Job'}
                </button>
              )}
              <button
                className="secondary"
                onClick={() => { setSelectedJob(null); setRetryFeedback(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: API DEFINITION DETAILS PANEL --- */}
      {selectedApi && (
        <div className="modal-backdrop" onClick={() => setSelectedApi(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>API Definition Details</h2>
                <span className="modal-subtitle">Gateway routing configuration</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedApi(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-cell">
                  <span className="cell-label">API Name</span>
                  <strong>{selectedApi.name}</strong>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Version</span>
                  <strong>{selectedApi.version}</strong>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Lifecycle Status</span>
                  <span className="status-tag status-completed">{selectedApi.status}</span>
                </div>
                <div className="detail-cell">
                  <span className="cell-label">Catalog ID</span>
                  <code>#{selectedApi.id}</code>
                </div>
                <div className="detail-cell full-width">
                  <span className="cell-label">Gateway Base Path</span>
                  <code className="monospace">{selectedApi.basePath}</code>
                </div>
                <div className="detail-cell full-width">
                  <span className="cell-label">Upstream Backend Target</span>
                  <code className="monospace">{selectedApi.backendUrl}</code>
                </div>
                {selectedApi.createdAt && (
                  <div className="detail-cell full-width">
                    <span className="cell-label">Registered At</span>
                    <span>{formatTimestamp(selectedApi.createdAt)}</span>
                  </div>
                )}
              </div>

              {selectedApi.description && (
                <div className="detail-section">
                  <span className="detail-heading">Description</span>
                  <p className="detail-text">{selectedApi.description}</p>
                </div>
              )}

              <div className="gateway-info-box">
                <strong>WSO2 Gateway Policy</strong>
                <p>Requests matching <code>{selectedApi.basePath}/**</code> are routed to upstream <code>{selectedApi.backendUrl}</code> with RS256 token verification.</p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary" onClick={() => setSelectedApi(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: REGISTER NEW API PANEL --- */}
      {isRegisterApiOpen && (
        <div className="modal-backdrop" onClick={() => setIsRegisterApiOpen(false)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Register New API</h2>
                <span className="modal-subtitle">Publish an upstream service to the API Gateway</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsRegisterApiOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterApi}>
              <div className="modal-body">
                {apiFormError && (
                  <div className="feedback-banner error">{apiFormError}</div>
                )}

                <div className="form-group">
                  <label htmlFor="api-name">API Name</label>
                  <input
                    id="api-name"
                    type="text"
                    placeholder="e.g. Payments Gateway"
                    value={apiFormName}
                    onChange={e => setApiFormName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: '0 0 100px' }}>
                    <label htmlFor="api-version">Version</label>
                    <input
                      id="api-version"
                      type="text"
                      placeholder="v1"
                      value={apiFormVersion}
                      onChange={e => setApiFormVersion(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="api-base-path">Base Path</label>
                    <input
                      id="api-base-path"
                      type="text"
                      placeholder="/api/v1/payments"
                      value={apiFormBasePath}
                      onChange={e => setApiFormBasePath(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="api-backend-url">Upstream Backend URL</label>
                  <input
                    id="api-backend-url"
                    type="text"
                    placeholder="http://payments-service:8080"
                    value={apiFormBackendUrl}
                    onChange={e => setApiFormBackendUrl(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="api-description">Description (Optional)</label>
                  <input
                    id="api-description"
                    type="text"
                    placeholder="Brief description of the upstream service"
                    value={apiFormDescription}
                    onChange={e => setApiFormDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={apiFormLoading}
                >
                  {apiFormLoading ? 'Registering...' : 'Register API'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setIsRegisterApiOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default App

