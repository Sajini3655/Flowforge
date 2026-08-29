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
const RECENT_JOBS_LIMIT = 10

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

    return {
      totalApis: apis.length,
      totalJobs,
      completed,
      running,
      queued,
      failed,
      active,
    }
  }, [apis, jobs])

  // Subset of jobs for display
  const displayedJobs = useMemo(() => {
    if (showAllJobs) {
      return jobs
    }
    return jobs.slice(0, RECENT_JOBS_LIMIT)
  }, [jobs, showAllJobs])

  // --- UNMISTAKABLE CLEAN LANDING & SIGN IN VIEW ---
  if (!token) {
    return (
      <main className="container unauth-container">
        <header className="hero-header">
          <div className="forge-mark-large">
            <span className="forge-ember">■</span>
            <span className="forge-name">FlowForge</span>
          </div>
          <p className="hero-subhead">Developer Infrastructure &amp; Workflow Orchestration</p>
        </header>

        <section className="login-box">
          <div className="login-header">
            <h2>Sign in to console</h2>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
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

            <button type="submit" className="btn-forge-primary btn-block" disabled={authLoading}>
              {authLoading ? 'Authenticating...' : 'Sign in'}
            </button>
          </form>

          <div className="demo-credentials-callout">
            <span className="demo-tag">Default Account</span>
            <span className="monospace">admin@flowforge.local</span>
          </div>
        </section>
      </main>
    )
  }

  // --- AUTHENTICATED DASHBOARD VIEW ---
  return (
    <main className="container">
      {/* Platform Header */}
      <header className="platform-header">
        <div className="header-left">
          <span className="forge-ember">■</span>
          <span className="forge-name">FLOWFORGE</span>
          <span className="header-divider">/</span>
          <span className="header-context">ORCHESTRATOR</span>
        </div>

        <div className="header-right">
          <div className="infra-live-strip">
            <div className="infra-live-node">
              <span className="live-dot online" />
              <span className="live-name">PostgreSQL</span>
            </div>
            <div className="infra-live-node">
              <span className="live-dot online" />
              <span className="live-name">RabbitMQ</span>
            </div>
            <div className="infra-live-node">
              <span className="live-dot online" />
              <span className="live-name">Redis</span>
            </div>
          </div>
          <span className="header-meta-divider" />
          <span className="session-user monospace">{userEmail || 'admin@flowforge.local'}</span>
          <button className="btn-text-signout" onClick={() => handleLogout()} title="Sign out">
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {/* Console Status Ribbon */}
      <section className="console-status-bar">
        <div className="status-stat">
          <span className="stat-value monospace">{String(metrics.totalApis).padStart(2, '0')}</span>
          <span className="stat-label">APIs</span>
        </div>
        <div className="status-stat">
          <span className="stat-value monospace">{String(metrics.totalJobs).padStart(2, '0')}</span>
          <span className="stat-label">WORKFLOWS</span>
        </div>
        <div className="status-stat">
          <span className="stat-value stat-completed monospace">{String(metrics.completed).padStart(2, '0')}</span>
          <span className="stat-label">COMPLETED</span>
        </div>
        <div className="status-stat">
          <span className="stat-value stat-active monospace">{String(metrics.active).padStart(2, '0')}</span>
          <span className="stat-label">IN-FLIGHT</span>
        </div>
        <div className="status-stat">
          <span className="stat-value stat-failed monospace">{String(metrics.failed).padStart(2, '0')}</span>
          <span className="stat-label">FAILED / DLQ</span>
        </div>
      </section>

      {/* Control Actions Toolbar */}
      <section className="toolbar-strip">
        <div className="toolbar-actions">
          <button
            className="btn-forge-primary"
            onClick={() => createDemoJob('ECHO')}
            disabled={demoSubmitting}
          >
            {demoSubmitting ? 'Dispatching...' : 'Create Demo Job'}
          </button>
          <button
            className="btn-forge-secondary"
            onClick={() => createDemoJob('TRANSIENT_FAILURE')}
            disabled={demoSubmitting}
          >
            Simulate DLQ Failure
          </button>
        </div>
        <button
          className="btn-forge-refresh"
          onClick={() => loadData(true)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </section>

      {loading && jobs.length === 0 ? (
        <p className="loading-indicator">Loading system data...</p>
      ) : (
        <section className="workspace-split">
          {/* Left Panel: API Gateway Catalog (Naturally Sized) */}
          <div className="workspace-panel api-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <h3>APIs</h3>
                <span className="panel-count monospace">{apis.length}</span>
              </div>
              <button
                className="btn-panel-action"
                onClick={() => {
                  setApiFormError(null)
                  setIsRegisterApiOpen(true)
                }}
              >
                + Register API
              </button>
            </div>

            <div className="panel-content-scroll">
              {apis.length === 0 ? (
                <p className="empty-state">No API definitions registered.</p>
              ) : (
                <div className="calm-table">
                  <div className="calm-table-header api-columns">
                    <span>NAME</span>
                    <span>BASE PATH</span>
                    <span>VERSION</span>
                    <span style={{ textAlign: 'right' }}>STATUS</span>
                  </div>
                  {apis.map(api => (
                    <div
                      className={`calm-table-row api-columns clickable-row ${selectedApi?.id === api.id ? 'row-selected' : ''}`}
                      key={api.id}
                      onClick={() => setSelectedApi(api)}
                      role="button"
                      tabIndex={0}
                      title="Inspect API gateway routing and upstream target"
                    >
                      <strong className="row-title">{api.name}</strong>
                      <span className="monospace row-mono">{api.basePath}</span>
                      <span className="row-version monospace">{api.version}</span>
                      <span className="row-status-align">
                        <span className="calm-dot dot-completed" />
                        <span className="calm-status-text">{api.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Workflow Jobs (Carries Vertical Space) */}
          <div className="workspace-panel jobs-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <h3>Workflow Jobs</h3>
                <span className="panel-count monospace">{jobs.length}</span>
              </div>
              {jobs.length > RECENT_JOBS_LIMIT && (
                <button
                  className="btn-panel-toggle"
                  onClick={() => setShowAllJobs(!showAllJobs)}
                >
                  {showAllJobs ? `Recent (${RECENT_JOBS_LIMIT})` : `View all (${jobs.length})`}
                </button>
              )}
            </div>

            <div className="panel-content-scroll">
              {jobs.length === 0 ? (
                <p className="empty-state">
                  No workflow jobs found. Click &quot;Create Demo Job&quot; to dispatch a task.
                </p>
              ) : (
                <div className="calm-table">
                  <div className="calm-table-header job-columns">
                    <span>TYPE</span>
                    <span>JOB ID</span>
                    <span>ATTEMPTS</span>
                    <span>TIME</span>
                    <span style={{ textAlign: 'right' }}>STATUS</span>
                  </div>
                  {displayedJobs.map(job => (
                    <div
                      className={`calm-table-row job-columns clickable-row ${selectedJob?.id === job.id ? 'row-selected' : ''}`}
                      key={job.id}
                      onClick={() => {
                        setSelectedJob(job)
                        setRetryFeedback(null)
                      }}
                      role="button"
                      tabIndex={0}
                      title="Inspect workflow execution details, payload, and retry state"
                    >
                      <span className="monospace row-type">{job.type}</span>
                      <span className="monospace row-mono id-dimmed">{job.id.substring(0, 8)}...{job.id.substring(job.id.length - 4)}</span>
                      <span className="monospace row-attempts">
                        {job.attemptCount ?? 0}
                        {job.status === 'FAILED' && <span className="dlq-tag">DLQ</span>}
                      </span>
                      <span className="monospace row-time">
                        {job.createdAt ? (formatTimestamp(job.createdAt).split(' ')[1] || '—') : '—'}
                      </span>
                      <span className="row-status-align">
                        <span className={`calm-dot dot-${job.status.toLowerCase()}`} />
                        <span className="calm-status-text">{job.status}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* --- MODAL 1: WORKFLOW JOB DETAILS PANEL --- */}
      {selectedJob && (
        <div className="modal-backdrop" onClick={() => { setSelectedJob(null); setRetryFeedback(null); }}>
          <div className="modal-dialog inspector-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="inspector-title-row">
                <span className="inspector-eyebrow">JOB / {selectedJob.type}</span>
                <div className="inspector-headline">
                  <span className={`calm-dot dot-${selectedJob.status.toLowerCase()}`} />
                  <span className={`inspector-status ${getStatusClass(selectedJob.status)}`}>{selectedJob.status}</span>
                  <span className="inspector-attempts monospace">
                    {selectedJob.attemptCount ?? 0} {selectedJob.attemptCount === 1 ? 'attempt' : 'attempts'}
                  </span>
                </div>
                <code className="monospace inspector-uuid selectable">{selectedJob.id}</code>
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
                  <div className="dlq-title">DEAD-LETTER QUEUE (DLQ)</div>
                  <p>Exceeded maximum retry attempts ({selectedJob.attemptCount ?? 0}). Dispatched to DLQ routing exchange.</p>
                </div>
              )}

              {/* Retry Feedback Banner */}
              {retryFeedback && (
                <div className={retryFeedback.success ? 'feedback-banner success' : 'feedback-banner error'}>
                  {retryFeedback.message}
                </div>
              )}

              {/* Compact Metadata Area */}
              <div className="metadata-strip">
                <div className="metadata-item">
                  <span className="meta-label">CREATED</span>
                  <span className="meta-val monospace">{formatTimestamp(selectedJob.createdAt)}</span>
                </div>
                <div className="metadata-item">
                  <span className="meta-label">UPDATED</span>
                  <span className="meta-val monospace">{formatTimestamp(selectedJob.updatedAt)}</span>
                </div>
                {selectedJob.idempotencyKey && (
                  <div className="metadata-item">
                    <span className="meta-label">IDEMPOTENCY KEY</span>
                    <span className="meta-val monospace selectable">{selectedJob.idempotencyKey}</span>
                  </div>
                )}
              </div>

              {/* Request Payload */}
              <div className="detail-section">
                <span className="detail-heading">REQUEST PAYLOAD</span>
                <pre className="code-block selectable">
                  {formatJsonPayload(selectedJob.requestPayload)}
                </pre>
              </div>

              {/* Execution Output */}
              {selectedJob.result && (
                <div className="detail-section">
                  <span className="detail-heading">
                    {selectedJob.status.toUpperCase() === 'FAILED' ? 'FAILURE REASON' : 'EXECUTION OUTPUT'}
                  </span>
                  <pre className={selectedJob.status.toUpperCase() === 'FAILED' ? 'code-block error-block selectable' : 'code-block success-block selectable'}>
                    {selectedJob.result}
                  </pre>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedJob.status.toUpperCase() === 'FAILED' && (
                <button
                  className="retry-btn"
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
              <div className="modal-title-lockup">
                <span className="modal-eyebrow">GATEWAY</span>
                <h2>API Details</h2>
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
              <div className="modal-title-lockup">
                <span className="modal-eyebrow">REGISTRATION</span>
                <h2>Register API</h2>
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

