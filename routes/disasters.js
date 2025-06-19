import express from 'express';
import Joi from 'joi';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const disasterSchema = Joi.object({
  title: Joi.string().required().max(200),
  location_name: Joi.string().required().max(200),
  description: Joi.string().required().max(2000),
  tags: Joi.array().items(Joi.string()).default([]),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180)
});

const updateDisasterSchema = Joi.object({
  title: Joi.string().max(200),
  location_name: Joi.string().max(200),
  description: Joi.string().max(2000),
  tags: Joi.array().items(Joi.string()),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180)
});

// GET /disasters - List disasters with optional filtering
router.get('/', async (req, res, next) => {
  try {
    const { tag, owner_id, limit = 50, offset = 0 } = req.query;
    
    let query = supabase
      .from('disasters')
      .select(`
        *,
        reports:reports(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (owner_id) {
      query = query.eq('owner_id', owner_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    logger.info(`Retrieved ${data.length} disasters`);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /disasters/:id - Get specific disaster
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('disasters')
      .select(`
        *,
        reports:reports(*),
        resources:resources(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    logger.info(`Retrieved disaster: ${data.id}`);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /disasters - Create new disaster
router.post('/', async (req, res, next) => {
  try {
    const { error: validationError, value } = disasterSchema.validate(req.body);
    if (validationError) throw validationError;

    const disasterData = {
      ...value,
      owner_id: req.user.id,
      audit_trail: [{
        action: 'create',
        user_id: req.user.id,
        timestamp: new Date().toISOString()
      }]
    };

    // Add location point if coordinates provided
    if (value.latitude && value.longitude) {
      disasterData.location = `POINT(${value.longitude} ${value.latitude})`;
    }

    const { data, error } = await supabase
      .from('disasters')
      .insert(disasterData)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Created disaster: ${data.id} by ${req.user.id}`);
    
    // Emit real-time update
    req.io.emit('disaster_created', data);

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /disasters/:id - Update disaster
router.put('/:id', async (req, res, next) => {
  try {
    const { error: validationError, value } = updateDisasterSchema.validate(req.body);
    if (validationError) throw validationError;

    // Check if disaster exists and user has permission
    const { data: existing, error: fetchError } = await supabase
      .from('disasters')
      .select('owner_id, audit_trail')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;

    if (!existing) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    if (existing.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const updateData = { ...value };

    // Update location point if coordinates provided
    if (value.latitude && value.longitude) {
      updateData.location = `POINT(${value.longitude} ${value.latitude})`;
    }

    // Update audit trail
    const newAuditEntry = {
      action: 'update',
      user_id: req.user.id,
      timestamp: new Date().toISOString(),
      changes: Object.keys(value)
    };
    
    updateData.audit_trail = [...(existing.audit_trail || []), newAuditEntry];

    const { data, error } = await supabase
      .from('disasters')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Updated disaster: ${data.id} by ${req.user.id}`);
    
    // Emit real-time update
    req.io.emit('disaster_updated', data);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /disasters/:id - Delete disaster (admin only)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('disasters')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Disaster not found' });
    }

    logger.info(`Deleted disaster: ${req.params.id} by ${req.user.id}`);
    
    // Emit real-time update
    req.io.emit('disaster_deleted', { id: req.params.id });

    res.json({ message: 'Disaster deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;