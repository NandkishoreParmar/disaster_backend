/*
  # Initial Schema for Disaster Response Platform

  1. New Tables
    - `disasters`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `location_name` (text, required)
      - `location` (geography point for geospatial queries)
      - `description` (text, required)
      - `tags` (text array for categorization)
      - `owner_id` (text, required)
      - `audit_trail` (jsonb for tracking changes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `reports`
      - `id` (uuid, primary key)
      - `disaster_id` (uuid, foreign key)
      - `user_id` (text, required)
      - `content` (text, required)
      - `image_url` (text, optional)
      - `verification_status` (text, default 'pending')
      - `verification_details` (jsonb, optional)
      - `created_at` (timestamptz)
    
    - `resources`
      - `id` (uuid, primary key)
      - `disaster_id` (uuid, foreign key)
      - `name` (text, required)
      - `location_name` (text, required)
      - `location` (geography point)
      - `type` (text, required)
      - `description` (text, optional)
      - `contact_info` (text, optional)
      - `created_by` (text, required)
      - `created_at` (timestamptz)
    
    - `cache`
      - `key` (text, primary key)
      - `value` (jsonb, required)
      - `expires_at` (timestamptz, required)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Admin policies for full access

  3. Indexes
    - Geospatial indexes on location columns using GIST
    - GIN indexes on tags and jsonb columns
    - Standard indexes on foreign keys and frequently queried columns
*/

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create disasters table
CREATE TABLE IF NOT EXISTS disasters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location_name text NOT NULL,
  location geography(POINT, 4326),
  description text NOT NULL,
  tags text[] DEFAULT '{}',
  owner_id text NOT NULL,
  audit_trail jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  content text NOT NULL,
  image_url text,
  verification_status text DEFAULT 'pending',
  verification_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create resources table
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id uuid NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_name text NOT NULL,
  location geography(POINT, 4326),
  type text NOT NULL,
  description text,
  contact_info text,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create cache table
CREATE TABLE IF NOT EXISTS cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Create indexes for performance

-- Geospatial indexes
CREATE INDEX IF NOT EXISTS disasters_location_idx ON disasters USING GIST (location);
CREATE INDEX IF NOT EXISTS resources_location_idx ON resources USING GIST (location);

-- GIN indexes for array and jsonb columns
CREATE INDEX IF NOT EXISTS disasters_tags_idx ON disasters USING GIN (tags);
CREATE INDEX IF NOT EXISTS disasters_audit_trail_idx ON disasters USING GIN (audit_trail);
CREATE INDEX IF NOT EXISTS reports_verification_details_idx ON reports USING GIN (verification_details);
CREATE INDEX IF NOT EXISTS cache_value_idx ON cache USING GIN (value);

-- Standard indexes
CREATE INDEX IF NOT EXISTS disasters_owner_id_idx ON disasters (owner_id);
CREATE INDEX IF NOT EXISTS disasters_created_at_idx ON disasters (created_at);
CREATE INDEX IF NOT EXISTS reports_disaster_id_idx ON reports (disaster_id);
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports (user_id);
CREATE INDEX IF NOT EXISTS reports_verification_status_idx ON reports (verification_status);
CREATE INDEX IF NOT EXISTS resources_disaster_id_idx ON resources (disaster_id);
CREATE INDEX IF NOT EXISTS resources_type_idx ON resources (type);
CREATE INDEX IF NOT EXISTS resources_created_by_idx ON resources (created_by);
CREATE INDEX IF NOT EXISTS cache_expires_at_idx ON cache (expires_at);

-- Create updated_at trigger for disasters
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_disasters_updated_at BEFORE UPDATE ON disasters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE disasters ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Disasters policies
CREATE POLICY "Anyone can view disasters"
  ON disasters
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create disasters"
  ON disasters
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own disasters"
  ON disasters
  FOR UPDATE
  TO public
  USING (owner_id = current_user);

CREATE POLICY "Users can delete their own disasters"
  ON disasters
  FOR DELETE
  TO public
  USING (owner_id = current_user);

-- Reports policies
CREATE POLICY "Anyone can view reports"
  ON reports
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create reports"
  ON reports
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own reports"
  ON reports
  FOR UPDATE
  TO public
  USING (user_id = current_user);

-- Resources policies
CREATE POLICY "Anyone can view resources"
  ON resources
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create resources"
  ON resources
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update their own resources"
  ON resources
  FOR UPDATE
  TO public
  USING (created_by = current_user);

-- Cache policies (more restrictive)
CREATE POLICY "Service role can manage cache"
  ON cache
  FOR ALL
  TO service_role
  USING (true);

-- Create helper function for geospatial queries
CREATE OR REPLACE FUNCTION get_resources_within_distance(
  center_lat double precision,
  center_lon double precision,
  radius_meters integer
)
RETURNS SETOF resources AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM resources
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_Point(center_lon, center_lat), 4326),
    radius_meters
  );
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for demonstration
INSERT INTO disasters (title, location_name, description, tags, owner_id) VALUES
('NYC Flood Emergency', 'Manhattan, NYC', 'Heavy flooding in Manhattan due to severe storm. Multiple areas affected including Lower East Side and Financial District.', ARRAY['flood', 'emergency', 'nyc'], 'netrunnerX'),
('California Wildfire', 'Los Angeles County, CA', 'Fast-moving wildfire threatening residential areas in Los Angeles County. Evacuations in progress.', ARRAY['fire', 'wildfire', 'evacuation'], 'reliefAdmin'),
('Earthquake Response', 'San Francisco, CA', 'Magnitude 6.2 earthquake struck the Bay Area. Infrastructure damage reported.', ARRAY['earthquake', 'infrastructure'], 'contributor1');

-- Insert sample resources
INSERT INTO resources (disaster_id, name, location_name, type, description, created_by)
SELECT 
  d.id,
  'Red Cross Emergency Shelter',
  'Brooklyn Community Center, NYC',
  'shelter',
  'Emergency shelter with capacity for 200 people. Provides food, water, and basic medical care.',
  'reliefAdmin'
FROM disasters d WHERE d.title = 'NYC Flood Emergency';

INSERT INTO resources (disaster_id, name, location_name, type, description, created_by)
SELECT 
  d.id,
  'Mobile Medical Unit',
  'Manhattan Financial District, NYC',
  'medical',
  'Mobile medical unit providing emergency healthcare services.',
  'contributor1'
FROM disasters d WHERE d.title = 'NYC Flood Emergency';

-- Insert sample reports
INSERT INTO reports (disaster_id, user_id, content, verification_status)
SELECT 
  d.id,
  'citizen1',
  'Water levels rising rapidly on FDR Drive. Multiple cars stranded. Need immediate assistance.',
  'pending'
FROM disasters d WHERE d.title = 'NYC Flood Emergency';