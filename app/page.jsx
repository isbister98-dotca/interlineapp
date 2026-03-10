'use client'
import { useState, useEffect } from 'react'

const FEEDS = [
  { name: 'GO Transit', url: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip', color: '#00853F' },
  { name: 'MiApp (Mississauga)', url: 'https://www.miapp.ca/GTFS/google_transit.zip', color: '#003DA5' },
  { name: 'UP Express', url: 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/UP-GTFS.zip', color: '#5B2D8E' },
]

export default function AdminPage() {
  const [status, setStatus] = useState({})
  const [loading, setLoading] = useState({})
  const [dbStatus, setDbStatus] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/status')
      const data = await res.json()
      setDbStatus(data)
    } catch (e) {
      setDbStatus({ error: 'Could not connect to database. Have you set up Supabase and added DATABASE_URL to Vercel?' })
    }
  }

  async function loadFeed(feed) {
    setLoading(prev => ({ ...prev, [feed.name]: true }))
    setStatus(prev => ({ ...prev, [feed.name]: 'Loading... this may take 1-3 minutes for large feeds' }))
    try {
      const res = await fetch('/api/load-gtfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: feed.url, name: feed.name })
      })
      const data = await res.json()
      if (data.success) {
        setStatus(prev => ({ ...prev, [feed.name]: `✅ Loaded! ${data.summary}` }))
      } else {
        setStatus(prev => ({ ...prev, [feed.name]: `❌ Error: ${data.error}` }))
      }
    } catch (e) {
      setStatus(prev => ({ ...prev, [feed.name]: `❌ Failed: ${e.message}` }))
    }
    setLoading(prev => ({ ...prev, [feed.name]: false }))
    fetchStatus()
  }

  async function searchStops() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/stops?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      setSearchResults(data)
    } catch (e) {
      setSearchResults({ error: e.message })
    }
    setSearching(false)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ color: '#1a1a1a', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem' }}>
        🚌 InterlineApp
      </h1>
      <p style={{ color: '#666' }}>Load and explore GO Transit, MiApp, and UP Express schedule data.</p>

      {/* Database Status */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📊 Database Status</h2>
        {!dbStatus ? (
          <p style={{ color: '#666', margin: 0 }}>Checking connection...</p>
        ) : dbStatus.error ? (
          <p style={{ color: '#c00', margin: 0 }}>{dbStatus.error}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Stops', value: dbStatus.stops },
              { label: 'Routes', value: dbStatus.routes },
              { label: 'Trips', value: dbStatus.trips },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', padding: '0.5rem', background: '#f9f9f9', borderRadius: 6 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0070f3' }}>{item.value?.toLocaleString() ?? '—'}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{item.label}</div>
              </div>
            ))}
          </div>
        )}
        <button onClick={fetchStatus} style={{ marginTop: '0.75rem', padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, background: '#fff' }}>
          Refresh counts
        </button>
      </div>

      {/* Feed Loader */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>⬇️ Load GTFS Feeds</h2>
        <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          Click a button to download and import that feed's schedule data into your database. Large feeds (like GO Transit) may take 2-3 minutes.
        </p>
        {FEEDS.map(feed => (
          <div key={feed.name} style={{ marginBottom: '1rem', padding: '0.75rem', border: `2px solid ${feed.color}20`, borderLeft: `4px solid ${feed.color}`, borderRadius: 6, background: `${feed.color}08` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: feed.color }}>{feed.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888', wordBreak: 'break-all' }}>{feed.url}</div>
              </div>
              <button
                onClick={() => loadFeed(feed)}
                disabled={loading[feed.name]}
                style={{
                  padding: '0.5rem 1rem',
                  background: loading[feed.name] ? '#ccc' : feed.color,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: loading[feed.name] ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                {loading[feed.name] ? '⏳ Loading...' : 'Load Feed'}
              </button>
            </div>
            {status[feed.name] && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: status[feed.name].startsWith('✅') ? '#008000' : status[feed.name].startsWith('❌') ? '#c00' : '#666' }}>
                {status[feed.name]}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stop Search */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>🔍 Search Stops</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchStops()}
            placeholder="e.g. Union Station, Kipling, Bramalea..."
            style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }}
          />
          <button
            onClick={searchStops}
            disabled={searching}
            style={{ padding: '0.5rem 1rem', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchResults && (
          <div style={{ marginTop: '0.75rem' }}>
            {searchResults.error ? (
              <p style={{ color: '#c00' }}>{searchResults.error}</p>
            ) : searchResults.stops?.length === 0 ? (
              <p style={{ color: '#888' }}>No stops found. Try loading a feed first.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Stop Name</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Feed</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Lat / Lon</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.stops.map((stop, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '0.5rem' }}>{stop.stop_name}</td>
                      <td style={{ padding: '0.5rem', color: '#666' }}>{stop.feed_source}</td>
                      <td style={{ padding: '0.5rem', color: '#888', fontSize: '0.75rem' }}>{stop.stop_lat}, {stop.stop_lon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <p style={{ color: '#aaa', fontSize: '0.75rem', textAlign: 'center' }}>
        InterlineApp — GTFS data sourced from Metrolinx Open Data and MiApp. Refresh feeds periodically as schedules change.
      </p>
    </div>
  )
}
