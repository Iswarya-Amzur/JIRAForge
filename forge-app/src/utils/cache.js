/**
 * In-Memory Cache Utility
 * Reduces Supabase requests by caching frequently accessed data
 * 
 * IMPORTANT: Forge apps run in isolated containers, so this cache is per-request-context.
 * For true cross-request caching, use Forge Storage or Redis.
 */

// Cache storage with TTL
const cache = new Map();

// Default TTL values (in milliseconds)
const TTL = {
  USER_ID: 5 * 60 * 1000,        // 5 minutes - user IDs rarely change
  ORGANIZATION: 10 * 60 * 1000, // 10 minutes - org data is very stable
  CONFIG: 15 * 60 * 1000,       // 15 minutes - Supabase config
  MEMBERSHIP: 5 * 60 * 1000,    // 5 minutes - membership/permissions
  GROUPS: 30 * 1000,            // 30 seconds - unassigned groups (more dynamic)
};

/**
 * Get item from cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached value or null if expired/missing
 */
export function getFromCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return item.value;
}

/**
 * Set item in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlMs - Time to live in milliseconds
 */
export function setInCache(key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

/**
 * Remove item from cache
 * @param {string} key - Cache key
 */
export function removeFromCache(key) {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache stats
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  let validCount = 0;
  let expiredCount = 0;
  const now = Date.now();
  
  for (const [key, item] of cache.entries()) {
    if (now > item.expiresAt) {
      expiredCount++;
    } else {
      validCount++;
    }
  }
  
  return {
    total: cache.size,
    valid: validCount,
    expired: expiredCount
  };
}

// Export TTL constants for use in other modules
export { TTL };

// Cache key generators for consistency
export const CacheKeys = {
  userId: (accountId) => `user:${accountId}`,
  organization: (cloudId) => `org:${cloudId}`,
  supabaseConfig: (accountId) => `config:${accountId}`,
  membership: (userId, orgId) => `membership:${userId}:${orgId}`,
  unassignedGroups: (userId, orgId) => `groups:${userId}:${orgId}`,
};

