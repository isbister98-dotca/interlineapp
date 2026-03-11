'use client'
import { useState } from 'react'
import Link from 'next/link'

const REALTIME_FEEDS = [
  {
    name: 'GO Transit',
    vehiclePositions: 'https://api.openmetrolinx.com/OpenDataAPI/api/V1/Gtfs.proto/Feed/VehiclePosition',
    tripUpdates:      'https://api.openmetrolinx.com/OpenDataAPI/api/V1/Gtfs.proto/Feed/TripUpdates',
    alerts:           null,
  },
  {
    name: 'TTC',
    vehiclePositions: 'https://gtfs.toronto.ca/realtime/TripUpdates/GTFSRTripUpdates.proto',
    tripUpdates:      'https://gtfs.toronto.ca/realtime/TripUpdates/GTFSRTripUpdates.proto',
    alerts:           'https://gtfs.toronto.ca/realtime/ServiceAlerts/GTFSRServiceAlerts.proto',
  },
]

function FeedRow({ feed }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, background: '#fff', marginBottom: '0.75rem', overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: '1.2rem' }}>📡</span>
        <span style={{ fontWeight: 600, color: '#1a1a1a', flex: 1 }}>{feed.name}</span>
        <span style={{ fontSize: '0.75rem', background: '#e8f5e9', color: '#2e7d32', padding: '0.15rem 0.5rem', borderRadius: 12, fontWeight: 600 }}>
          Active
        </span>
        <span style={{ color: '#bbb', fontSize: '1rem', transform: expanded ? 'rotate(90deg)' : 'none', transition: '0.15s' }}>›</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '0.75rem 1rem', fontSize: '0.82rem' }}>
          {[
            { label: 'Vehicle Positions', url: feed.vehiclePositions },
            { label: 'Trip Updates',      url: feed.tripUpdates },
            { label: 'Service Alerts',    url: feed.alerts },
          ].map(({ label, url }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #f9f9f9' }}>
              <span style={{ color: '#555', minWidth: 150 }}>{label}</span>
              {url
                ? <span style={{ color: '#888', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{url}</span>
                : <span style={{ color: '#ccc' }}>—</span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GtfsRealtimePage() {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl]   = useState('')

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#aaa' }}>
        <Link href="/admin" style={{ color: '#aaa', textDecoration: 'none' }}>← Admin</Link>
      </div>

      <h1 style={{ color: '#1a1a1a', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
        📡 GTFS Realtime
      </h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Monitor and configure GTFS-RT feeds — vehicle positions, trip updates, and service alerts.
      </p>

      {/* Status overview */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📊 Feed Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Active Feeds',      value: REALTIME_FEEDS.length },
            { label: 'Update Interval',   value: '30s' },
            { label: 'Last Poll',         value: '—' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center', padding: '0.5rem', background: '#f9f9f9', borderRadius: 6 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#0070f3' }}>{item.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Configured feeds */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📋 Configured Feeds</h2>
        {REALTIME_FEEDS.map(f => <FeedRow key={f.name} feed={f} />)}
      </div>

      {/* Add feed */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>➕ Add Realtime Feed</h2>
        <p style={{ color: '#888', fontSize: '0.83rem', margin: '0 0 0.75rem' }}>
          Paste a GTFS-RT protobuf endpoint URL. Vehicle positions, trip updates, and alerts can be added separately.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Agency name"
            style={{ width: 180, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }} />
          <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="GTFS-RT protobuf URL"
            style={{ flex: 1, minWidth: 260, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }} />
          <button
            disabled={!newName.trim() || !newUrl.trim()}
            style={{
              padding: '0.5rem 1.25rem',
              background: (!newName.trim() || !newUrl.trim()) ? '#ccc' : '#0070f3',
              color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold',
              cursor: (!newName.trim() || !newUrl.trim()) ? 'not-allowed' : 'pointer'
            }}>
            Add Feed
          </button>
        </div>
      </div>

      <div style={{ background: '#fffbea', border: '1px solid #ffe58f', borderRadius: 8, padding: '0.85rem 1rem' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#7c5a00' }}>
          ⚠️ <strong>Not yet connected to a database.</strong> Real-time feed ingestion pipeline coming soon.
          Feed URLs listed above are for reference only.
        </p>
      </div>
    </div>
  )
}
