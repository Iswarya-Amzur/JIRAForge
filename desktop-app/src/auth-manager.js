const axios = require('axios');
const { shell } = require('electron');

class AuthManager {
  constructor(store) {
    this.store = store;
    this.clientId = process.env.ATLASSIAN_CLIENT_ID || '';
    this.clientSecret = process.env.ATLASSIAN_CLIENT_SECRET || '';
    this.redirectUri = 'brd-time-tracker://oauth/callback';
    this.authorizationUrl = 'https://auth.atlassian.com/authorize';
    this.tokenUrl = 'https://auth.atlassian.com/oauth/token';
    this.supabaseAuthUrl = process.env.SUPABASE_AUTH_URL || '';
  }

  /**
   * Start the OAuth 3LO flow with Atlassian
   * Opens browser for user to authorize
   */
  async startOAuth() {
    // Validate Client ID is set
    if (!this.clientId || this.clientId.trim() === '') {
      throw new Error('Atlassian Client ID is not configured. Please check your .env file.');
    }

    if (!this.clientSecret || this.clientSecret.trim() === '') {
      throw new Error('Atlassian Client Secret is not configured. Please check your .env file.');
    }

    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    this.store.set('oauth_state', state);

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.clientId.trim(), // Ensure no whitespace
      scope: 'read:me read:jira-work write:jira-work offline_access',
      redirect_uri: this.redirectUri,
      state: state,
      response_type: 'code',
      prompt: 'consent'
    });

    const authUrl = `${this.authorizationUrl}?${params.toString()}`;
    console.log('OAuth URL generated:', authUrl.replace(this.clientId, 'CLIENT_ID_HIDDEN'));
    
    return authUrl;
  }

  /**
   * Handle the OAuth redirect from Atlassian
   * @param {string} url - The redirect URL containing the authorization code
   */
  async handleOAuthRedirect(url) {
    try {
      const urlParams = new URL(url);
      const code = urlParams.searchParams.get('code');
      const state = urlParams.searchParams.get('state');
      const error = urlParams.searchParams.get('error');

      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      // Verify state to prevent CSRF attacks
      const storedState = this.store.get('oauth_state');
      if (state !== storedState) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Exchange authorization code for access token
      const tokens = await this.exchangeCodeForToken(code);

      // Save Atlassian tokens
      this.store.set('atlassianAccessToken', tokens.access_token);
      this.store.set('atlassianRefreshToken', tokens.refresh_token);

      // Get user info from Atlassian
      const userInfo = await this.getAtlassianUserInfo(tokens.access_token);

      // Authenticate with Supabase using Atlassian account
      await this.authenticateWithSupabase(userInfo, tokens);

      console.log('Authentication successful!');
      return { success: true, user: userInfo };
    } catch (error) {
      console.error('Error handling OAuth redirect:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    try {
      // Validate credentials
      if (!this.clientId || !this.clientSecret) {
        throw new Error('OAuth credentials not configured. Please check your .env file.');
      }

      const response = await axios.post(
        this.tokenUrl,
        {
          grant_type: 'authorization_code',
          client_id: this.clientId.trim(),
          client_secret: this.clientSecret.trim(),
          code: code,
          redirect_uri: this.redirectUri
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token received from Atlassian');
      }

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error_description || 
                          error.response?.data?.error || 
                          error.message;
      console.error('Error exchanging code for token:', {
        status: error.response?.status,
        error: errorMessage,
        clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'NOT SET'
      });
      throw new Error(`Failed to get access token: ${errorMessage}`);
    }
  }

  /**
   * Get user information from Atlassian
   */
  async getAtlassianUserInfo(accessToken) {
    try {
      const response = await axios.get('https://api.atlassian.com/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error getting user info:', error.response?.data || error.message);
      throw new Error('Failed to get user information from Atlassian');
    }
  }

  /**
   * Authenticate with Supabase using Atlassian credentials
   * This creates or links the user account in Supabase
   */
  async authenticateWithSupabase(atlassianUser, atlassianTokens) {
    try {
      // Call your backend/Edge Function to create/link Supabase user
      // This endpoint should:
      // 1. Create user in Supabase if doesn't exist
      // 2. Link Atlassian account ID to Supabase user
      // 3. Return Supabase JWT token

      const response = await axios.post(
        `${this.supabaseAuthUrl}/auth/atlassian`,
        {
          atlassian_account_id: atlassianUser.account_id,
          email: atlassianUser.email,
          name: atlassianUser.name,
          access_token: atlassianTokens.access_token
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Save Supabase JWT
      this.store.set('supabaseJWT', response.data.jwt);
      this.store.set('supabaseRefreshToken', response.data.refresh_token);

      return response.data;
    } catch (error) {
      console.error('Error authenticating with Supabase:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Supabase');
    }
  }

  /**
   * Refresh Atlassian access token using refresh token
   */
  async refreshAtlassianToken() {
    try {
      const refreshToken = this.store.get('atlassianRefreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(
        this.tokenUrl,
        {
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Save new tokens
      this.store.set('atlassianAccessToken', response.data.access_token);
      if (response.data.refresh_token) {
        this.store.set('atlassianRefreshToken', response.data.refresh_token);
      }

      return response.data;
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!(this.store.get('atlassianAccessToken') && this.store.get('supabaseJWT'));
  }

  /**
   * Logout user
   */
  logout() {
    this.store.delete('atlassianAccessToken');
    this.store.delete('atlassianRefreshToken');
    this.store.delete('supabaseJWT');
    this.store.delete('supabaseRefreshToken');
  }
}

module.exports = AuthManager;
