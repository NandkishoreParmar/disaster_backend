import express from 'express';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /disasters/:id/resources - Get resources near a disaster location
router.get('/:disasterId/resources', async (req, res, next) => {
  try {
    const { disasterId } = req.params;
    const { lat, lon, radius = 10000, type } = req.query; // radius in meters
    
    // First get the disaster to get its location if lat/lon not provided
    let latitude = parseFloat(lat);
    let longitude = parseFloat(lon);
    
    if (!latitude || !longitude) {
      const { data: disaster, error: disasterError } = await supabase
        .from('disasters')
        .select('location')
        .eq('id', disasterId)
        .single();
      
      if (disasterError) throw disasterError;
      
      if (!disaster || !disaster.location) {
        return res.status(400).json({ 
          error: 'No coordinates provided and disaster has no location data' 
        });
      }
      
      // Extract coordinates from PostGIS POINT
      const match = disaster.location.match(/POINT\(([^\s]+)\s+([^\)]+)\)/);
      if (match) {
        longitude = parseFloat(match[1]);
        latitude = parseFloat(match[2]);
      }
    }
    
    // Build geospatial query
    let query = supabase
      .from('resources')
      .select('*')
      .eq('disaster_id', disasterId);
    
    // Add spatial filter if we have coordinates
    if (latitude && longitude) {
      // Use PostGIS ST_DWithin function for distance-based filtering
      query = query.rpc('get_resources_within_distance', {
        center_lat: latitude,
        center_lon: longitude,
        radius_meters: parseInt(radius)
      });
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data, error } = await query;
    
    if (error) {
      // If the RPC function doesn't exist, fall back to regular query
      if (error.code === '42883') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('resources')
          .select('*')
          .eq('disaster_id', disasterId);
        
        if (fallbackError) throw fallbackError;
        
        const result = {
          disaster_id: disasterId,
          search_center: { latitude, longitude },
          search_radius: parseInt(radius),
          total_resources: fallbackData.length,
          resources: fallbackData
        };
        
        logger.info(`Retrieved ${fallbackData.length} resources for disaster ${disasterId} (fallback query)`);
        return res.json(result);
      }
      throw error;
    }
    
    const result = {
      disaster_id: disasterId,
      search_center: { latitude, longitude },
      search_radius: parseInt(radius),
      total_resources: data.length,
      resources: data
    };
    
    logger.info(`Retrieved ${data.length} resources within ${radius}m of disaster ${disasterId}`);
    
    // Emit real-time update
    req.io.to(`disaster_${disasterId}`).emit('resources_updated', result);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /disasters/:id/resources - Add a resource to a disaster
router.post('/:disasterId/resources', async (req, res, next) => {
  try {
    const { disasterId } = req.params;
    const { name, location_name, type, latitude, longitude, description, contact_info } = req.body;
    
    if (!name || !location_name || !type) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, location_name, type' 
      });
    }
    
    const resourceData = {
      disaster_id: disasterId,
      name,
      location_name,
      type,
      description,
      contact_info,
      created_by: req.user.id
    };
    
    // Add location point if coordinates provided
    if (latitude && longitude) {
      resourceData.location = `POINT(${longitude} ${latitude})`;
    }
    
    const { data, error } = await supabase
      .from('resources')
      .insert(resourceData)
      .select()
      .single();
    
    if (error) throw error;
    
    logger.info(`Created resource: ${data.id} for disaster ${disasterId}`);
    
    // Emit real-time update
    req.io.to(`disaster_${disasterId}`).emit('resource_created', data);
    
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

export default router;