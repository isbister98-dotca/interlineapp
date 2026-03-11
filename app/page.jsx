export default function HomePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 2rem', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.5rem' }}>
          🚌 InterlineApp
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#555', margin: 0, lineHeight: 1.6 }}>
          Open transit data for the Greater Toronto Area — aggregating schedules,
          real-time feeds, and cycling infrastructure into one place.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        {[
          { emoji: '🗓️', title: 'GTFS Schedules', desc: 'Static timetable data for bus, rail, and rapid transit agencies across the GTHA.' },
          { emoji: '📡', title: 'Real-Time Feeds', desc: 'Live vehicle positions, trip updates, and service alerts updated every 30 seconds.' },
          { emoji: '🚲', title: 'Bike Share', desc: 'Station availability, docking capacity, and historical ridership for Bike Share Toronto.' },
        ].map(card => (
          <div key={card.title} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{card.emoji}</div>
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>{card.title}</h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#777', lineHeight: 1.5 }}>{card.desc}</p>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700 }}>📊 Coverage</h2>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#555', lineHeight: 1.6 }}>
          InterlineApp currently aggregates data from agencies including GO Transit, TTC, Brampton Transit,
          York Region Transit, UP Express, MiApp, and more — covering the full GTHA network.
        </p>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#aaa' }}>
          Schedule data is refreshed nightly. Real-time data updates continuously.
        </p>
      </div>

      <div style={{ background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 10, padding: '1.25rem', marginBottom: '3rem' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#0050b3', lineHeight: 1.6 }}>
          <strong>Open Data</strong> — All transit data is sourced from publicly available GTFS feeds
          provided by transit agencies. InterlineApp is not affiliated with any transit operator.
        </p>
      </div>

      <footer style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#bbb' }}>
          InterlineApp — GTFS data sourced from open transit feeds.
        </p>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#ccc' }}>
          Built with Next.js & Supabase
        </p>
      </footer>
    </div>
  )
}
