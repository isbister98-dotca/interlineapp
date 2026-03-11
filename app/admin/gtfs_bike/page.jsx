'use client'
import { useState } from 'react'
import Link from 'next/link'

const BIKE_FEEDS = [
  {
    name: 'Bike Share Toronto',
    gbfsBase:  'https://tor.publicbikesystem.net/customer/gbfs/v2/en',
    stationInfo:   'https://tor.publicbikesystem.net/customer/gbfs/v2/en/station_information',
    stationStatus: 'https://tor.publicbikesystem.net/customer/gbfs/v2/en/station_status',
    freeBikeStatus: 'https://tor.publicbikesystem.net/customer/gbfs/v2/en/free_bike_status',
    version: 'GBFS 2.x',
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
        <span style={{ fontSize: '1.2rem' }}>🚲</span>
        <span style={{ fontWeight: 600, color: '#1a1a1a', flex: 1 }}>{feed.name}</span>
        <span style={{ fontSize: '0.73rem', background: '#e3f2fd', color: '#1565c0', padding: '0.15rem 0.5rem', borderRadius: 12, fontWeight: 600 }}>
          {feed.version}
        </span>
        <span style={{ color: '#bbb', fontSize: '1rem', transform: expanded ? 'rotate(90deg)' : 'none', transition: '0.15s' }}>›</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '0.75rem 1rem', fontSize: '0.82rem' }}>
          {[
            { label: 'GBFS Base URL',     url: feed.gbfsBase },
            { label: 'Station Info',      url: feed.stationInfo },
            { label: 'Station Status',    url: feed.stationStatus },
            { label: 'Free Bike Status',  url: feed.freeBikeStatus },
          ].map(({ label, url }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #f9f9f9' }}>
              <span style={{ color: '#555', minWidth: 150 }}>{label}</span>
              <span style={{ color: '#888', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{url}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GtfsBikePage() {
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl]   = useState('')

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: '#aaa' }}>
        <Link href="/admin" style={{ color: '#aaa', textDecoration: 'none' }}>← Admin</Link>
      </div>

      <h1 style={{ color: '#1a1a1a', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
        🚲 Bike Share
      </h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Manage GBFS (General Bikeshare Feed Specification) feeds for bike share networks.
      </p>

      {/* Status overview */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📊 Feed Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Networks',        value: BIKE_FEEDS.length },
            { label: 'Stations',        value: '—' },
            { label: 'Last Sync',       value: '—' },
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
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>📋 Configured Networks</h2>
        {BIKE_FEEDS.map(f => <FeedRow key={f.name} feed={f} />)}
      </div>

      {/* Add network */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>➕ Add Bike Share Network</h2>
        <p style={{ color: '#888', fontSize: '0.83rem', margin: '0 0 0.75rem' }}>
          Paste the GBFS base URL for a bike share operator. The feed discovery endpoint will be used to find station info and status automatically.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Network name"
            style={{ width: 180, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }} />
          <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="GBFS base URL"
            style={{ flex: 1, minWidth: 260, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9rem' }} />
          <button
            disabled={!newName.trim() || !newUrl.trim()}
            style={{
              padding: '0.5rem 1.25rem',
              background: (!newName.trim() || !newUrl.trim()) ? '#ccc' : '#0070f3',
              color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold',
              cursor: (!newName.trim() || !newUrl.trim()) ? 'not-allowed' : 'pointer'
            }}>
            Add Network
          </button>
        </div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa', alignSelf: 'center' }}>Quick add:</span>
          {[
            { name: 'Bike Share Toronto', url: 'https://tor.publicbikesystem.net/customer/gbfs/v2/en' },
          ].map(f => (
            <button key={f.name} onClick={() => { setNewName(f.name); setNewUrl(f.url) }}
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', border: '1px solid #ccc', borderRadius: 4, background: '#f9f9f9', cursor: 'pointer' }}>
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fffbea', border: '1px solid #ffe58f', borderRadius: 8, padding: '0.85rem 1rem' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#7c5a00' }}>
          ⚠️ <strong>Not yet connected to a database.</strong> Bike share data ingestion pipeline coming soon.
          Feed URLs listed above are for reference only.
        </p>
      </div>
    </div>
  )
}
