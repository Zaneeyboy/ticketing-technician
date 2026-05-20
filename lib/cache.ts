import { unstable_cache } from 'next/cache';

/**
 * Cache tags for different data types
 */
export const CACHE_TAGS = {
  MACHINES: 'machines',
  MACHINE_TYPES: 'machine-types',
  PARTS: 'parts',
  CUSTOMERS: 'customers',
  TECHNICIANS: 'technicians',
  TICKETS: 'tickets',
  CALL_ADMINS: 'call-admins',
  WORK_LOGS: 'work-logs',
  REPORTS: 'reports',
  STORES: 'stores',
  HQ_STATS: 'hq-stats',
  HQ_REPORTS: 'hq-reports',
  USERS: 'users',
  INVITATIONS: 'invitations',
} as const;

/**
 * Wrapper function to cache query results
 * Results are cached indefinitely until explicitly revalidated
 */
export function createCachedQuery<T>(fn: () => Promise<T>, tags: string[], keyParts: (string | number)[] = []) {
  const key = [fn.toString(), ...keyParts].join(':');

  return unstable_cache(fn, [key], {
    tags,
    revalidate: false, // Cache indefinitely
  });
}

/**
 * Revalidate cache for specific data types.
 * Uses { expire: 0 } for immediate expiration so mutations are visible on the very next request.
 */
export async function revalidateCache(tags: string[]) {
  const { revalidateTag } = await import('next/cache');
  // Next.js 16: pass { expire: 0 } to immediately expire the cache entry so the next
  // request fetches fresh data rather than serving stale (stale-while-revalidate 'max').
  const purge = revalidateTag as unknown as (tag: string, options: { expire: number }) => void;
  tags.forEach((tag) => purge(tag, { expire: 0 }));
}
