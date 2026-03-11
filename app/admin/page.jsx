'use client'
import Link from 'next/link'

export default function AdminPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '0.25rem', fontSize: '0.75rem', color: '#aaa' }}>
        <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>← Public site</Link>
      </div>

      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', borderBottom: '3px solid #0070f3', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
        🔧 Admin
      </h1>
      <p style={{ color: '#888', marginTop: 0, marginBottom: '2rem', fontSize: '0.9rem' }}>
        Internal tools for managing InterlineApp data sources.
      </p>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {[
          {
            href: '/admin/gtfs_schedule',
            emoji: '🗓️',
            title: 'GTFS Schedule',
            desc: 'Load and manage static GTFS feed data — stops, routes, trips, calendars, and stop times. Supports chunked loading for large feeds.',
          },
          {
            href: '/admin/gtfs_realtime',
            emoji: '📡',
            title: 'GTFS Realtime',
            desc: 'Configure and monitor real-time GTFS feeds — vehicle positions, trip updates, and service alerts.',
          },
          {
            href: '/admin/gtfs_bike',
            emoji: '🚲',
            title: 'Bike Share',
            desc: 'Manage Bike Share Toronto station data — docking stations, availability feeds, and GBFS configuration.',
          },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
              padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#0070f3'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e0e0e0'}
            >
              <span style={{ fontSize: '2rem' }}>{item.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: '0.2rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#ccc', fontSize: '1.2rem' }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
