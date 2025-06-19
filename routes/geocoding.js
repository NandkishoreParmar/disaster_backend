import express from 'express';
import Joi from 'joi';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Validation schema
const geocodeSchema = Joi.object({
  description: Joi.string().required().max(1000),
  extractLocation: Joi.boolean().default(true)
});

// POST /geocoding - Extract location from description and geocode
router.post('/', async (req, res, next) => {
  try {
    const { error: validationError, value } = geocodeSchema.validate(req.body);
    if (validationError) throw validationError;

    const { description, extractLocation } = value;
    
    let locationName = description;
    
    // Extract location using Gemini if requested
    if (extractLocation) {
      const cacheKey = `location_extract_${Buffer.from(description).toString('base64')}`;
      
      let extractedLocation = await cache.get(cacheKey);
      
      if (!extractedLocation) {
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
          
          const prompt = `Extract the specific location name from this disaster description. Return only the location name (city, state/province, country) or "NONE" if no clear location is found:

Description: "${description}"

Location:`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          extractedLocation = response.text().trim();
          
          // Cache the result
          await cache.set(cacheKey, extractedLocation, 60);
          
          logger.info(`Location extracted: "${extractedLocation}" from description`);
        } catch (error) {
          logger.error('Gemini location extraction error:', error);
          extractedLocation = 'NONE';
        }
      }
      
      if (extractedLocation !== 'NONE') {
        locationName = extractedLocation;
      }
    }

    // Geocode the location
    const geocodeResult = await geocodeLocation(locationName);
    
    const result = {
      original_description: description,
      extracted_location: extractLocation ? locationName : null,
      location_name: locationName,
      ...geocodeResult
    };

    logger.info(`Geocoding completed for: ${locationName}`);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Geocoding function with multiple providers
async function geocodeLocation(locationName) {
  const cacheKey = `geocode_${Buffer.from(locationName).toString('base64')}`;
  
  // Check cache first
  let cachedResult = await cache.get(cacheKey);
  if (cachedResult) {
    logger.info(`Geocoding cache hit for: ${locationName}`);
    return cachedResult;
  }

  let result = {
    latitude: null,
    longitude: null,
    formatted_address: locationName,
    geocoding_provider: null,
    confidence: 'unknown'
  };

  // Try Google Maps API first
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        result = {
          latitude: location.lat,
          longitude: location.lng,
          formatted_address: data.results[0].formatted_address,
          geocoding_provider: 'google_maps',
          confidence: 'high'
        };
        
        await cache.set(cacheKey, result, 1440); // Cache for 24 hours
        logger.info(`Google Maps geocoding successful for: ${locationName}`);
        return result;
      }
    } catch (error) {
      logger.warn('Google Maps geocoding failed:', error.message);
    }
  }

  // Try Mapbox API
  if (process.env.MAPBOX_API_KEY) {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json?access_token=${process.env.MAPBOX_API_KEY}&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        result = {
          latitude: feature.center[1],
          longitude: feature.center[0],
          formatted_address: feature.place_name,
          geocoding_provider: 'mapbox',
          confidence: feature.relevance > 0.8 ? 'high' : 'medium'
        };
        
        await cache.set(cacheKey, result, 1440); // Cache for 24 hours
        logger.info(`Mapbox geocoding successful for: ${locationName}`);
        return result;
      }
    } catch (error) {
      logger.warn('Mapbox geocoding failed:', error.message);
    }
  }

  // Try OpenStreetMap Nominatim as fallback
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1&email=disaster-response@example.com`
    );
    const data = await response.json();
    
    if (data.length > 0) {
      const location = data[0];
      result = {
        latitude: parseFloat(location.lat),
        longitude: parseFloat(location.lon),
        formatted_address: location.display_name,
        geocoding_provider: 'openstreetmap',
        confidence: 'medium'
      };
      
      await cache.set(cacheKey, result, 1440); // Cache for 24 hours
      logger.info(`OpenStreetMap geocoding successful for: ${locationName}`);
      return result;
    }
  } catch (error) {
    logger.warn('OpenStreetMap geocoding failed:', error.message);
  }

  // If all geocoding fails, cache the failure to avoid repeated attempts
  await cache.set(cacheKey, result, 60); // Cache for 1 hour
  logger.warn(`All geocoding providers failed for: ${locationName}`);
  
  return result;
}

export default router;