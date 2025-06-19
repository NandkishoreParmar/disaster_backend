import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Mock official sources
const OFFICIAL_SOURCES = [
  {
    name: 'FEMA',
    url: 'https://www.fema.gov/news-release',
    selector: '.news-release-item',
    titleSelector: '.news-release-title',
    contentSelector: '.news-release-summary',
    dateSelector: '.news-release-date'
  },
  {
    name: 'Red Cross',
    url: 'https://www.redcross.org/about-us/news-and-events/news',
    selector: '.news-item',
    titleSelector: '.news-title',
    contentSelector: '.news-summary',
    dateSelector: '.news-date'
  }
];

// Mock official updates data
const MOCK_OFFICIAL_UPDATES = [
  {
    id: '1',
    source: 'FEMA',
    title: 'Federal Emergency Declaration Approved for NYC Flooding',
    content: 'President approves federal emergency declaration for New York City flooding. Federal aid now available for affected residents and businesses.',
    url: 'https://www.fema.gov/news-release/2024/01/15/federal-emergency-declaration-approved-nyc-flooding',
    published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    priority: 'high',
    tags: ['federal-aid', 'declaration', 'flooding']
  },
  {
    id: '2',
    source: 'Red Cross',
    title: 'Emergency Shelters Open Across Manhattan',
    content: 'American Red Cross has opened 15 emergency shelters across Manhattan to provide temporary housing for flood victims. Shelters are equipped with food, water, and medical supplies.',
    url: 'https://www.redcross.org/local/new-york/about-us/news-and-events/news/shelter-locations-manhattan',
    published_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    priority: 'medium',
    tags: ['shelter', 'emergency-housing', 'manhattan']
  },
  {
    id: '3',
    source: 'NYC Emergency Management',
    title: 'Evacuation Orders Lifted for Lower Manhattan',
    content: 'NYC Emergency Management announces evacuation orders have been lifted for Lower Manhattan areas. Residents may return to their homes but should remain cautious of flood damage.',
    url: 'https://www1.nyc.gov/site/em/about/press-releases/evacuation-orders-lifted.page',
    published_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    priority: 'high',
    tags: ['evacuation', 'lower-manhattan', 'all-clear']
  },
  {
    id: '4',
    source: 'National Weather Service',
    title: 'Flood Warning Extended Through Wednesday',
    content: 'The National Weather Service has extended the flood warning for the NYC metropolitan area through Wednesday evening. Additional rainfall expected.',
    url: 'https://www.weather.gov/okx/FloodWarning',
    published_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    priority: 'medium',
    tags: ['flood-warning', 'weather', 'extended']
  }
];

// GET /disasters/:id/official-updates - Get official updates for a disaster
router.get('/:disasterId/official-updates', async (req, res, next) => {
  try {
    const { disasterId } = req.params;
    const { source, priority, limit = 10 } = req.query;
    
    const cacheKey = `official_updates_${disasterId}_${JSON.stringify(req.query)}`;
    
    // Check cache first
    let cachedResult = await cache.get(cacheKey);
    
    if (!cachedResult) {
      // In a real implementation, we would scrape actual websites
      // For now, we'll use mock data with some filtering
      let updates = [...MOCK_OFFICIAL_UPDATES];
      
      // Apply filters
      if (source) {
        updates = updates.filter(update => 
          update.source.toLowerCase().includes(source.toLowerCase())
        );
      }
      
      if (priority) {
        updates = updates.filter(update => update.priority === priority);
      }
      
      // Sort by published date (newest first) and limit
      updates = updates
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
        .slice(0, parseInt(limit));
      
      // Add some real-time updates
      const realtimeUpdate = {
        id: Date.now().toString(),
        source: 'Emergency Alert System',
        title: `Latest Update for Disaster ${disasterId}`,
        content: 'Situation is being monitored continuously. Please follow official channels for the most current information.',
        url: '#',
        published_at: new Date().toISOString(),
        priority: 'medium',
        tags: ['real-time', 'monitoring']
      };
      
      updates.unshift(realtimeUpdate);
      
      const result = {
        disaster_id: disasterId,
        total_updates: updates.length,
        last_updated: new Date().toISOString(),
        updates: updates,
        sources: {
          fema: updates.filter(u => u.source === 'FEMA').length,
          red_cross: updates.filter(u => u.source === 'Red Cross').length,
          nyc_em: updates.filter(u => u.source === 'NYC Emergency Management').length,
          nws: updates.filter(u => u.source === 'National Weather Service').length,
          real_time: updates.filter(u => u.source === 'Emergency Alert System').length
        }
      };
      
      // Cache for 15 minutes
      await cache.set(cacheKey, result, 15);
      cachedResult = result;
      
      logger.info(`Fetched ${updates.length} official updates for disaster ${disasterId}`);
    }
    
    // Emit real-time update
    req.io.to(`disaster_${disasterId}`).emit('official_updates_updated', cachedResult);
    
    res.json(cachedResult);
  } catch (error) {
    next(error);
  }
});

// GET /scrape-official-updates - Scrape real official updates (demo endpoint)
router.get('/scrape-official-updates', async (req, res, next) => {
  try {
    const { source = 'fema' } = req.query;
    
    // This is a simplified scraper example
    // In production, you'd want more robust error handling and rate limiting
    const updates = [];
    
    try {
      // Example: Scrape FEMA news (this is just a demo - actual scraping would need proper selectors)
      if (source === 'fema') {
        const response = await fetch('https://www.fema.gov/news-release', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // This is a simplified example - real scraping would need proper selectors
          $('.view-content .views-row').slice(0, 5).each((i, element) => {
            const title = $(element).find('h3 a').text().trim();
            const link = $(element).find('h3 a').attr('href');
            const date = $(element).find('.date-display-single').text().trim();
            
            if (title) {
              updates.push({
                id: `fema_${i}`,
                source: 'FEMA',
                title,
                content: 'Content would be extracted from the full article',
                url: link ? `https://www.fema.gov${link}` : '#',
                published_at: date || new Date().toISOString(),
                priority: 'medium',
                tags: ['fema', 'official']
              });
            }
          });
        }
      }
    } catch (scrapeError) {
      logger.warn('Scraping failed, using mock data:', scrapeError.message);
    }
    
    // If scraping failed or no updates found, use mock data
    if (updates.length === 0) {
      updates.push({
        id: 'mock_update',
        source: 'Demo Source',
        title: 'Scraping Demo - Mock Update',
        content: 'This is a mock update since web scraping requires specific selectors for each site.',
        url: '#',
        published_at: new Date().toISOString(),
        priority: 'low',
        tags: ['demo', 'mock']
      });
    }
    
    logger.info(`Scraped ${updates.length} official updates`);
    res.json({
      source,
      updates,
      scraped_at: new Date().toISOString(),
      note: 'This is a demo scraper. Real implementation would require site-specific selectors.'
    });
  } catch (error) {
    next(error);
  }
});

export default router;