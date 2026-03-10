'use client'
import { useState, useEffect, useRef } from 'react'

const CHUNK_SIZE = 10000

const TABLE_SEQUENCE = [
  { key: 'feed_info',       label: 'Feed Info',       chunked: false },
  { key: 'agencies',        label: 'Agencies',         chunked: false },
  { key: 'routes',          label: 'Routes',           chunked: false },
  { key: 'stops',           label: 'Stops',            chunked: false },
  { key: 'trips',           label: 'Trips',            chunked: false },
  { key: 'calendar',        label: 'Calendar',         chunked: false },
  { key: 'calendar_dates',  label: 'Calendar Dates',   chunked: false },
  { key: 'transfers',       label: 'Transfers',        chunked: false },
  { key: 'fare_attributes', label: 'Fare Attributes',  chunked: false },
  { key: 'fare_rules',      label: 'Fare Rules',       chunked: false },
  { key: 'stop_amenities',  label: 'Stop Amenities',   chunked: false },
  { key: 'shapes',          label: 'Shapes',           chunked: true  },
  { key: 'stop_times',      label: 'Stop Times',       chunked: true  },
]

function StatusRow({ table, status }) {
  const s = status[table.key]
  if (!s) return null
  const pct = s.total > 0 ? Math.round((s.inserted / s.total) * 100) : 0
  return (
    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.chunked && !s.done ? '0.25rem' : 0 }}>
        <span style={{ color: s.done ? '#008000' : s.error ? '#c00' : '#555' }}>
          {s.done ? '✅' : s.error ? '❌' : '⏳'} {table.label}
        </span>
        <span style={{ color: '#888', fontSize: '0.8rem' }}>
          {s.error ? s.error : s.done ? `${s.inserted?.toLocaleString()} rows` : s.total > 0 ? `${s.inserted?.toLocaleString()} / ${s.total?.toLocaleString()}` : 'Loading...'}
        </span>
      </div>
      {s.chunked && !s.done && s.total > 0 && (
        <div style={{ height: 4, background: '#eee', borderRadius: 2 }}>
          <div style={{ height: 4, width: `${pct}%`, background: '#0070f3', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const [dbStatus, setDbStatus] = useState(null)
  const [loadedFeeds, setLoadedFeeds] = useState([])
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [tableStatus, setTableStatus] = useState({})
  const [overallStatus, setOverallStatus] = useState(null)
  const abortRef = useRef(false)

  useEffect(() => { fetchStatus() }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setDbStatus(data)
      setLoadedFeeds(data.feeds || [])
    } catch (e) {
      setDbStatus({ error: 'Could not connect to database.' })
    }
  }

  async function loadTable(url, name, tableKey, chunked) {
    if (chunked) {
      // Chunked loading for large tables
      let offset = 0
      let total = null
      let totalInserted = 0
      while (true) {
        if (abortRef.current) throw new Error('Cancelled')
        const res = await fetch('/api/load-table', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, name, tableKey, offset, limit: CHUNK_SIZE })
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        total = data.total
        totalInserted += data.inserted
        setTableStatus(prev => ({
          ...prev,
          [tableKey]: { inserted: totalInserted, total, done: data.done, chunked: true }
        }))
        if (data.done) break
        offset += CHUNK_SIZE
      }
      return totalInserted
    } else {
      // Single call for small tables
      const res = await fetch('/api/load-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name, tableKey })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTableStatus(prev => ({
        ...prev,
        [tableKey]: { inserted: data.inserted, total: data.total, done: true, chunked: false }
      }))
      return data.inserted
    }
  }

  async function startLoad() {
    if (!newUrl.trim() || !newName.trim()) return
    setIsLoading(true)
    setTableStatus({})
    setOverallStatus('loading')
    abortRef.current = false

    try {
      for (const table of TABLE_SEQUENCE) {
        if (abortRef.current) break
        setTableStatus(prev => ({ ...prev, [table.key]: { inserted: 0, total: 0, done: false, chunked: table.chunked } }))
        try {
          await loadTable(newUrl.trim(), newName.trim(), table.key, table.chunked)
        } catch (e) {
          setTableStatus(prev => ({ ...prev, [table.key]: { ...prev[table.key], error: e.message, done: false } }))
          // Continue loading other tables even if one fails
        }
      }
      setOverallStatus('done')
      setNewUrl('')
      setNewName('')
      fetchStatus()
    } catch (e) {
      setOverallStatus('error')
    }
    setIsLoading(false)
  }

  function cancelLoad() {
    abortRef.current = true
    setIsLoading(false)
    setOverallStatus('cancelled')
  }

  const completedTables = Object.values(tableStatus).filter(s => s.done).length
  const totalTables = TABLE_SEQUENCE.length

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <h1 style={{ color: '#1a1a1a', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
        🚌 InterlineApp
      </h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: '1.5rem' }}>
        GTFS transit data loader — add any agency by pasting a GTFS feed URL below.
      </p>

      {/* Database Status */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📊 Database Status</h2>
        {!dbStatus ? (
          <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Checking connection...</p>
        ) : dbStatus.error ? (
          <p style={{ color: '#c00', margin: 0, fontSize: '0.9rem' }}>{dbStatus.error}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Stops', value: dbStatus.stops },
              { label: 'Routes', value: dbStatus.routes },
              { label: 'Trips', value: dbStatus.trips },
              { label: 'Stop Times', value: dbStatus.stop_times },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', padding: '0.5rem', background: '#f9f9f9', borderRadius: 6 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0070f3' }}>
                  {item.value?.toLocaleString() ?? '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={fetchStatus} style={{ marginTop: '0.75rem', padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, background: '#fff' }}>
          Refresh counts
        </button>
      </div>

      {/* Add New Feed */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>➕ Add GTFS Feed</h2>
        <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
          Paste any GTFS ZIP URL and give it a name. Each table loads separately so there are no timeouts.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Agency name (e.g. TTC)"
            disabled={isLoading}
            style={{ width: 180, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }}
          />
          <input
            type="text"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="GTFS ZIP URL"
            disabled={isLoading}
            style={{ flex: 1, minWidth: 280, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }}
          />
          <button
            onClick={isLoading ? cancelLoad : startLoad}
            disabled={!isLoading && (!newUrl.trim() || !newName.trim())}
            style={{
              padding: '0.5rem 1.25rem',
              background: isLoading ? '#c00' : (!newUrl.trim() || !newName.trim()) ? '#ccc' : '#0070f3',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: (!isLoading && (!newUrl.trim() || !newName.trim())) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold', whiteSpace: 'nowrap'
            }}
          >
            {isLoading ? '⏹ Cancel' : 'Load Feed'}
          </button>
        </div>

        {/* Quick-add buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa', alignSelf: 'center' }}>Quick add:</span>
          {[
            { name: 'GO Transit', url: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip' },
            { name: 'UP Express', url: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/UP-GTFS.zip' },
            { name: 'MiApp', url: 'https://www.miapp.ca/GTFS/google_transit.zip' },
            { name: 'TTC', url: 'http://opendata.toronto.ca/toronto.transit.commission/ttc-routes-and-schedules/OpenData_TTC_Schedules.zip' },
          ].map(f => (
            <button key={f.name} onClick={() => { setNewName(f.name); setNewUrl(f.url) }} disabled={isLoading}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', border: '1px solid #ccc', borderRadius: 4, background: '#f9f9f9', cursor: 'pointer' }}>
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Live Progress */}
      {Object.keys(tableStatus).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>
              {overallStatus === 'done' ? '✅' : overallStatus === 'cancelled' ? '⏹' : '⏳'} Loading Progress
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>{completedTables} / {totalTables} tables</span>
          </div>
          {/* Overall progress bar */}
          <div style={{ height: 6, background: '#eee', borderRadius: 3, marginBottom: '0.75rem' }}>
            <div style={{ height: 6, width: `${(completedTables / totalTables) * 100}%`, background: overallStatus === 'done' ? '#008000' : '#0070f3', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          {TABLE_SEQUENCE.map(table => (
            <StatusRow key={table.key} table={table} status={tableStatus} />
          ))}
          {overallStatus === 'done' && (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#008000', fontWeight: 'bold' }}>
              ✅ Feed loaded successfully! Click "Refresh counts" above to see updated totals.
            </p>
          )}
        </div>
      )}

      {/* Loaded Feeds */}
      {loadedFeeds.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📡 Loaded Feeds</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                {['Agency', 'Status', 'Loaded At', 'Row Count'].map(h => (
                  <th key={h} style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadedFeeds.map((feed, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{feed.name}</td>
                  <td style={{ padding: '0.5rem', color: feed.status === 'loaded' ? '#008000' : '#888' }}>
                    {feed.status === 'loaded' ? '✅ Loaded' : feed.status}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#888' }}>
                    {feed.loaded_at ? new Date(feed.loaded_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#888' }}>
                    {feed.row_count?.toLocaleString() ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stop Search */}
      <StopSearch />

      <p style={{ color: '#bbb', fontSize: '0.75rem', textAlign: 'center', marginTop: '2rem' }}>
        InterlineApp — GTFS data sourced from open transit data feeds.
      </p>
    </div>
  )
}

function StopSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/stops?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data)
    } catch (e) {
      setResults({ error: e.message })
    }
    setSearching(false)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>🔍 Search Stops</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. Union Station, Kipling, Finch..."
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }}
        />
        <button onClick={search} disabled={searching}
          style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
          {searching ? '...' : 'Search'}
        </button>
      </div>
      {results && (
        <div style={{ marginTop: '0.75rem' }}>
          {results.error ? <p style={{ color: '#c00', margin: 0 }}>{results.error}</p>
          : results.stops?.length === 0 ? <p style={{ color: '#888', margin: 0 }}>No stops found.</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Stop Name', 'Feed', 'Code', 'Lat / Lon'].map(h => (
                    <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.stops.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.4rem 0.5rem' }}>{s.stop_name}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#666' }}>{s.feed_source}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#888' }}>{s.stop_code || '—'}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#aaa', fontSize: '0.75rem' }}>{s.stop_lat}, {s.stop_lon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
