import { useEffect, useState } from 'react'

type Job = {
  id: string
  type: string
  requestPayload: string
  result: string | null
  status: string
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
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const [jobsResponse, apisResponse] = await Promise.all([
        fetch(`${API_BASE}/jobs`),
        fetch(`${API_BASE}/apis`),
      ])
      setJobs(await jobsResponse.json())
      setApis(await apisResponse.json())
    } finally {
      setLoading(false)
    }
  }

  async function createDemoJob() {
    await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'REPORT',
        requestPayload: JSON.stringify({
          projectId: 123,
          format: 'PDF',
        }),
      }),
    })
    await loadData()
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <main className="container">
      <header>
        <p className="eyebrow">API Management + Distributed Workflow Platform</p>
        <h1>FlowForge</h1>
        <p className="subtitle">
          MVP: register APIs, create jobs, and track job state.
        </p>
      </header>

      <section className="actions">
        <button onClick={createDemoJob}>Create Demo Job</button>
        <button className="secondary" onClick={loadData}>Refresh</button>
      </section>

      {loading ? <p>Loading...</p> : (
        <>
          <section className="grid">
            <article className="card">
              <h2>APIs</h2>
              <p className="metric">{apis.length}</p>
              {apis.map(api => (
                <div className="item" key={api.id}>
                  <strong>{api.name}</strong>
                  <span>{api.version} · {api.status}</span>
                </div>
              ))}
            </article>

            <article className="card">
              <h2>Jobs</h2>
              <p className="metric">{jobs.length}</p>
              {jobs.map(job => (
                <div className="item" key={job.id}>
                  <strong>{job.type}</strong>
                  <span>{job.status}</span>
                  <small>{job.id}</small>
                </div>
              ))}
            </article>
          </section>
        </>
      )}
    </main>
  )
}

export default App
