/**
 * Screenshot Service
 * Business logic for screenshot management
 */

import { fetch } from '@forge/api';
import { getSupabaseConfig, getOrCreateUser, getOrCreateOrganization, supabaseRequest, generateSignedUrl } from '../utils/supabase.js';
import { DEFAULT_PAGINATION_LIMIT, DEFAULT_PAGINATION_OFFSET } from '../config/constants.js';
import { isValidUUID, toSafeInteger } from '../utils/validators.js';

/**
 * Fetch screenshots for a user with pagination
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @param {number} limit - Number of screenshots to fetch
 * @param {number} offset - Pagination offset
 * @returns {Promise<Object>} Screenshots data with pagination info
 */
export async function fetchScreenshots(accountId, cloudId, rawLimit = DEFAULT_PAGINATION_LIMIT, rawOffset = DEFAULT_PAGINATION_OFFSET) {
  // Validate pagination parameters
  const limit = toSafeInteger(rawLimit, DEFAULT_PAGINATION_LIMIT, 1, 200);
  const offset = toSafeInteger(rawOffset, DEFAULT_PAGINATION_OFFSET, 0, 100000);

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  // Get or create organization first
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Fetch screenshots with analysis results (to get issue info)
  // Filter by both user_id AND organization_id for multi-tenancy
  // Updated to use screenshots.duration_seconds instead of analysis_results.time_spent_seconds
  const screenshots = await supabaseRequest(
    supabaseConfig,
    `screenshots?user_id=eq.${userId}&organization_id=eq.${organization.id}&deleted_at=is.null&select=*,duration_seconds,analysis_results(active_task_key,active_project_key)&order=timestamp.desc&limit=${limit}&offset=${offset}`
  );

  // Generate signed URLs for private storage images (both thumbnail and full-size)
  const screenshotsWithUrls = await Promise.all(
    (screenshots || []).map(async (screenshot) => {
      const screenshotWithUrl = { ...screenshot };

      // Generate signed URL for thumbnail if it exists
      if (screenshot.thumbnail_url || screenshot.storage_path) {
        try {
          // Always derive thumbnail path from storage_path, not thumbnail_url (which is a full URL)
          let thumbPath;
          if (screenshot.storage_path) {
            // Format: user_id/screenshot_timestamp.png -> user_id/thumb_timestamp.jpg
            if (screenshot.storage_path.includes('/')) {
              const dirPath = screenshot.storage_path.substring(0, screenshot.storage_path.lastIndexOf('/'));
              const filename = screenshot.storage_path.substring(screenshot.storage_path.lastIndexOf('/') + 1);
              const thumbFilename = filename.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
              thumbPath = `${dirPath}/${thumbFilename}`;
            } else {
              thumbPath = screenshot.storage_path.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
            }
          } else {
            // Fallback: extract path from thumbnail_url if storage_path missing
            const urlObj = new URL(screenshot.thumbnail_url);
            // Extract path after '/screenshots/'
            const pathMatch = urlObj.pathname.match(/\/screenshots\/(.+)$/);
            thumbPath = pathMatch ? pathMatch[1] : null;
          }

          if (!thumbPath) {
            throw new Error('Could not determine thumbnail path');
          }

          // Generate signed URL for thumbnail (valid for 1 hour)
          const signedUrl = await generateSignedUrl(supabaseConfig, 'screenshots', thumbPath, 3600);
          screenshotWithUrl.signed_thumbnail_url = signedUrl;
          console.log('[Screenshot Service] Generated signed thumbnail URL for:', thumbPath);
        } catch (err) {
          console.error('[Screenshot Service] Error generating signed thumbnail URL:', err);
          // Fallback to original URL
          screenshotWithUrl.signed_thumbnail_url = screenshot.thumbnail_url;
        }
      }

      // Generate signed URL for full-size screenshot
      if (screenshot.storage_path) {
        try {
          const signedFullUrl = await generateSignedUrl(supabaseConfig, 'screenshots', screenshot.storage_path, 3600);
          screenshotWithUrl.signed_full_url = signedFullUrl;
          console.log('[Screenshot Service] Generated signed full URL for:', screenshot.storage_path);
        } catch (err) {
          console.error('[Screenshot Service] Error generating signed full URL:', err);
        }
      }

      return screenshotWithUrl;
    })
  );

  // Get total count for pagination (include organization filter)
  const countResponse = await fetch(
    `${supabaseConfig.url}/rest/v1/screenshots?user_id=eq.${userId}&organization_id=eq.${organization.id}&deleted_at=is.null&select=id`,
    {
      method: 'HEAD',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Prefer': 'count=exact'
      }
    }
  );

  const totalCount = Number.parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0', 10);

  return {
    screenshots: screenshotsWithUrls || [],
    totalCount,
    limit,
    offset
  };
}

/**
 * Delete a screenshot (soft delete)
 * @param {string} accountId - Atlassian account ID
 * @param {string} cloudId - Jira Cloud ID for organization filtering
 * @param {string} screenshotId - Screenshot ID to delete
 * @returns {Promise<void>}
 */
export async function deleteScreenshot(accountId, cloudId, screenshotId) {
  // Validate screenshotId format
  if (!isValidUUID(screenshotId)) {
    throw new Error('Invalid screenshot ID format');
  }

  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  // Get organization
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  if (!organization) {
    throw new Error('Unable to get organization information');
  }

  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Verify screenshot belongs to user AND organization
  const screenshot = await supabaseRequest(
    supabaseConfig,
    `screenshots?id=eq.${screenshotId}&user_id=eq.${userId}&organization_id=eq.${organization.id}&select=id,storage_path`
  );

  if (!screenshot || screenshot.length === 0) {
    throw new Error('Screenshot not found or access denied');
  }

  // Soft delete: Update deleted_at timestamp
  await supabaseRequest(
    supabaseConfig,
    `screenshots?id=eq.${screenshotId}`,
    {
      method: 'PATCH',
      body: {
        deleted_at: new Date().toISOString(),
        status: 'deleted'
      }
    }
  );

  // Optionally delete from storage (commented out for now to allow recovery)
  // const storagePath = screenshot[0].storage_path;
  // await deleteFromSupabaseStorage(supabaseConfig, 'screenshots', storagePath);
}
