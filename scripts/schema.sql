-- InterlineApp Full GTFS Schema
-- Run this in Supabase SQL Editor

-- Feed sources registry
CREATE TABLE IF NOT EXISTS feed_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  loaded_at TIMESTAMP,
  row_count INTEGER,
  status TEXT DEFAULT 'pending'
);

-- agency.txt
CREATE TABLE IF NOT EXISTS agencies (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  agency_id TEXT,
  agency_name TEXT,
  agency_url TEXT,
  agency_timezone TEXT,
  agency_lang TEXT,
  agency_phone TEXT,
  agency_fare_url TEXT,
  cemv_support TEXT
);

-- routes.txt
CREATE TABLE IF NOT EXISTS routes (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  route_id TEXT NOT NULL,
  agency_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  route_desc TEXT,
  route_type TEXT,
  route_url TEXT,
  route_color TEXT,
  route_text_color TEXT,
  UNIQUE(feed_source, route_id)
);

-- stops.txt
CREATE TABLE IF NOT EXISTS stops (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  stop_code TEXT,
  stop_name TEXT,
  stop_desc TEXT,
  stop_lat NUMERIC,
  stop_lon NUMERIC,
  zone_id TEXT,
  stop_url TEXT,
  location_type TEXT,
  parent_station TEXT,
  stop_timezone TEXT,
  wheelchair_boarding TEXT,
  UNIQUE(feed_source, stop_id)
);

-- trips.txt
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  route_id TEXT,
  service_id TEXT,
  trip_headsign TEXT,
  trip_short_name TEXT,
  direction_id TEXT,
  block_id TEXT,
  shape_id TEXT,
  wheelchair_accessible TEXT,
  bikes_allowed TEXT,
  UNIQUE(feed_source, trip_id)
);

-- stop_times.txt
CREATE TABLE IF NOT EXISTS stop_times (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  trip_id TEXT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER,
  stop_headsign TEXT,
  pickup_type TEXT,
  drop_off_type TEXT,
  shape_dist_traveled TEXT
);

-- calendar.txt
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

-- calendar_dates.txt
CREATE TABLE IF NOT EXISTS calendar_dates (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  service_id TEXT NOT NULL,
  date TEXT,
  exception_type TEXT
);

-- shapes.txt
CREATE TABLE IF NOT EXISTS shapes (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  shape_id TEXT NOT NULL,
  shape_pt_lat NUMERIC,
  shape_pt_lon NUMERIC,
  shape_pt_sequence INTEGER,
  shape_dist_traveled TEXT
);

-- feed_info.txt
CREATE TABLE IF NOT EXISTS feed_info (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  feed_publisher_name TEXT,
  feed_publisher_url TEXT,
  feed_lang TEXT,
  default_lang TEXT,
  feed_start_date TEXT,
  feed_end_date TEXT,
  feed_version TEXT,
  feed_contact_email TEXT,
  feed_contact_url TEXT
);

-- stop_amenities.txt (GO Transit custom)
CREATE TABLE IF NOT EXISTS stop_amenities (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  shelter TEXT,
  washroom TEXT,
  bike_rack TEXT,
  bench TEXT
);

-- transfers.txt
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  from_stop_id TEXT,
  to_stop_id TEXT,
  transfer_type TEXT,
  min_transfer_time TEXT
);

-- fare_attributes.txt
CREATE TABLE IF NOT EXISTS fare_attributes (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  fare_id TEXT,
  price TEXT,
  currency_type TEXT,
  payment_method TEXT,
  transfers TEXT
);

-- fare_rules.txt
CREATE TABLE IF NOT EXISTS fare_rules (
  id SERIAL PRIMARY KEY,
  feed_source TEXT NOT NULL,
  fare_id TEXT,
  origin_id TEXT,
  destination_id TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stop_times_trip ON stop_times(feed_source, trip_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times(feed_source, stop_id);
CREATE INDEX IF NOT EXISTS idx_stops_name ON stops(stop_name);
CREATE INDEX IF NOT EXISTS idx_routes_short ON routes(route_short_name);
CREATE INDEX IF NOT EXISTS idx_shapes_id ON shapes(feed_source, shape_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(feed_source, route_id);
CREATE INDEX IF NOT EXISTS idx_calendar_dates_service ON calendar_dates(feed_source, service_id);
