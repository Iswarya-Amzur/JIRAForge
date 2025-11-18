const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies that requests include a valid API key
 */
module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header missing'
      });
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format. Use: Bearer <token>'
      });
    }

    // Verify API key
    const validApiKey = process.env.AI_SERVER_API_KEY;

    if (!validApiKey) {
      logger.error('AI_SERVER_API_KEY not configured in environment');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    if (token !== validApiKey) {
      logger.warn('Invalid API key attempt', {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Authentication successful
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};
