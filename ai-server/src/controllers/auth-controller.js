/**
 * Auth Controller
 * Handles secure token exchange for desktop app
 *
 * Endpoints:
 * - POST /api/auth/atlassian/callback - Exchange OAuth code for tokens
 * - POST /api/auth/exchange-token - Mint Supabase JWT from Atlassian token
 * - POST /api/auth/refresh-token - Refresh Atlassian access token
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Atlassian OAuth configuration
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_ME_URL = 'https://api.atlassian.com/me';

/**
 * Exchange Atlassian OAuth code for tokens (with PKCE support)
 * This endpoint replaces the desktop app's direct call to Atlassian
 *
 * POST /api/auth/atlassian/callback
 * Body: { code: string, redirect_uri: string, code_verifier?: string }
 *
 * PKCE (RFC 7636): If code_verifier is provided, it will be included in the
 * token exchange request to Atlassian for enhanced security.
 */
exports.atlassianCallback = async (req, res) => {
  try {
    const { code, redirect_uri, code_verifier } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    if (!redirect_uri) {
      return res.status(400).json({
        success: false,
        error: 'Redirect URI is required'
      });
    }

    // Get secrets from environment (these are now ONLY on the server)
    const clientId = process.env.ATLASSIAN_CLIENT_ID;
    const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('[Auth] Atlassian credentials not configured on server');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error - Atlassian credentials not configured'
      });
    }

    // Build token request payload
    const tokenRequestPayload = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirect_uri
    };

    // PKCE: Include code_verifier if provided (required for PKCE flow)
    if (code_verifier) {
      tokenRequestPayload.code_verifier = code_verifier;
      logger.info('[Auth] Exchanging OAuth code for tokens (with PKCE)');
    } else {
      logger.info('[Auth] Exchanging OAuth code for tokens (without PKCE - legacy flow)');
    }

    const tokenResponse = await axios.post(
      ATLASSIAN_TOKEN_URL,
      tokenRequestPayload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const tokens = tokenResponse.data;

    logger.info('[Auth] Successfully exchanged code for tokens');

    // Return tokens to desktop app
    res.json({
      success: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type
    });

  } catch (error) {
    logger.error('[Auth] Atlassian callback error:', error.response?.data || error.message);

    const errorMessage = error.response?.data?.error_description ||
                         error.response?.data?.error ||
                         error.message;

    res.status(error.response?.status || 500).json({
      success: false,
      error: `Token exchange failed: ${errorMessage}`
    });
  }
};

/**
 * Refresh Atlassian access token using refresh token
 *
 * POST /api/auth/refresh-token
 * Body: { refresh_token: string }
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    // Get secrets from environment
    const clientId = process.env.ATLASSIAN_CLIENT_ID;
    const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('[Auth] Atlassian credentials not configured on server');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Refresh the token with Atlassian
    logger.info('[Auth] Refreshing Atlassian access token');

    const tokenResponse = await axios.post(
      ATLASSIAN_TOKEN_URL,
      {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refresh_token
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const tokens = tokenResponse.data;

    logger.info('[Auth] Successfully refreshed access token');

    res.json({
      success: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refresh_token, // Atlassian may or may not return new refresh token
      expires_in: tokens.expires_in,
      token_type: tokens.token_type
    });

  } catch (error) {
    logger.error('[Auth] Token refresh error:', error.response?.data || error.message);

    const errorMessage = error.response?.data?.error_description ||
                         error.response?.data?.error ||
                         error.message;

    // Check if refresh token is expired/invalid
    if (error.response?.status === 400 || error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token expired or invalid. User must re-authenticate.',
        requiresReauth: true
      });
    }

    res.status(error.response?.status || 500).json({
      success: false,
      error: `Token refresh failed: ${errorMessage}`
    });
  }
};

/**
 * Exchange Atlassian token for Supabase JWT
 * This allows desktop app to access Supabase with user-scoped permissions
 *
 * POST /api/auth/exchange-token
 * Body: { atlassian_token: string }
 */
