import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

// Route imports
import disasterRoutes from './routes/disasters.js';
import socialMediaRoutes from './routes/socialMedia.js';
import resourceRoutes from './routes/resources.js';
import updatesRoutes from './routes/updates.js';
import verificationRoutes from './routes/verification.js';
import geocodingRoutes from './routes/geocoding.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Make io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/disasters', authMiddleware, disasterRoutes);
app.use('/api/social-media', authMiddleware, socialMediaRoutes);
app.use('/api/resources', authMiddleware, resourceRoutes);
app.use('/api/updates', authMiddleware, updatesRoutes);
app.use('/api/verification', authMiddleware, verificationRoutes);
app.use('/api/geocoding', authMiddleware, geocodingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join_disaster', (disasterId) => {
    socket.join(`disaster_${disasterId}`);
    logger.info(`Client ${socket.id} joined disaster room: ${disasterId}`);
  });
  
  socket.on('leave_disaster', (disasterId) => {
    socket.leave(`disaster_${disasterId}`);
    logger.info(`Client ${socket.id} left disaster room: ${disasterId}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export { io };