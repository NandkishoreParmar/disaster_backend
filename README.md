# Disaster Response Coordination Platform

A comprehensive disaster response platform built with React, Node.js, Express, and Supabase that aggregates real-time data to aid disaster management.

## Features

### Core Features
- **Disaster Data Management**: Robust CRUD operations for disaster records with location extraction
- **Real-time Social Media Monitoring**: Mock Twitter/Bluesky API integration with WebSocket updates
- **Geospatial Resource Mapping**: PostGIS-powered location-based queries
- **Official Updates Aggregation**: Web scraping for government and relief organization updates
- **Image Verification**: Google Gemini AI integration for disaster image authenticity verification
- **Location Extraction & Geocoding**: Gemini AI + mapping services for coordinate resolution
- **Comprehensive Caching**: Supabase-based caching system with TTL support
- **Real-time Updates**: WebSocket integration for live data streaming

### Technical Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, Winston Logging
- **Database**: Supabase (PostgreSQL + PostGIS)
- **External APIs**: Google Gemini AI, Google Maps/Mapbox/OpenStreetMap
- **Caching**: Supabase-based cache with TTL
- **Real-time**: WebSocket connections for live updates

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- Supabase account
- Google Gemini API key
- Optional: Google Maps or Mapbox API key

### Environment Configuration

1. Copy `.env.example` to `.env`
2. Fill in your API keys:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key  # Optional
   MAPBOX_API_KEY=your_mapbox_api_key            # Optional
   ```

### Database Setup

1. Create a new Supabase project
2. Run the migration file in the Supabase SQL editor:
   ```sql
   -- Copy and paste the contents of supabase/migrations/create_initial_schema.sql
   ```

### Installation & Running

```bash
# Install dependencies
npm install

# Start development server (both frontend and backend)
npm run dev

# Or run separately:
npm run client  # Frontend on port 5173
npm run server  # Backend on port 3001
```

## API Endpoints

### Disasters
- `GET /api/disasters` - List disasters with filtering
- `POST /api/disasters` - Create new disaster
- `GET /api/disasters/:id` - Get specific disaster
- `PUT /api/disasters/:id` - Update disaster
- `DELETE /api/disasters/:id` - Delete disaster (admin only)

### Social Media
- `GET /api/social-media/:disasterId/social-media` - Get social media reports
- `GET /api/social-media/mock-social-media` - Mock social media endpoint

### Resources
- `GET /api/resources/:disasterId/resources` - Get resources with geospatial filtering
- `POST /api/resources/:disasterId/resources` - Add new resource

### Official Updates
- `GET /api/updates/:disasterId/official-updates` - Get official updates
- `GET /api/updates/scrape-official-updates` - Scrape official sources

### Verification
- `POST /api/verification/:disasterId/verify-image` - Verify image authenticity
- `GET /api/verification/:disasterId/verification-stats` - Get verification statistics

### Geocoding
- `POST /api/geocoding` - Extract location and geocode coordinates

## WebSocket Events

### Client → Server
- `join_disaster` - Join disaster-specific room
- `leave_disaster` - Leave disaster room

### Server → Client
- `disaster_created` - New disaster created
- `disaster_updated` - Disaster updated
- `disaster_deleted` - Disaster deleted
- `social_media_updated` - New social media data
- `resources_updated` - Resources updated
- `official_updates_updated` - Official updates refreshed
- `image_verified` - Image verification completed

## Authentication

The platform uses mock authentication for demonstration:
- `netrunnerX` (admin)
- `reliefAdmin` (admin)
- `contributor1` (contributor)
- `citizen1` (contributor)

Set the `X-User-ID` header in requests to authenticate as different users.

## Geospatial Features

The platform leverages PostGIS for advanced geospatial queries:

- **Location Storage**: Disasters and resources store coordinates as PostGIS GEOGRAPHY points
- **Distance Queries**: Find resources within specified radius using `ST_DWithin`
- **Spatial Indexing**: GIST indexes for fast geospatial lookups
- **Helper Functions**: Custom PostgreSQL functions for common geospatial operations

## Caching Strategy

All external API calls are cached in Supabase:
- **TTL Support**: Configurable cache expiration times
- **Smart Invalidation**: Automatic cleanup of expired entries
- **Multi-Provider Fallback**: Graceful degradation when APIs fail

## External API Integration

### Google Gemini AI
- **Location Extraction**: Extract location names from disaster descriptions
- **Image Verification**: Analyze uploaded images for authenticity and disaster context

### Mapping Services
- **Google Maps API**: Primary geocoding service
- **Mapbox**: Secondary geocoding option
- **OpenStreetMap Nominatim**: Fallback geocoding service

### Social Media Monitoring
- **Mock Twitter API**: Simulated social media posts with realistic data
- **Real-time Filtering**: Filter by platform, urgency, keywords
- **Verification Status**: Track verified vs unverified posts

## Development Notes

This platform was built with modern development practices:

- **Modular Architecture**: Clean separation of concerns across files
- **Comprehensive Error Handling**: Graceful degradation and informative error messages
- **Structured Logging**: Winston-based logging with structured format
- **Rate Limiting**: Protection against API abuse
- **Input Validation**: Joi schema validation for all endpoints
- **Security Headers**: Helmet.js for security best practices

## Production Deployment

For production deployment:

1. **Environment Variables**: Ensure all production API keys are set
2. **Database**: Configure Supabase for production workloads
3. **SSL/TLS**: Enable HTTPS for all API endpoints
4. **Monitoring**: Set up logging and monitoring for external API calls
5. **Rate Limiting**: Implement more sophisticated rate limiting
6. **Caching**: Consider Redis for high-performance caching
7. **CDN**: Use CDN for static assets and image delivery

## Contributing

This platform demonstrates advanced full-stack development patterns including:
- Real-time data synchronization
- Geospatial database queries
- External API integration with caching
- AI-powered content analysis
- WebSocket-based live updates
- Comprehensive error handling and logging

The codebase is structured for maintainability and extensibility, making it easy to add new features or modify existing functionality.
