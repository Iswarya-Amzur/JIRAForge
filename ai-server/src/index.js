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
const clusteringPollingService = require('./services/clustering-polling-service');

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

// Manual trigger for clustering - called by organization admins from Forge app
app.post('/api/trigger-clustering', authMiddleware, async (req, res, next) => {
  try {
    const { userId, organizationId } = req.body;

    if (!userId || !organizationId) {
      return res.status(400).json({
        success: false,
        error: 'userId and organizationId are required'
      });
    }

    // Check if clustering is already running
    if (clusteringPollingService.isClusteringRunning()) {
      return res.status(409).json({
        success: false,
        error: 'Clustering is already in progress. Please wait for it to complete.'
      });
    }

    logger.info(`[API] Manual clustering triggered for user ${userId} in org ${organizationId}`);

    // Process the specific user's unassigned work
    await clusteringPollingService.processUserUnassignedWork(userId, organizationId);

    res.json({
      success: true,
      message: 'Clustering completed successfully'
    });
  } catch (error) {
    logger.error('[API] Error in manual clustering:', error);
    next(error);
  }
});

// Trigger clustering for entire organization (admin only)
app.post('/api/trigger-org-clustering', authMiddleware, async (req, res, next) => {
  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'organizationId is required'
      });
    }

    // Check if clustering is already running
    if (clusteringPollingService.isClusteringRunning()) {
      return res.status(409).json({
        success: false,
        error: 'Clustering is already in progress. Please wait for it to complete.'
      });
    }

    logger.info(`[API] Manual organization-wide clustering triggered for org ${organizationId}`);

    // Get all users with unassigned work in this organization
    const supabaseService = require('./services/supabase-service');
    const usersWithUnassigned = await supabaseService.getUsersWithUnassignedWork();
    
    // Filter to only users in this organization
    const orgUsers = usersWithUnassigned.filter(u => u.organization_id === organizationId);

    if (orgUsers.length === 0) {
      return res.json({
        success: true,
        message: 'No users with unassigned work found in this organization',
        usersProcessed: 0
      });
    }

    logger.info(`[API] Found ${orgUsers.length} users with unassigned work in org ${organizationId}`);

    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of orgUsers) {
      try {
        await clusteringPollingService.processUserUnassignedWork(user.id, organizationId);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`[API] Error processing user ${user.id}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Clustering completed. ${successCount} users processed, ${errorCount} errors.`,
      usersProcessed: successCount,
      errors: errorCount
    });
  } catch (error) {
    logger.error('[API] Error in organization clustering:', error);
    next(error);
  }
});

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

// Start server with async initialization
async function startServer() {
  return new Promise((resolve) => {
    app.listen(PORT, async () => {
      logger.info(`AI Analysis Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Initialize AI clients at startup
      logger.info('Initializing AI clients...');
      aiService.initializeClient();

      // Step 1: Start clustering service first (includes startup clustering if needed)
      // This runs any missed clustering before we start processing new screenshots
      logger.info('Initializing clustering service...');
      await clusteringPollingService.start();
      logger.info('Clustering service initialized - daily clustering scheduled');

      // Step 2: Start screenshot analysis polling AFTER clustering is ready
      // This ensures we don't have race conditions between analysis and clustering
      pollingService.start();
      logger.info('Screenshot analysis polling service started - will process pending screenshots automatically');

      resolve();
    });
  });
}

// Initialize server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  pollingService.stop();
  clusteringPollingService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  pollingService.stop();
  clusteringPollingService.stop();
  process.exit(0);
});
