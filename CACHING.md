# Data Caching Implementation Guide

## Overview

Implemented comprehensive caching across all major modules (Machines, Parts, Customers, Technicians, Tickets) to reduce Firestore read operations. The cache persists indefinitely until data is
created, updated, or deleted.

## Architecture

### How It Works

1. **Cached Server Actions**: All read operations use `unstable_cache` from Next.js
2. **Automatic Invalidation**: All create/update/delete operations invalidate the cache using cache tags
3. **Path Revalidation**: Relevant routes are revalidated when data changes
4. **Indefinite Persistence**: Cache survives across requests until explicitly invalidated

### Cache Tags System

Defined in `lib/cache.ts`:

```typescript
export const CACHE_TAGS = {
  MACHINES: 'machines',
  PARTS: 'parts',
  CUSTOMERS: 'customers',
  TECHNICIANS: 'technicians',
  TICKETS: 'tickets',
  CALL_ADMINS: 'call-admins',
} as const;
```

## Cached Operations

### Machines Module

**Read Operations (Cached):**

- `getMachines()` - Returns all machines with customer details

**Write Operations (Invalidate MACHINES cache):**

- `createMachine()`
- `updateMachine()`
- `deleteMachine()`

**Cache Invalidation Triggered:**

- `/machines` path
- `/(protected)/(admin)/machines` path

---

### Parts Module

**Read Operations (Cached):**

- `getParts()` - Returns all parts with stock information
- `getPartsForSelection()` - Wrapper that uses cached getParts()

**Write Operations (Invalidate PARTS cache):**

- `createPart()`
- `updatePart()`
- `deletePart()`
- `updatePartQuantity()` - Also invalidates when quantity changes

**Cache Invalidation Triggered:**

- `/parts` path
- `/(protected)/(admin)/parts` path

---

### Customers Module

**Read Operations (Cached):**

- `getCustomers()` - Returns all customers with contact info

**Write Operations (Invalidate CUSTOMERS cache):**

- `createCustomer()`
- `updateCustomer()`
- `deleteCustomer()`

**Cache Invalidation Triggered:**

- `/customers` path (legacy, redirects to admin)
- `/(protected)/(admin)/customers` path

---

### Tickets Module

**Read Operations (Cached):**

- `getCustomersForTickets()` - Cached with CUSTOMERS tag
- `getTechniciansForAssignment()` - Cached with TECHNICIANS tag

**Non-Cached Operations:**

- `getMachinesForCustomer()` - Parameterized query, not cached (can be optimized later)

**Write Operations (Invalidate TICKETS & TECHNICIANS caches):**

- `createTicket()` - Invalidates both TICKETS and TECHNICIANS
- `updateTicket()` - Invalidates both TICKETS and TECHNICIANS
- `technicianUpdateTicket()` - Invalidates TICKETS cache

**Cache Invalidation Triggered:**

- `/tickets` path
- `/dashboard` path
- `/(protected)/tickets` path
- `/(protected)/dashboard` path
- `/(protected)/(admin)/tickets` path
- `/(protected)/(admin)/call-admin` path

---

## Read Operations Savings

### Cached Queries (Eliminated Repeated Reads)

1. **Machines** - Previously queried on every load:
   - Machines page: 1 read (cached, no follow-up reads)
   - Pages loading machine data: Now use cache

2. **Parts** - Previously queried multiple times:
   - Parts page: 1 read (cached)
   - Ticket creation form: Uses cache (was separate read)
   - Part selection dropdowns: Use cache

3. **Customers** - Previously queried on every load:
   - Customers page: 1 read (cached)
   - Ticket creation: Uses cache
   - Call admin dashboard: Uses cache (customer enrichment)

4. **Technicians** - Previously queried on every load:
   - Technicians page: 1 read (cached)
   - Ticket assignment dropdowns: Use cache
   - Ticket creation form: Uses cache

5. **Tickets** - Related customer/technician data now uses cache:
   - Customer lookup: Uses cached customers
   - Technician lookup: Uses cached technicians

---

## Implementation Details

### In lib/cache.ts

```typescript
// Creates a cached query that persists indefinitely
export function createCachedQuery<T>(fn: () => Promise<T>, tags: string[], keyParts: (string | number)[] = []);
```

### Pattern Used in Action Files

