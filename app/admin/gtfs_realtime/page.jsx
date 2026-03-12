'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const AGENCY_COLORS = {
  GO:    '#8ECB5A',
  UP:    '#5EA8E8',
  TTC:   '#E06060',
  MiWay: '#DFA832',
}

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

function FeedRow({ feed, onToggle, toggling }) {
  const isToggling = toggling === feed.id
  const hasError = !!feed.last_error
  return (
    <tr style={{ borderBottom: '1px solid #f5f5f5' }}>
      <td style={{ padding: '0.7rem 0.75rem' }}><AgencyBadge agency={feed.agency} /></td>
      <td style={{ padding: '0.7rem 0.75rem', fontSize: '0.82rem', color: '#555', textTransform: 'capitalize' }}>{feed.feed_type}</td>
      <td style={{ padding: '0.7rem 0.75rem' }}>
        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#888', wordBreak: 'break-all', maxWidth: 280, display: 'block' }}>
          {feed.url}
        </span>
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
    </tr>
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

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 15000)
    return () => clearInterval(interval)
  }, [])

  async function loadAll() {
    try {
      const [feedsRes, cacheRes] = await Promise.all([
        fetch('/api/realtime-feeds'),
        fetch('/api/vehicles'),
      ])
      const feedsData = await feedsRes.json()
      const cacheData = await cacheRes.json()
      if (feedsData.error) throw new Error(feedsData.error)
      setFeeds(feedsData.feeds ?? [])
      setCache(cacheData)
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

  async function pollNow() {
    setPolling(true)
    setPollMsg(null)
    try {
      const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnon) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in Vercel env vars')
      }
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
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#aaa' }}>
        <Link href="/admin" style={{ color: '#aaa', textDecoration: 'none' }}>← Admin</Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
        <h1 style={{ color: '#1a1a1a', margin: 0 }}>📡 GTFS Realtime</h1>
        <button onClick={pollNow} disabled={polling} style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 'bold', background: polling ? '#ccc' : '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: polling ? 'not-allowed' : 'pointer' }}>
          {polling ? '⏳ Polling...' : '⚡ Poll Now'}
        </button>
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
          { label: 'Refresh Cycle',   value: '15–30s' },
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
          <p style={{ color: '#aaa', fontSize: '0.9rem', margin: 0 }}>No feeds found. Run the SQL migration to seed the feed registry.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Agency', 'Type', 'URL', 'Vehicles', 'Last Polled', 'Enabled'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #ddd', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feeds.map(feed => (
                  <FeedRow key={feed.id} feed={feed} onToggle={handleToggle} toggling={toggling} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 8, padding: '1rem', fontSize: '0.83rem', color: '#0050b3', lineHeight: 1.6 }}>
        <strong>How it works:</strong> The <code>transit-vehicles</code> Supabase Edge Function reads enabled feeds from <code>realtime_feeds</code>, polls each agency, and writes all vehicles to <code>vehicle_cache</code>. The GO Transit API key lives in Supabase Vault — never in Vercel or the browser. Your <code>/api/vehicles</code> route serves the cached data with a 10s CDN header.
      </div>
    </div>
  )
}
