/**
 * Screenshot Service
 * Business logic for screenshot management
 */

import { fetch } from '@forge/api';
import { getSupabaseConfig, getOrCreateUser, supabaseRequest, generateSignedUrl } from '../utils/supabase.js';
import { DEFAULT_PAGINATION_LIMIT, DEFAULT_PAGINATION_OFFSET } from '../config/constants.js';

/**
 * Fetch screenshots for a user with pagination
 * @param {string} accountId - Atlassian account ID
 * @param {number} limit - Number of screenshots to fetch
 * @param {number} offset - Pagination offset
 * @returns {Promise<Object>} Screenshots data with pagination info
 */
export async function fetchScreenshots(accountId, limit = DEFAULT_PAGINATION_LIMIT, offset = DEFAULT_PAGINATION_OFFSET) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  const userId = await getOrCreateUser(accountId, supabaseConfig);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Fetch screenshots (excluding deleted ones)
  const screenshots = await supabaseRequest(
    supabaseConfig,
    `screenshots?user_id=eq.${userId}&deleted_at=is.null&order=timestamp.desc&limit=${limit}&offset=${offset}`
  );

  // Generate signed URLs for private storage images
  const screenshotsWithUrls = await Promise.all(
    (screenshots || []).map(async (screenshot) => {
      const screenshotWithUrl = { ...screenshot };

      // Generate signed URL for thumbnail if it exists
      if (screenshot.thumbnail_url || screenshot.storage_path) {
        try {
          // Extract thumbnail path from storage_path
          let thumbPath = screenshot.thumbnail_url;
          if (!thumbPath && screenshot.storage_path) {
            // Format: user_id/screenshot_timestamp.png -> user_id/thumb_timestamp.jpg
            if (screenshot.storage_path.includes('/')) {
              const dirPath = screenshot.storage_path.substring(0, screenshot.storage_path.lastIndexOf('/'));
              const filename = screenshot.storage_path.substring(screenshot.storage_path.lastIndexOf('/') + 1);
              const thumbFilename = filename.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
              thumbPath = `${dirPath}/${thumbFilename}`;
            } else {
              thumbPath = screenshot.storage_path.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
            }
          }

          // Generate signed URL (valid for 1 hour)
          const signedUrl = await generateSignedUrl(supabaseConfig, 'screenshots', thumbPath, 3600);
          screenshotWithUrl.signed_thumbnail_url = signedUrl;
        } catch (err) {
          console.error('Error generating signed URL:', err);
          // Fallback to original URL
          screenshotWithUrl.signed_thumbnail_url = screenshot.thumbnail_url;
        }
      }

      return screenshotWithUrl;
    })
  );

  // Get total count for pagination
  const countResponse = await fetch(
    `${supabaseConfig.url}/rest/v1/screenshots?user_id=eq.${userId}&deleted_at=is.null&select=id`,
    {
      method: 'HEAD',
      headers: {
        'apikey': supabaseConfig.serviceRoleKey,
        'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
        'Prefer': 'count=exact'
      }
    }
  );

  const totalCount = parseInt(countResponse.headers.get('content-range')?.split('/')[1] || '0', 10);

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
 * @param {string} screenshotId - Screenshot ID to delete
 * @returns {Promise<void>}
 */
export async function deleteScreenshot(accountId, screenshotId) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  if (!supabaseConfig) {
    throw new Error('Supabase not configured. Please configure in Settings.');
  }

  const userId = await getOrCreateUser(accountId, supabaseConfig);
  if (!userId) {
    throw new Error('Unable to get user information');
  }

  // Verify screenshot belongs to user
  const screenshot = await supabaseRequest(
    supabaseConfig,
    `screenshots?id=eq.${screenshotId}&user_id=eq.${userId}&select=id,storage_path`
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
