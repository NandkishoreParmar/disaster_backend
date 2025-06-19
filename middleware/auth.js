import { logger } from '../utils/logger.js';

// Mock users for demonstration
const MOCK_USERS = {
  'netrunnerX': { id: 'netrunnerX', role: 'admin', name: 'NetRunner X' },
  'reliefAdmin': { id: 'reliefAdmin', role: 'admin', name: 'Relief Admin' },
  'contributor1': { id: 'contributor1', role: 'contributor', name: 'Contributor 1' },
  'citizen1': { id: 'citizen1', role: 'contributor', name: 'Citizen Reporter' }
};

export const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'] || 'netrunnerX'; // Default to netrunnerX for demo
  
  if (!MOCK_USERS[userId]) {
    logger.warn(`Authentication failed for user: ${userId}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = MOCK_USERS[userId];
  logger.info(`Authenticated user: ${userId} (${req.user.role})`);
  next();
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    logger.warn(`Admin access denied for user: ${req.user.id}`);
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};