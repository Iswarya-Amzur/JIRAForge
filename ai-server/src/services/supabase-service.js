/**
 * Supabase Service - Re-export Module
 *
 * This file provides backward compatibility by re-exporting all functions
 * from the refactored db/ directory modules.
 *
 * Refactored structure:
 * - db/supabase-client.js - Supabase client initialization
 * - db/storage-service.js - File storage operations
 * - db/screenshot-db-service.js - Screenshot database operations
 * - db/analysis-db-service.js - Analysis results operations
 * - db/user-db-service.js - User-related operations
 * - db/document-db-service.js - Document operations
 * - db/clustering-db-service.js - Clustering operations
 *
 * Usage: You can import from this file or directly from db/ modules
 * - const { downloadFile } = require('./supabase-service');
 * - const { downloadFile } = require('./db');
 * - const { downloadFile } = require('./db/storage-service');
 */

// Re-export everything from the db/ module
module.exports = require('./db');
