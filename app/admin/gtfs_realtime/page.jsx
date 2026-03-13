'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const AGENCY_COLORS = {
  GO:    '#8ECB5A',
  UP:    '#5EA8E8',
  TTC:   '#E06060',
  MiWay: '#DFA832',
  YRT:   '#9B59B6',
}

// Fields we capture — shown as tags in the registry
// We detect which are actually present by sampling vehicle_cache
const ALL_FIELDS = [
  { key: 'lat',                 label: 'Position' },
  { key: 'bearing',             label: 'Bearing' },
  { key: 'speed',               label: 'Speed' },
  { key: 'tripId',              label: 'Trip ID' },
  { key: 'directionId',         label: 'Direction' },
  { key: 'vehicleLabel',        label: 'Vehicle Label' },
  { key: 'licensePlate',        label: 'License Plate' },
  { key: 'currentStatus',       label: 'Stop Status' },
  { key: 'stopId',              label: 'Stop ID' },
  { key: 'currentStopSequence', label: 'Stop Seq' },
  { key: 'occupancy',           label: 'Occupancy' },
  { key: 'congestionLevel',     label: 'Congestion' },
  { key: 'odometer',            label: 'Odometer' },
]

function timeAgo(isoString) {
  if (!isoString) return 'Never'
  const secs = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function AgencyBadge({ agency }) {
  const color = AGENCY_COLORS[agency] ?? '#888'
  return (
    <span style={{
      display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: 4,
      fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace',
      background: color + '22', color, border: '1px solid ' + color + '44',
    }}>
      {agency}
    </span>
  )
}

function FieldTag({ label, present }) {
  return (
    <span style={{
      display: 'inline-block', padding: '0.1rem 0.4rem', borderRadius: 3,
      fontSize: '0.65rem', fontWeight: 500, fontFamily: 'monospace',
      background: present ? '#e8f5e9' : '#f5f5f5',
      color: present ? '#2e7d32' : '#bbb',
      border: '1px solid ' + (present ? '#a5d6a7' : '#e0e0e0'),
      marginRight: 2, marginBottom: 2,
    }}>
      {present ? '✓' : '–'} {label}
    </span>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? '#0070f3' : '#ccc',
        border: 'none', padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function FeedRow({ feed, onToggle, onDelete, toggling, fieldMap }) {
  const isToggling = toggling === feed.id
  const hasError = !!feed.last_error
  const [expanded, setExpanded] = useState(false)
  {feed.feed_type === 'vehicles' ? (   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>     {ALL_FIELDS.map(f => (       <FieldTag key={f.key} label={f.label} present={!!agencyFields[f.key]} />     ))}   </div> ) : feed.feed_type === 'trip_updates' ? (   <span style={{ fontSize: '0.75rem', color: '#555' }}>     Fields: Trip ID, Route ID, Direction, Stop Time Updates (arrival/departure delay, stop ID, sequence), Schedule Relationship, Vehicle ID, Delay   </span> ) : feed.feed_type === 'alerts' ? (   <span style={{ fontSize: '0.75rem', color: '#555' }}>     Fields: Header, Description, Cause, Effect, Severity, Active Periods, Informed Entities (route, stop, trip, agency), URL   </span> ) : null}

  return (
    <>
      <tr style={{ borderBottom: expanded ? 'none' : '1px solid #f5f5f5' }}>
        <td style={{ padding: '0.7rem 0.75rem' }}><AgencyBadge agency={feed.agency} /></td>
        <td style={{ padding: '0.7rem 0.75rem', fontSize: '0.82rem', color: '#555', textTransform: 'capitalize' }}>{feed.feed_type}</td>
        <td style={{ padding: '0.7rem 0.75rem' }}>
          <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#888', wordBreak: 'break-all', maxWidth: 220, display: 'block' }}>
            {feed.url}
          </span>
          {feed.vault_secret_name && (
            <span style={{ fontSize: '0.65rem', color: '#888', fontFamily: 'monospace' }}>
              🔑 {feed.vault_secret_name}
            </span>
          )}
        </td>
        <td style={{ padding: '0.7rem 0.75rem' }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ fontSize: '0.7rem', color: '#0070f3', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            {expanded ? 'hide' : 'show fields'}
          </button>
        </td>
        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center', fontSize: '0.82rem', fontFamily: 'monospace', color: '#888' }}>
          {feed.last_count ?? '—'}
        </td>
        <td style={{ padding: '0.7rem 0.75rem', fontSize: '0.78rem', color: hasError ? '#c00' : '#888' }}>
          {hasError ? <span title={feed.last_error}>⚠️ Error</span> : timeAgo(feed.last_polled_at)}
        </td>
        <td style={{ padding: '0.7rem 0.75rem' }}>
          <Toggle checked={feed.enabled} onChange={val => onToggle(feed.id, val)} disabled={isToggling} />
        </td>
        <td style={{ padding: '0.7rem 0.75rem' }}>
          <button
            onClick={() => onDelete(feed.id, feed.agency)}
            style={{ fontSize: '0.75rem', color: '#c00', background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem 0.4rem', borderRadius: 3, opacity: 0.6 }}
            title="Remove feed"
          >✕</button>
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: '1px solid #f5f5f5', background: '#fafafa' }}>
          <td colSpan={8} style={{ padding: '0.4rem 0.75rem 0.7rem 0.75rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.3rem' }}>Available fields from last poll:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {ALL_FIELDS.map(f => (
                <FieldTag key={f.key} label={f.label} present={!!agencyFields[f.key]} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AddFeedForm({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [agency, setAgency] = useState('')
  const [feedType, setFeedType] = useState('vehicles')
  const [url, setUrl] = useState('')
  const [fetchMethod, setFetchMethod] = useState('protobuf')
  const [apiKey, setApiKey] = useState('')
  const [secretName, setSecretName] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState(null)

  async function handleAdd() {
    if (!agency.trim() || !url.trim()) return
    setAdding(true)
    setMsg(null)
    try {
      const body = {
        agency: agency.trim().toUpperCase(),
        feed_type: feedType,
        url: url.trim(),
        fetch_method: fetchMethod,
        vault_secret_name: secretName.trim() || null,
        refresh_seconds: 30,
      }
      const res = await fetch('/api/realtime-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMsg('✅ Feed added!')
      setAgency(''); setUrl(''); setApiKey(''); setSecretName('')
      setFeedType('vehicles'); setFetchMethod('protobuf')
      setTimeout(() => { setMsg(null); setOpen(false) }, 1500)
      onAdd()
    } catch (e) {
      setMsg('❌ ' + e.message)
    } finally {
      setAdding(false)
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.4rem 0.9rem', fontSize: '0.82rem', fontWeight: 600,
      background: '#f0f7ff', color: '#0070f3', border: '1px solid #cce0ff',
      borderRadius: 6, cursor: 'pointer', marginTop: '0.75rem',
    }}>
      + Add Feed
    </button>
  )

  const inputStyle = {
    width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.83rem',
    border: '1px solid #ddd', borderRadius: 5, fontFamily: 'monospace',
    background: '#fff', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '0.75rem', color: '#555', fontWeight: 600, display: 'block', marginBottom: '0.2rem' }

  return (
    <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: 8 }}>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>Add New Feed</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <div>
          <label style={labelStyle}>Agency Code *</label>
          <input style={inputStyle} placeholder="e.g. YRT" value={agency} onChange={e => setAgency(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Feed Type</label>
          <select style={inputStyle} value={feedType} onChange={e => setFeedType(e.target.value)}>
            <option value="vehicles">vehicles</option>
            <option value="trip_updates">trip_updates</option>
            <option value="alerts">alerts</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '0.6rem' }}>
        <label style={labelStyle}>Feed URL *</label>
        <input style={inputStyle} placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <div>
          <label style={labelStyle}>Format</label>
          <select style={inputStyle} value={fetchMethod} onChange={e => setFetchMethod(e.target.value)}>
            <option value="protobuf">Protobuf (.pb)</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>API Key Secret Name <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span></label>
          <input style={inputStyle} placeholder="e.g. GO_TRANSIT_API_KEY" value={secretName} onChange={e => setSecretName(e.target.value)} />
          <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: '0.2rem' }}>
            Add the key value to Supabase → Edge Functions → Secrets with this name
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '0.4rem 0.7rem', borderRadius: 5, marginBottom: '0.6rem', fontSize: '0.8rem', background: msg.startsWith('✅') ? '#f0fff4' : '#fff0f0', color: msg.startsWith('✅') ? '#1a6b35' : '#c00' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={handleAdd} disabled={adding || !agency.trim() || !url.trim()} style={{
          padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 600,
          background: (adding || !agency.trim() || !url.trim()) ? '#ccc' : '#0070f3',
          color: '#fff', border: 'none', borderRadius: 5,
          cursor: (adding || !agency.trim() || !url.trim()) ? 'not-allowed' : 'pointer',
        }}>
          {adding ? 'Adding...' : 'Add Feed'}
        </button>
        <button onClick={() => setOpen(false)} style={{
          padding: '0.4rem 0.9rem', fontSize: '0.82rem', background: 'none',
          color: '#888', border: '1px solid #ddd', borderRadius: 5, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function CronStatus({ healthy, secondsSinceLastRun }) {
  if (healthy === null) return null
  const color = healthy ? '#2e7d32' : '#c00'
  const bg = healthy ? '#f0fff4' : '#fff0f0'
  const border = healthy ? '#a5d6a7' : '#ffc5c5'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: 6, background: bg, border: '1px solid ' + border, fontSize: '0.78rem', color }}>
      <span style={{ fontSize: '0.9rem' }}>{healthy ? '🟢' : '🔴'}</span>
      <span>
        {healthy
          ? `Auto-poll active — last run ${secondsSinceLastRun}s ago`
          : `Auto-poll may be down — last run ${secondsSinceLastRun !== null ? secondsSinceLastRun + 's ago' : 'unknown'}`}
      </span>
    </div>
  )
}

export default function GtfsRealtimePage() {
  const [feeds, setFeeds]       = useState([])
  const [cache, setCache]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [toggling, setToggling] = useState(null)
  const [polling, setPolling]   = useState(false)
  const [pollMsg, setPollMsg]   = useState(null)
  const [error, setError]       = useState(null)
  const [cronHealthy, setCronHealthy] = useState(null)
  const [cronSecs, setCronSecs] = useState(null)
  // fieldMap: { agency: { fieldKey: true/false } }
  const [fieldMap, setFieldMap] = useState({})

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 15000)
    return () => clearInterval(interval)
  }, [])

  async function loadAll() {
    try {
      const [feedsRes, cacheRes, cronRes] = await Promise.all([
        fetch('/api/realtime-feeds'),
        fetch('/api/vehicles'),
        fetch('/api/cron-status'),
      ])
      const feedsData = await feedsRes.json()
      const cacheData = await cacheRes.json()
      const cronData  = await cronRes.json()

      if (feedsData.error) throw new Error(feedsData.error)
      setFeeds(feedsData.feeds ?? [])
      setCache(cacheData)
      setCronHealthy(cronData.healthy ?? false)
      setCronSecs(cronData.secondsSinceLastRun ?? null)

      // Build field availability map from cached vehicles
      if (cacheData?.vehicles?.length) {
        const map = {}
        for (const v of cacheData.vehicles) {
          if (!map[v.agency]) map[v.agency] = {}
          for (const f of ALL_FIELDS) {
            if (v[f.key] !== undefined && v[f.key] !== null && v[f.key] !== '') {
              map[v.agency][f.key] = true
            }
          }
        }
        setFieldMap(map)
      }

      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(id, enabled) {
    setToggling(id)
    try {
      const res = await fetch('/api/realtime-feeds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setFeeds(prev => prev.map(f => f.id === id ? { ...f, enabled } : f))
    } catch (e) {
      alert('Failed to update feed: ' + e.message)
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(id, agency) {
    if (!confirm(`Remove ${agency} feed?`)) return
    try {
      const res = await fetch('/api/realtime-feeds', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setFeeds(prev => prev.filter(f => f.id !== id))
    } catch (e) {
      alert('Failed to delete feed: ' + e.message)
    }
  }

  async function pollNow() {
    setPolling(true)
    setPollMsg(null)
    try {
      const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnon) throw new Error('Supabase env vars not set')
      const res = await fetch(supabaseUrl + '/functions/v1/transit-vehicles', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + supabaseAnon, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.ok) {
        setPollMsg('✅ Polled successfully — ' + data.vehicleCount + ' vehicles cached')
        loadAll()
      } else {
        setPollMsg('❌ ' + data.error)
      }
    } catch (e) {
      setPollMsg('❌ ' + e.message)
    } finally {
      setPolling(false)
    }
  }

  const enabledCount = feeds.filter(f => f.enabled).length
  const vehicleCount = cache?.vehicles?.length ?? '—'
  const lastUpdated  = cache?.updated_at ? timeAgo(cache.updated_at) : '—'
  const agencyStatus = cache?.agency_status ?? {}

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#aaa' }}>
        <Link href="/admin" style={{ color: '#aaa', textDecoration: 'none' }}>← Admin</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
        <h1 style={{ color: '#1a1a1a', margin: 0 }}>📡 GTFS Realtime</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CronStatus healthy={cronHealthy} secondsSinceLastRun={cronSecs} />
          <button onClick={pollNow} disabled={polling} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 'bold', background: polling ? '#ccc' : '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: polling ? 'not-allowed' : 'pointer' }}>
            {polling ? '⏳ Polling...' : '⚡ Poll Now'}
          </button>
        </div>
      </div>
      <p style={{ color: '#666', marginTop: 0, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        One Supabase Edge Function polls all feeds and caches results — every user reads from that single copy.
      </p>

      {pollMsg && (
        <div style={{ padding: '0.6rem 0.9rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85rem', background: pollMsg.startsWith('✅') ? '#f0fff4' : '#fff0f0', border: '1px solid ' + (pollMsg.startsWith('✅') ? '#b2f5c8' : '#ffc5c5'), color: pollMsg.startsWith('✅') ? '#1a6b35' : '#c00' }}>
          {pollMsg}
        </div>
      )}

      {error && (
        <div style={{ padding: '0.6rem 0.9rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85rem', background: '#fff0f0', border: '1px solid #ffc5c5', color: '#c00' }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Enabled Feeds',   value: loading ? '…' : enabledCount + ' / ' + feeds.length },
          { label: 'Cached Vehicles', value: loading ? '…' : vehicleCount },
          { label: 'Last Poll',       value: loading ? '…' : lastUpdated },
          { label: 'Refresh Cycle',   value: '30s' },
        ].map(item => (
          <div key={item.label} style={{ textAlign: 'center', padding: '0.75rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#0070f3', fontFamily: 'monospace' }}>{item.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.2rem' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {Object.keys(agencyStatus).length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {Object.entries(agencyStatus).map(([agency, status]) => (
            <div key={agency} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.78rem', background: status.ok ? '#f0fff4' : '#fff0f0', border: '1px solid ' + (status.ok ? '#b2f5c8' : '#ffc5c5') }}>
              <AgencyBadge agency={agency} />
              <span style={{ color: status.ok ? '#1a6b35' : '#c00', fontFamily: 'monospace' }}>
                {status.ok ? status.count + ' vehicles' : 'Error'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.4rem', fontSize: '1rem' }}>📋 Feed Registry</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#888' }}>
          Disabling a feed stops it from being polled — users stop receiving that data immediately.
        </p>
        {loading ? (
          <p style={{ color: '#aaa', fontSize: '0.9rem', margin: 0 }}>Loading feeds...</p>
        ) : feeds.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '0.9rem', margin: 0 }}>No feeds found.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Agency', 'Type', 'URL', 'Fields', 'Vehicles', 'Last Polled', 'Enabled', ''].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feeds.map(feed => (
                  <FeedRow key={feed.id} feed={feed} onToggle={handleToggle} onDelete={handleDelete} toggling={toggling} fieldMap={fieldMap} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AddFeedForm onAdd={loadAll} />
      </div>

      <div style={{ background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 8, padding: '1rem', fontSize: '0.83rem', color: '#0050b3', lineHeight: 1.6 }}>
        <strong>How it works:</strong> The <code>transit-vehicles</code> Supabase Edge Function reads enabled feeds, polls each agency, and writes all vehicles to <code>vehicle_cache</code>. API keys live in Supabase → Edge Functions → Secrets — never in Vercel or the browser. Your <code>/api/vehicles</code> route serves the cached data with a 10s CDN header.
      </div>
    </div>
  )
}
