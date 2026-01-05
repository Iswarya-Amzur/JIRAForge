/**
 * Supabase Utilities Index
 * Re-exports all Supabase utility functions
 *
 * NOTE: These functions now route through the AI server via Forge Remote
 * for secure credential management. The supabaseConfig parameter is kept
 * for backward compatibility but is ignored - credentials are stored securely on the AI server.
 */

// Export backward-compatible wrapper functions (these accept supabaseConfig but ignore it)
export { getOrCreateOrganization, ensureOrganizationMembership, getUserOrganizationMembership } from './organizations.js';
export { getOrCreateUser } from './users.js';
export { uploadToSupabaseStorage, generateSignedUrl, deleteFromSupabaseStorage } from './storage.js';

// Export config functions (backward-compatible stubs)
export { getSupabaseConfig, supabaseRequest } from './config.js';

// Export direct remote functions for new code that doesn't need backward compatibility
export { supabaseQuery, remoteRequest } from '../remote.js';
