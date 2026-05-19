/**
 * Module-level in-memory cache for client-side data.
 *
 * Unlike React state, module-level variables survive component unmount/remount
 * cycles caused by client-side navigation, so cached data is available
 * synchronously the next time a page mounts — eliminating skeleton loaders on
 * repeat visits.
 *
 * Usage:
 *   clientCache.get<T>(key)           — returns cached value or undefined
 *   clientCache.set(key, value)       — stores a value
 *   clientCache.invalidate(...keys)   — removes exact keys (call before re-fetching after mutations)
 *   clientCache.invalidatePrefix(p)   — removes all keys that start with p
 */

const store = new Map<string, unknown>();

export const clientCache = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined;
  },

  set<T>(key: string, data: T): void {
    store.set(key, data);
  },

  invalidate(...keys: string[]): void {
    keys.forEach((k) => store.delete(k));
  },

  invalidatePrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  has(key: string): boolean {
    return store.has(key);
  },
};
