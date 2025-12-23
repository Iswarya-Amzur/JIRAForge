/**
 * Supabase Utility Functions
 * Re-exports all Supabase-related operations from submodules
 *
 * Submodules:
 * - config: Configuration and core request functions
 * - organizations: Organization CRUD and membership
 * - users: User CRUD and management
 * - storage: File upload, download, and signed URLs
 */

export { getSupabaseConfig, supabaseRequest } from './supabase/config.js';
export { getOrCreateOrganization, getUserOrganizationMembership } from './supabase/organizations.js';
export { getOrCreateUser } from './supabase/users.js';
export { uploadToSupabaseStorage, generateSignedUrl, deleteFromSupabaseStorage } from './supabase/storage.js';
