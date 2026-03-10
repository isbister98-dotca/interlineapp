'use client'
import { useState, useEffect, useRef } from 'react'

const CHUNK_SIZE = 5000

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
  // stop_times is handled separately via Edge Function
]

function ProgressRow({ table, status }) {
  const s = status[table.key]
  if (!s) return null
  const pct = s.total > 0 ? Math.round((s.inserted / s.total) * 100) : 0
  return (
    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (s.chunked && !s.done && s.total > 0) ? '0.3rem' : 0 }}>
        <span style={{ color: s.done ? '#008000' : s.error ? '#c00' : '#555' }}>
          {s.done ? '✅' : s.error ? '❌' : '⏳'} {table.label}
        </span>
        <span style={{ color: '#888', fontSize: '0.78rem' }}>
          {s.error ? s.error : s.done ? `${s.inserted?.toLocaleString()} rows` : s.total > 0 ? `${s.inserted?.toLocaleString()} / ${s.total?.toLocaleString()}` : 'loading...'}
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
  const [dbStatus, setDbStatus]         = useState(null)
  const [loadedFeeds, setLoadedFeeds]   = useState([])
  const [newUrl, setNewUrl]             = useState('')
  const [newName, setNewName]           = useState('')
  const [phase, setPhase]               = useState(null)
  const [tableStatus, setTableStatus]   = useState({})
  const [cacheMsg, setCacheMsg]         = useState(null)
  const [stopTimesStatus, setStopTimesStatus] = useState({}) // feedUrl -> status
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
      let offset = 0, total = null, totalInserted = 0
      while (true) {
        if (abortRef.current) throw new Error('Cancelled')
        const res = await fetch('/api/load-table', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, name, tableKey, offset })
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        total = data.total
        totalInserted += data.inserted
        setTableStatus(prev => ({ ...prev, [tableKey]: { inserted: totalInserted, total, done: data.done, chunked: true } }))
        if (data.done) break
        offset++
      }
      return totalInserted
    } else {
      const res = await fetch('/api/load-table', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name, tableKey })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setTableStatus(prev => ({ ...prev, [tableKey]: { inserted: data.inserted, total: data.total, done: true, chunked: false } }))
      return data.inserted
    }
  }

  async function startLoad() {
    if (!newUrl.trim() || !newName.trim()) return
    abortRef.current = false
    setTableStatus({})
    setPhase('caching')
    setCacheMsg('Downloading ZIP and caching all files... this may take 1–2 minutes for large feeds.')

    try {
      // Phase 1: Cache the ZIP
      const cacheRes = await fetch('/api/cache-zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), name: newName.trim() })
      })
      const cacheData = await cacheRes.json()
      if (!cacheData.success) throw new Error(cacheData.error)

      const stopTimesRows = cacheData.fileSizes?.stop_times
      const fileList = Object.entries(cacheData.fileSizes)
        .filter(([k]) => !k.endsWith('_note'))
        .map(([f, n]) => `${f} (${Number(n).toLocaleString()})`)
        .join(', ')
      setCacheMsg(`✅ Cached: ${fileList}`)

      // Phase 2: Load tables from cache
      setPhase('loading')
      for (const table of TABLE_SEQUENCE) {
        if (abortRef.current) break
        setTableStatus(prev => ({ ...prev, [table.key]: { inserted: 0, total: 0, done: false, chunked: table.chunked } }))
        try {
          await loadTable(newUrl.trim(), newName.trim(), table.key, table.chunked)
        } catch (e) {
          setTableStatus(prev => ({ ...prev, [table.key]: { ...prev[table.key], error: e.message, done: false } }))
        }
      }

      setPhase('done')
      setNewUrl('')
      setNewName('')
      fetchStatus()
    } catch (e) {
      setCacheMsg(`❌ Failed: ${e.message}`)
      setPhase('error')
    }
  }

  async function loadStopTimes(feed, forceReload = false) {
    setStopTimesStatus(prev => ({ ...prev, [feed.url]: { status: 'loading', message: 'Triggering Edge Function...', currentRows: 0 } }))
    try {
      // Fire and forget
      const res = await fetch('/api/trigger-stop-times', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl: feed.url, feedName: feed.name, forceReload })
      })
      const data = await res.json()
      if (!data.success) {
        setStopTimesStatus(prev => ({ ...prev, [feed.url]: { status: 'error', message: data.error } }))
        return
      }
      // Start polling
      setStopTimesStatus(prev => ({ ...prev, [feed.url]: { status: 'loading', message: 'Edge Function running — checking progress...', currentRows: 0 } }))
      pollStopTimes(feed.url)
    } catch (e) {
      setStopTimesStatus(prev => ({ ...prev, [feed.url]: { status: 'error', message: e.message } }))
    }
  }

  function pollStopTimes(feedUrl) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/stop-times-status?feedUrl=${encodeURIComponent(feedUrl)}`)
        const data = await res.json()
        if (data.error) {
          clearInterval(interval)
          setStopTimesStatus(prev => ({ ...prev, [feedUrl]: { status: 'error', message: data.error } }))
          return
        }
        if (data.status === 'loaded') {
          clearInterval(interval)
          setStopTimesStatus(prev => ({ ...prev, [feedUrl]: { status: 'done', message: `✅ Loaded ${data.rowCount?.toLocaleString()} rows (version ${data.feedVersion})` } }))
          fetchStatus()
        } else if (data.status === 'loading') {
          setStopTimesStatus(prev => ({ ...prev, [feedUrl]: { status: 'loading', message: `⏳ Loading... ${data.currentRows?.toLocaleString()} rows so far`, currentRows: data.currentRows } }))
        } else if (data.status === 'error') {
          clearInterval(interval)
          setStopTimesStatus(prev => ({ ...prev, [feedUrl]: { status: 'error', message: 'Edge Function reported an error — check Supabase logs' } }))
        }
      } catch (e) {
        // Keep polling even on network hiccups
      }
    }, 5000) // Poll every 5 seconds
  }

  const isActive = phase === 'caching' || phase === 'loading'
  const completedTables = Object.values(tableStatus).filter(s => s.done).length

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>

      <h1 style={{ color: '#1a1a1a', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
        🚌 InterlineApp
      </h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: '1.5rem' }}>
        GTFS transit data loader — add any agency by pasting a GTFS feed URL.
      </p>

      {/* DB Status */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📊 Database Status</h2>
        {!dbStatus ? <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Checking...</p>
        : dbStatus.error ? <p style={{ color: '#c00', margin: 0, fontSize: '0.9rem' }}>{dbStatus.error}</p>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Stops',      value: dbStatus.stops },
              { label: 'Routes',     value: dbStatus.routes },
              { label: 'Trips',      value: dbStatus.trips },
              { label: 'Stop Times', value: dbStatus.stop_times },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', padding: '0.5rem', background: '#f9f9f9', borderRadius: 6 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0070f3' }}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : '—'}
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

      {/* Add Feed */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>➕ Load GTFS Feed</h2>
        <p style={{ color: '#666', fontSize: '0.83rem', margin: '0 0 0.75rem' }}>
          Downloads the ZIP once, caches it, then loads each table separately. Stop times are loaded via the Edge Function below.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Agency name (e.g. TTC)" disabled={isActive}
            style={{ width: 180, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }} />
          <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="GTFS ZIP URL" disabled={isActive}
            style={{ flex: 1, minWidth: 260, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }} />
          <button onClick={isActive ? () => { abortRef.current = true; setPhase('cancelled') } : startLoad}
            disabled={!isActive && (!newUrl.trim() || !newName.trim())}
            style={{
              padding: '0.5rem 1.25rem',
              background: isActive ? '#c00' : (!newUrl.trim() || !newName.trim()) ? '#ccc' : '#0070f3',
              color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold',
              cursor: (!isActive && (!newUrl.trim() || !newName.trim())) ? 'not-allowed' : 'pointer'
            }}>
            {isActive ? '⏹ Cancel' : 'Load Feed'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa', alignSelf: 'center' }}>Quick add:</span>
          {[
            { name: 'GO Transit', url: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip' },
            { name: 'UP Express', url: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/UP-GTFS.zip' },
            { name: 'MiApp',      url: 'https://www.miapp.ca/GTFS/google_transit.zip' },
            { name: 'TTC',        url: 'http://opendata.toronto.ca/toronto.transit.commission/ttc-routes-and-schedules/OpenData_TTC_Schedules.zip' },
          ].map(f => (
            <button key={f.name} onClick={() => { setNewName(f.name); setNewUrl(f.url) }} disabled={isActive}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', border: '1px solid #ccc', borderRadius: 4, background: '#f9f9f9', cursor: 'pointer' }}>
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Progress */}
      {phase && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>
              {phase === 'done' ? '✅' : phase === 'error' ? '❌' : phase === 'cancelled' ? '⏹' : '⏳'} Loading Progress
            </h2>
            {phase === 'loading' && <span style={{ fontSize: '0.8rem', color: '#888' }}>{completedTables} / {TABLE_SEQUENCE.length} tables</span>}
          </div>

          {/* Cache phase status */}
          <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem',
            color: cacheMsg?.startsWith('✅') ? '#008000' : cacheMsg?.startsWith('❌') ? '#c00' : '#555' }}>
            {cacheMsg || 'Preparing...'}
          </div>

          {phase !== 'caching' && (
            <>
              <div style={{ height: 5, background: '#eee', borderRadius: 3, margin: '0.5rem 0' }}>
                <div style={{ height: 5, width: `${(completedTables / TABLE_SEQUENCE.length) * 100}%`,
                  background: phase === 'done' ? '#008000' : '#0070f3', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              {TABLE_SEQUENCE.map(t => <ProgressRow key={t.key} table={t} status={tableStatus} />)}
              {/* Stop times note */}
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>
                ⚡ Stop Times — load separately using the Edge Function section below
              </div>
            </>
          )}
          {phase === 'done' && (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#008000', fontWeight: 'bold' }}>
              ✅ All tables loaded! Now load Stop Times below using the Edge Function.
            </p>
          )}
        </div>
      )}

      {/* Stop Times — Edge Function */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>⚡ Stop Times (Edge Function)</h2>
        <p style={{ color: '#666', fontSize: '0.83rem', margin: '0 0 0.75rem' }}>
          Stop times are loaded via Supabase Edge Function — handles large files (200MB+) with no timeout.
          Automatically skips if the feed version hasn't changed.
        </p>
        {loadedFeeds.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0 }}>No feeds loaded yet — load a feed above first.</p>
        ) : loadedFeeds.map(feed => {
            const st = stopTimesStatus[feed.url]
            return (
              <div key={feed.url} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{feed.name}</div>
                  {st && (
                    <div style={{ fontSize: '0.78rem', marginTop: 2,
                      color: st.status === 'done' ? '#008000' : st.status === 'error' ? '#c00' : st.status === 'skipped' ? '#888' : '#555' }}>
                      {st.message}
                    </div>
                  )}
                  {feed.stop_times_loaded_at && !st && (
                    <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                      Last loaded: {new Date(feed.stop_times_loaded_at).toLocaleString()} • {feed.stop_times_row_count?.toLocaleString()} rows
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => loadStopTimes(feed, false)}
                    disabled={st?.status === 'loading'}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                    {st?.status === 'loading' ? '⏳ Loading...' : 'Load / Update'}
                  </button>
                  <button onClick={() => loadStopTimes(feed, true)}
                    disabled={st?.status === 'loading'}
                    title="Force reload even if version unchanged"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: 5, cursor: 'pointer' }}>
                    Force Reload
                  </button>
                </div>
              </div>
            )
          })}
      </div>

      {/* Loaded Feeds */}
      {loadedFeeds.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📡 Loaded Feeds</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                {['Agency','Version','Status','Last Checked','Rows'].map(h => (
                  <th key={h} style={{ padding: '0.45rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadedFeeds.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 'bold' }}>{f.name}</td>
                  <td style={{ padding: '0.45rem 0.5rem', color: '#888', fontSize: '0.78rem' }}>{f.feed_version || '—'}</td>
                  <td style={{ padding: '0.45rem 0.5rem', color: f.status === 'loaded' ? '#008000' : '#888' }}>
                    {f.status === 'loaded' ? '✅ Loaded' : f.status}
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', color: '#aaa', fontSize: '0.78rem' }}>
                    {f.last_version_check ? new Date(f.last_version_check).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', color: '#888' }}>{f.row_count?.toLocaleString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#aaa' }}>
            🕒 Nightly cron runs at 3am UTC — automatically reloads any feed whose version has changed.
          </p>
        </div>
      )}

      <StopSearch />

      <p style={{ color: '#bbb', fontSize: '0.75rem', textAlign: 'center', marginTop: '2rem' }}>
        InterlineApp — GTFS data sourced from open transit data feeds.
      </p>
    </div>
  )
}

function StopSearch() {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState(null)
  const [searching, setSearching] = useState(false)

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/stops?q=${encodeURIComponent(query)}`)
      setResults(await res.json())
    } catch (e) { setResults({ error: e.message }) }
    setSearching(false)
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>🔍 Search Stops</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. Union Station, Kipling, Finch..."
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }} />
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
                  {['Stop Name','Feed','Code','Lat / Lon'].map(h => (
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