exports.exchangeToken = async (req, res) => {
  try {
    const { atlassian_token } = req.body;

    if (!atlassian_token) {
      return res.status(400).json({
        success: false,
        error: 'Atlassian token is required'
      });
    }

    // Get Supabase JWT secret from environment
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL;

    if (!supabaseJwtSecret) {
      logger.error('[Auth] SUPABASE_JWT_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error - JWT secret not configured'
      });
    }

    // Verify the Atlassian token by fetching user info
    logger.info('[Auth] Verifying Atlassian token');

    let atlassianUser;
    try {
      const userResponse = await axios.get(ATLASSIAN_ME_URL, {
        headers: {
          'Authorization': `Bearer ${atlassian_token}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      atlassianUser = userResponse.data;
    } catch (error) {
      logger.warn('[Auth] Invalid Atlassian token:', error.response?.status);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Atlassian token'
      });
    }

    // Extract user identifier from Atlassian
    const atlassianAccountId = atlassianUser.account_id;
    const email = atlassianUser.email;

    if (!atlassianAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Could not retrieve Atlassian account ID'
      });
    }

    logger.info('[Auth] Atlassian user verified: %s', atlassianAccountId);

    // Extract Supabase reference from URL (e.g., jvijitdewbypqbatfboi from https://jvijitdewbypqbatfboi.supabase.co)
    const supabaseRef = supabaseUrl ? supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] : null;

    // Mint a custom Supabase JWT for this user
    // This JWT will be used for RLS (Row Level Security) in Supabase
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600; // 1 hour

    const payload = {
      // Standard JWT claims
      iss: 'supabase',
      ref: supabaseRef || 'jvijitdewbypqbatfboi',
      role: 'authenticated',
      iat: now,
      exp: now + expiresIn,

      // Supabase auth claims
      aud: 'authenticated',
      sub: atlassianAccountId, // Use Atlassian account ID as subject

      // Custom claims for RLS policies
      atlassian_account_id: atlassianAccountId,
      email: email,

      // App metadata
      app_metadata: {
        provider: 'atlassian',
        providers: ['atlassian']
      },

      // User metadata
      user_metadata: {
        atlassian_account_id: atlassianAccountId,
        email: email,
        name: atlassianUser.name || atlassianUser.display_name
      }
    };

    // Sign the JWT
    const supabaseToken = jwt.sign(payload, supabaseJwtSecret, {
      algorithm: 'HS256'
    });

    logger.info('[Auth] Minted Supabase JWT for user: %s (expires in %ds)', atlassianAccountId, expiresIn);

    res.json({
      success: true,
      supabase_token: supabaseToken,
      expires_in: expiresIn,
      user: {
        atlassian_account_id: atlassianAccountId,
        email: email
      }
    });

  } catch (error) {
    logger.error('[Auth] Token exchange error:', error);
    res.status(500).json({
      success: false,
      error: `Token exchange failed: ${error.message}`
    });
  }
};

/**
 * Get Supabase configuration for authenticated users
 * Desktop app calls this after Atlassian login to get Supabase credentials
 *
 * POST /api/auth/supabase-config
 * Body: { atlassian_token: string }
 */
exports.getSupabaseConfig = async (req, res) => {
  try {
    const { atlassian_token } = req.body;

    if (!atlassian_token) {
      return res.status(400).json({
        success: false,
        error: 'Atlassian token is required'
      });
    }

    // Verify the Atlassian token first
    try {
      await axios.get(ATLASSIAN_ME_URL, {
        headers: {
          'Authorization': `Bearer ${atlassian_token}`,
          'Accept': 'application/json'
        },
        timeout: 10000
      });
    } catch (error) {
      logger.warn('[Auth] Invalid Atlassian token for Supabase config:', error.response?.status);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired Atlassian token'
      });
    }

    // Get Supabase credentials from environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      logger.error('[Auth] Supabase credentials not configured on server');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error - Supabase credentials not configured'
      });
    }

    logger.info('[Auth] Providing Supabase config to authenticated user');

    res.json({
      success: true,
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
      supabase_service_role_key: supabaseServiceRoleKey
    });

  } catch (error) {
    logger.error('[Auth] Supabase config error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to get Supabase config: ${error.message}`
    });
  }
};

/**
 * Verify Atlassian token and return user info
 * Utility endpoint for desktop app to validate tokens
 *
 * POST /api/auth/verify
 * Body: { atlassian_token: string }
 */
exports.verifyToken = async (req, res) => {
  try {
    const { atlassian_token } = req.body;

    if (!atlassian_token) {
      return res.status(400).json({
        success: false,
        error: 'Atlassian token is required'
      });
    }

    // Verify by fetching user info
    const userResponse = await axios.get(ATLASSIAN_ME_URL, {
      headers: {
        'Authorization': `Bearer ${atlassian_token}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    res.json({
      success: true,
      valid: true,
      user: {
        account_id: userResponse.data.account_id,
        email: userResponse.data.email,
        name: userResponse.data.name || userResponse.data.display_name
      }
    });

  } catch (error) {
    if (error.response?.status === 401) {
      return res.json({
        success: true,
        valid: false,
        error: 'Token expired or invalid'
      });
    }

    res.status(500).json({
      success: false,
      error: `Verification failed: ${error.message}`
    });
  }
};
