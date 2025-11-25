const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const screenshotController = require('./controllers/screenshot-controller');
const brdController = require('./controllers/brd-controller');
const authMiddleware = require('./middleware/auth');
const logger = require('./utils/logger');
const pollingService = require('./services/polling-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for ngrok tunnel
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Use a simple key generator that works with proxies
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  }
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.post('/api/analyze-screenshot', authMiddleware, screenshotController.analyzeScreenshot);
app.post('/api/process-brd', authMiddleware, brdController.processBRD);
app.post('/api/cluster-unassigned-work', async (req, res, next) => {
  try {
    const { sessions, userIssues } = req.body;

    if (!sessions || !Array.isArray(sessions)) {
      return res.status(400).json({
        success: false,
        error: 'Sessions array required'
      });
    }

    const clusteringService = require('./services/clustering-service');
    const result = await clusteringService.clusterUnassignedWork(sessions, userIssues || []);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`AI Analysis Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start polling service to process pending screenshots
  pollingService.start();
  logger.info('Polling service started - will process pending screenshots automatically');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  pollingService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  pollingService.stop();
  process.exit(0);
});
