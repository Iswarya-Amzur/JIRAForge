/**
 * Forge Invocation Token (FIT) Authentication Middleware
 * Validates requests from Atlassian Forge apps using JWT verification
 */

const logger = require('../utils/logger');

// Atlassian's JWKS endpoint for FIT token verification
const JWKS_URL = 'https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json';

// Your Forge App ID (from manifest.yml)
const FORGE_APP_ID = process.env.FORGE_APP_ID || 'ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a';

// Cache the JWKS and jose module
let cachedJWKS = null;
let joseModule = null;

/**
 * Load jose module (ES Module) dynamically
 */
async function getJose() {
  if (!joseModule) {
    joseModule = await import('jose');
  }
  return joseModule;
}

/**
 * Get the JWKS (JSON Web Key Set) from Atlassian
 * @returns {Promise<jose.JWKS>}
 */
async function getJWKS() {
  const jose = await getJose();
  if (!cachedJWKS) {
    cachedJWKS = jose.createRemoteJWKSet(new URL(JWKS_URL));
  }
  return cachedJWKS;
}

/**
 * Validate Forge Invocation Token (FIT)
 * @param {string} token - The JWT token from Authorization header
 * @returns {Promise<Object>} - Validated payload with context
 */
async function validateFIT(token) {
  try {
    const jose = await getJose();
    const JWKS = await getJWKS();

    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: 'forge/invocation-token',
      audience: FORGE_APP_ID
    });

    return payload;
  } catch (error) {
    logger.error('[FIT] Token validation failed:', error.message);
    throw error;
  }
}

/**
 * Express middleware for Forge authentication
 * Validates FIT token and extracts context (cloudId, accountId)
 */
const forgeAuthMiddleware = async (req, res, next) => {
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

    // Validate the FIT token
    const payload = await validateFIT(token);

    // Log minimal token info (full payload only in debug mode to avoid CPU overhead)
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('[FIT] Full token payload:', { 
        app: payload.app?.id,
        principal: typeof payload.principal === 'string' ? payload.principal : payload.principal?.accountId,
        cloudId: payload.context?.cloudId
      });
    }

    // Extract context from validated token
    // accountId can be in different places depending on invocation type
    // Note: principal can be either a string (e.g., "712020:uuid") or an object with accountId
    const extractAccountId = () => {
      if (payload.context?.accountId) return payload.context.accountId;
      if (payload.sub) return payload.sub;
      if (typeof payload.principal === 'string') return payload.principal;
      if (payload.principal?.accountId) return payload.principal.accountId;
      return null;
    };

    const context = {
      cloudId: payload.context?.cloudId || payload.iss?.split('/')[2],
      accountId: extractAccountId(),
      appId: payload.app?.id,
      installationId: payload.app?.installationId,
      environment: payload.app?.environment?.type
    };

    logger.info('[FIT] Extracted context:', context);

    if (!context.cloudId) {
      logger.warn('[FIT] Token missing cloudId', { payload });
      return res.status(400).json({
        success: false,
        error: 'Token missing required context (cloudId)'
      });
    }

    // Attach context to request for downstream use
    req.forgeContext = context;

    logger.info('[FIT] Request authenticated', {
      cloudId: context.cloudId,
      accountId: context.accountId,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('[FIT] Authentication failed:', error);

    // Check for specific JWT errors
    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token signature'
      });
    }

    if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      return res.status(401).json({
        success: false,
        error: 'Token validation failed: ' + error.message
      });
    }

    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = forgeAuthMiddleware;
module.exports.validateFIT = validateFIT;