```typescript
// 1. Create cached function
const getCachedCustomers = unstable_cache(
  async () => {
    // ... fetch logic ...
  },
  [CACHE_TAGS.CUSTOMERS],
  { tags: [CACHE_TAGS.CUSTOMERS], revalidate: false },
);

// 2. Wrap in public export
export async function getCustomers(): Promise<Customer[]> {
  return getCachedCustomers();
}

// 3. Invalidate in mutations
export async function createCustomer(data: any) {
  // ... create logic ...
  revalidateTag(CACHE_TAGS.CUSTOMERS);
  revalidatePath('/(protected)/(admin)/customers');
}
```

---

## Expected Savings

### Firestore Read Quota Reduction

**Before Caching:**

- Page load: Multiple collection reads
- Each user action: Full collection re-fetch
- Multiple pages accessing same data: Duplicate reads

**After Caching:**

- First load: 1 read per collection
- Subsequent loads: 0 reads (cache hit)
- Only modified when data changes (create/update/delete)

**Example Scenario:**

- 100 page loads per day without caching = 100 reads
- 100 page loads per day with caching = 1 read + 99 cache hits
- **Reduction: 99%** for unchanged data

### Estimated Monthly Savings

Assuming moderate usage (1 page load per collection per user per session):

- Without caching: ~10,000 reads/month
- With caching: ~100 reads/month (only on mutations)
- **Reduction: ~99%**

---

## How to Use Cached Data

### In Server Components & Server Actions

```typescript
import { getCustomers, getMachines, getParts } from '@/lib/actions/customers';

export default async function MyPage() {
  const customers = await getCustomers(); // Cached
  // ... rest of page
}
```

### Cache Behavior

1. **First Request**: Executes query, stores in cache
2. **Subsequent Requests**: Returns cached result instantly
3. **After Mutation**: Cache invalidated, next request hits DB
4. **Data Consistency**: Always fresh after any modification

---

## Testing the Cache

### Monitor Cache Hits

Check Firebase console for read operations:

- Before: Reads spike with every page load
- After: Reads only on data mutations

### Manual Testing

```bash
# Terminal 1: Watch Firebase reads
# Open Firebase Console → Firestore → Usage

# Terminal 2: Run dev server
npm run dev

# Browser: Refresh the same page multiple times
# Expected: First refresh reads data, subsequent refreshes use cache
```

---

## Notes & Future Optimizations

### Current Limitations

1. **Parameterized Queries**: `getMachinesForCustomer(customerId)` not cached
   - Could be optimized by caching all machines + filtering client-side
   - Trade-off: More memory vs frequent DB queries

2. **User-Specific Data**: Technician-specific tickets not cached
   - Each technician gets their own query results
   - Can't share cache across users

### Potential Improvements

1. Add caching for machines by customer (with key function)
2. Cache user roles/permissions if frequently accessed
3. Implement client-side caching with localStorage for offline support
4. Add cache statistics monitoring

---

## Troubleshooting

### Cache Appears Stale

**Symptom**: Data not updating after creation/edit

**Solution**: Check that mutation function includes:

```typescript
revalidateTag(CACHE_TAGS.CUSTOMERS); // Matches read function cache tag
revalidatePath('/path/to/page'); // Revalidates affected pages
```

### Cache Not Working

**Check**:

1. Server action imports cache utilities correctly
2. Cache tag names match between read and write functions
3. Build succeeded without errors: `npm run build`

---

## Files Modified

### Created

- `lib/cache.ts` - Cache utility functions

### Updated

- `lib/actions/machines.ts` - Added getMachines() with caching
- `lib/actions/parts.ts` - Added getParts() with caching
- `lib/actions/customers.ts` - Added getCustomers() with caching
- `lib/actions/tickets.ts` - Added cached customer/technician lookups

### Mutation Endpoints Updated

All create/update/delete functions now include:

```typescript
revalidateTag(CACHE_TAGS.XXX);
revalidatePath('/relevant/paths');
```

---

## Summary

✅ **Machines**: Read cached indefinitely, invalidated on create/update/delete ✅ **Parts**: Read cached indefinitely, invalidated on quantity/data changes ✅ **Customers**: Read cached indefinitely,
invalidated on mutations ✅ **Tickets**: Related customer/tech data cached, invalidated on changes ✅ **99% Read Reduction**: For unchanged data after initial load

All caches persist until explicitly invalidated, reducing Firestore costs significantly.
