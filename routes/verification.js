import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /disasters/:id/verify-image - Verify image authenticity
router.post('/:disasterId/verify-image', async (req, res, next) => {
  try {
    const { disasterId } = req.params;
    const { image_url, report_id } = req.body;
    
    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }
    
    const cacheKey = `image_verify_${Buffer.from(image_url).toString('base64')}`;
    
    // Check cache first
    let cachedResult = await cache.get(cacheKey);
    
    if (!cachedResult) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
        
        // Fetch the image
        const imageResponse = await fetch(image_url);
        if (!imageResponse.ok) {
          throw new Error('Failed to fetch image');
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        
        const prompt = `Analyze this image for signs of disaster or emergency situation. Please provide:

1. AUTHENTICITY: Does this image appear to be authentic or potentially manipulated? Look for signs of digital manipulation, inconsistent lighting, or other artifacts.

2. DISASTER CONTEXT: What type of disaster or emergency situation is shown? (flood, fire, earthquake, storm, etc.)

3. URGENCY LEVEL: Based on what you see, how urgent does this situation appear? (low, medium, high, critical)

4. DETAILS: Describe what you observe in the image that indicates a disaster situation.

5. VERIFICATION CONFIDENCE: How confident are you in your assessment? (low, medium, high)

Please format your response as a structured analysis.`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: imageResponse.headers.get('content-type') || 'image/jpeg'
            }
          }
        ]);
        
        const response = await result.response;
        const analysisText = response.text();
        
        // Parse the analysis (simplified - in production you'd want more robust parsing)
        let authenticity = 'unknown';
        let urgency = 'medium';
        let confidence = 'medium';
        let disasterType = 'unknown';
        
        const lowerAnalysis = analysisText.toLowerCase();
        
        // Extract authenticity
        if (lowerAnalysis.includes('authentic') && !lowerAnalysis.includes('not authentic')) {
          authenticity = 'authentic';
        } else if (lowerAnalysis.includes('manipulated') || lowerAnalysis.includes('fake')) {
          authenticity = 'suspicious';
        }
        
        // Extract urgency
        if (lowerAnalysis.includes('critical')) urgency = 'critical';
        else if (lowerAnalysis.includes('high')) urgency = 'high';
        else if (lowerAnalysis.includes('low')) urgency = 'low';
        
        // Extract confidence
        if (lowerAnalysis.includes('high confidence')) confidence = 'high';
        else if (lowerAnalysis.includes('low confidence')) confidence = 'low';
        
        // Extract disaster type
        if (lowerAnalysis.includes('flood')) disasterType = 'flood';
        else if (lowerAnalysis.includes('fire')) disasterType = 'fire';
        else if (lowerAnalysis.includes('earthquake')) disasterType = 'earthquake';
        else if (lowerAnalysis.includes('storm')) disasterType = 'storm';
        
        cachedResult = {
          image_url,
          disaster_id: disasterId,
          report_id,
          verification_status: authenticity,
          disaster_type: disasterType,
          urgency_level: urgency,
          confidence_level: confidence,
          analysis: analysisText,
          verified_at: new Date().toISOString(),
          verified_by: 'gemini-ai'
        };
        
        // Cache for 1 hour
        await cache.set(cacheKey, cachedResult, 60);
        
        logger.info(`Image verification completed for ${image_url}`);
      } catch (error) {
        logger.error('Gemini image verification error:', error);
        
        // Fallback verification result
        cachedResult = {
          image_url,
          disaster_id: disasterId,
          report_id,
          verification_status: 'error',
          disaster_type: 'unknown',
          urgency_level: 'medium',
          confidence_level: 'low',
          analysis: 'Image verification failed due to technical error. Manual review recommended.',
          verified_at: new Date().toISOString(),
          verified_by: 'system-error',
          error: error.message
        };
        
        // Cache error result for shorter time
        await cache.set(cacheKey, cachedResult, 5);
      }
    }
    
    // Update report verification status if report_id provided
    if (report_id) {
      try {
        const { error: updateError } = await supabase
          .from('reports')
          .update({ 
            verification_status: cachedResult.verification_status,
            verification_details: cachedResult
          })
          .eq('id', report_id);
        
        if (updateError) {
          logger.warn(`Failed to update report ${report_id} verification:`, updateError);
        }
      } catch (updateError) {
        logger.warn('Report update error:', updateError);
      }
    }
    
    // Emit real-time update
    req.io.to(`disaster_${disasterId}`).emit('image_verified', cachedResult);
    
    res.json(cachedResult);
  } catch (error) {
    next(error);
  }
});

// GET /disasters/:id/verification-stats - Get verification statistics
router.get('/:disasterId/verification-stats', async (req, res, next) => {
  try {
    const { disasterId } = req.params;
    
    // This would query the reports table for verification stats
    // For now, we'll return mock statistics
    const stats = {
      disaster_id: disasterId,
      total_images: 45,
      verified_authentic: 32,
      flagged_suspicious: 8,
      pending_verification: 5,
      verification_rate: 0.89,
      last_updated: new Date().toISOString(),
      breakdown: {
        authentic: 32,
        suspicious: 8,
        error: 0,
        pending: 5
      },
      urgency_breakdown: {
        critical: 5,
        high: 12,
        medium: 20,
        low: 8
      }
    };
    
    logger.info(`Retrieved verification stats for disaster ${disasterId}`);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;