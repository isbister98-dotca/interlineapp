-- Run this in your Vercel Postgres query editor to set up all tables
-- Vercel Dashboard → Storage → Your Database → Query

-- Tracks which feeds have been loaded and when
CREATE TABLE IF NOT EXISTS feed_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  loaded_at TIMESTAMP,
  row_count INTEGER,
  status TEXT DEFAULT 'pending'
);

-- Insert the 4 GTFS feeds we want to track
INSERT INTO feed_sources (name, url) VALUES
  ('GO Transit', 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip'),
  ('MiApp', 'https://www.miapp.ca/GTFS/google_transit.zip'),
  ('UP Express', 'https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/UP-GTFS.zip')
ON CONFLICT (url) DO NOTHING;

-- Transit agencies
CREATE TABLE IF NOT EXISTS agencies (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  agency_id TEXT,
  agency_name TEXT,
  agency_url TEXT,
  agency_timezone TEXT,
  agency_lang TEXT,
  agency_phone TEXT
);

-- Transit routes (bus lines, train lines, etc.)
CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  route_id TEXT NOT NULL,
  agency_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  route_type TEXT,
  route_color TEXT,
  route_text_color TEXT,
  UNIQUE(feed_source, route_id)
);

-- Stops (stations, bus stops, platforms)
CREATE TABLE IF NOT EXISTS stops (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  stop_name TEXT,
  stop_lat NUMERIC,
  stop_lon NUMERIC,
  stop_code TEXT,
  zone_id TEXT,
  UNIQUE(feed_source, stop_id)
);

-- Trips (individual scheduled runs of a route)
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  route_id TEXT,
  service_id TEXT,
  trip_headsign TEXT,
  direction_id TEXT,
  shape_id TEXT,
  UNIQUE(feed_source, trip_id)
);

-- Calendar (which days of the week service runs)
CREATE TABLE IF NOT EXISTS calendar (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  service_id TEXT NOT NULL,
  monday BOOLEAN,
  tuesday BOOLEAN,
  wednesday BOOLEAN,
  thursday BOOLEAN,
  friday BOOLEAN,
  saturday BOOLEAN,
  sunday BOOLEAN,
  start_date TEXT,
  end_date TEXT
);

-- Stop times (when each trip arrives at each stop)
-- Note: this table can get very large (millions of rows)
CREATE TABLE IF NOT EXISTS stop_times (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER
);

-- Index for fast stop_times lookups
CREATE INDEX IF NOT EXISTS idx_stop_times_trip ON stop_times(feed_source, trip_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times(feed_source, stop_id);
CREATE INDEX IF NOT EXISTS idx_stops_name ON stops(stop_name);
CREATE INDEX IF NOT EXISTS idx_routes_short ON routes(route_short_name);
