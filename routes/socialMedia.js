import express from 'express';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Mock social media data
const MOCK_SOCIAL_MEDIA_DATA = [
  {
    id: '1',
    platform: 'twitter',
    user: 'citizen1',
    content: '#floodrelief Need food and water in Lower East Side Manhattan. Families stranded on 3rd floor. #NYC #emergency',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    location: 'Lower East Side, NYC',
    urgency: 'high',
    keywords: ['floodrelief', 'emergency', 'stranded'],
    verified: false
  },
  {
    id: '2',
    platform: 'twitter',
    user: 'reliefworker',
    content: 'Red Cross shelter open at Brooklyn Community Center. Capacity for 200 people. #disasterrelief #shelter',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    location: 'Brooklyn, NYC',
    urgency: 'medium',
    keywords: ['disasterrelief', 'shelter'],
    verified: true
  },
  {
    id: '3',
    platform: 'bluesky',
    user: 'nyc_emergency',
    content: 'URGENT: Evacuation notice for residents near FDR Drive. Rising water levels. Move to higher ground immediately.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    location: 'FDR Drive, NYC',
    urgency: 'critical',
    keywords: ['evacuation', 'urgent', 'flooding'],
    verified: true
  },
  {
    id: '4',
    platform: 'twitter',
    user: 'volunteer_help',
    content: 'Medical supplies available at St. Vincent Hospital. Contact @medical_relief for coordination. #medicalaid',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    location: 'Manhattan, NYC',
    urgency: 'medium',
    keywords: ['medical', 'supplies'],
    verified: false
  }
];

// GET /disasters/:id/social-media - Get social media reports for a disaster
router.get('/:disasterId/social-media', async (req, res, next) => {
  try {
    const { disasterId } = req.params;
    const { keywords, platform, urgency, limit = 20 } = req.query;
    
    const cacheKey = `social_media_${disasterId}_${JSON.stringify(req.query)}`;
    
    // Check cache first
    let cachedResult = await cache.get(cacheKey);
    
    if (!cachedResult) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let filteredData = [...MOCK_SOCIAL_MEDIA_DATA];
      
      // Apply filters
      if (keywords) {
        const keywordArray = keywords.split(',').map(k => k.trim().toLowerCase());
        filteredData = filteredData.filter(post => 
          keywordArray.some(keyword => 
            post.content.toLowerCase().includes(keyword) ||
            post.keywords.some(k => k.toLowerCase().includes(keyword))
          )
        );
      }
      
      if (platform) {
        filteredData = filteredData.filter(post => post.platform === platform);
      }
      
      if (urgency) {
        filteredData = filteredData.filter(post => post.urgency === urgency);
      }
      
      // Sort by timestamp (newest first) and limit
      filteredData = filteredData
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, parseInt(limit));
      
      const result = {
        disaster_id: disasterId,
        total_posts: filteredData.length,
        last_updated: new Date().toISOString(),
        posts: filteredData,
        sources: {
          twitter: filteredData.filter(p => p.platform === 'twitter').length,
          bluesky: filteredData.filter(p => p.platform === 'bluesky').length
        }
      };
      
      // Cache for 5 minutes
      await cache.set(cacheKey, result, 5);
      cachedResult = result;
      
      logger.info(`Fetched ${filteredData.length} social media posts for disaster ${disasterId}`);
    }
    
    // Emit real-time update
    req.io.to(`disaster_${disasterId}`).emit('social_media_updated', cachedResult);
    
    res.json(cachedResult);
  } catch (error) {
    next(error);
  }
});

// GET /mock-social-media - Mock endpoint for testing
router.get('/mock-social-media', async (req, res, next) => {
  try {
    const { keywords, platform, urgency, limit = 10 } = req.query;
    
    // Generate some real-time mock data
    const newMockData = [
      {
        id: Date.now().toString(),
        platform: 'twitter',
        user: 'emergency_alert',
        content: `BREAKING: ${keywords || 'disaster'} situation developing. First responders on scene. #breaking #emergency`,
        timestamp: new Date().toISOString(),
        location: 'Current Location',
        urgency: urgency || 'high',
        keywords: [keywords || 'disaster', 'emergency'],
        verified: false
      },
      ...MOCK_SOCIAL_MEDIA_DATA
    ];
    
    let filteredData = newMockData;
    
    if (platform) {
      filteredData = filteredData.filter(post => post.platform === platform);
    }
    
    if (urgency) {
      filteredData = filteredData.filter(post => post.urgency === urgency);
    }
    
    filteredData = filteredData.slice(0, parseInt(limit));
    
    logger.info(`Generated ${filteredData.length} mock social media posts`);
    res.json({
      posts: filteredData,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;