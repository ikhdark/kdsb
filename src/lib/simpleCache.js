/**
 * A lightweight in-memory cache with TTL (time to live).
 */

const cache = new Map();

/**
 * Stores a value in the cache with a time-to-live (TTL).
 *
 * @param {string} key - Cache key.
 * @param {*} value - Value to cache.
 * @param {number} ttlMs - Time to live in milliseconds.
 */
function set(key, value, ttlMs) {
  const expiresAt = Date.now() + ttlMs;
  cache.set(key, { value, expiresAt });
}

/**
 * Retrieves a value from the cache if it's still valid.
 *
 * @param {string} key - Cache key.
 * @returns {*} - Cached value or null if expired/missing.
 */
function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key); // Clean up expired entry
    return null;
  }

  return entry.value;
}

/**
 * Deletes a specific key from the cache.
 *
 * @param {string} key
 */
function del(key) {
  cache.delete(key);
}

/**
 * Clears the entire cache.
 */
function clear() {
  cache.clear();
}

module.exports = { get, set, del, clear };
