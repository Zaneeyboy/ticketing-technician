import { unstable_cache } from 'next/cache';

/**
 * Cache tags for different data types
 */
export const CACHE_TAGS = {
  MACHINES: 'machines',
  PARTS: 'parts',
  CUSTOMERS: 'customers',
  TECHNICIANS: 'technicians',
  TICKETS: 'tickets',
  CALL_ADMINS: 'call-admins',
  WORK_LOGS: 'work-logs',
  REPORTS: 'reports',
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
 * Revalidate cache for specific data type
 */
export async function revalidateCache(tags: string[]) {
  const { revalidateTag } = await import('next/cache');
  tags.forEach((tag) => revalidateTag(tag, 'default'));
}
