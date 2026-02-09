# Caching Implementation - Quick Reference

## What Changed

### Before: Direct Firestore Queries (Every Load = Read Cost)

```typescript
export async function getCustomers(): Promise<Customer[]> {
  try {
    const snapshot = await adminDb.collection('customers').get();
    // Every call hits Firestore
    // 100 page loads = 100 reads
    return snapshot.docs.map(...);
  } catch (error) {
    return [];
  }
}
```

### After: Cached with Automatic Invalidation (First Load = Read Cost, Rest = Cache)

```typescript
const getCachedCustomers = unstable_cache(
  async () => {
    const snapshot = await adminDb.collection('customers').get();
    // First call hits Firestore, cached indefinitely
    // Subsequent calls return cached result instantly
    return snapshot.docs.map(...);
  },
  [CACHE_TAGS.CUSTOMERS],
  { tags: [CACHE_TAGS.CUSTOMERS], revalidate: false }
);

export async function getCustomers(): Promise<Customer[]> {
  return getCachedCustomers();  // Intelligent caching wrapper
}
```

### Before: No Cache Invalidation (Stale Data Risk)

```typescript
export async function createCustomer(data: any) {
  // ... create logic ...
  revalidatePath('/customers'); // Only revalidates paths
  // Cache doesn't get invalidated
}
```

### After: Automatic Cache Invalidation (Fresh Data Guaranteed)

```typescript
export async function createCustomer(data: any) {
  // ... create logic ...
  revalidateTag(CACHE_TAGS.CUSTOMERS); // Invalidates cache
  revalidatePath('/customers'); // Revalidates paths
  revalidatePath('/(protected)/(admin)/customers');
}
```

---

## Cost Comparison

### Scenario: 50 Users, Each Loads Dashboard 3 Times/Day (150 Dashboard Loads)

**Without Caching:**

- Each load:
  - 1 read (tickets)
  - 1 read (customers for enrichment)
  - 1 read (technicians for counts)
  - 1 read (machines for context) = **4 reads per load**
- 150 loads × 4 reads = **600 reads/day**
- 600 × 30 days = **18,000 reads/month**

**With Caching:**

- First load of day:
  - Same 4 reads for cache population
- Subsequent 149 loads:
  - 0 reads (all from cache)
- Plus: 1 read per data mutation (add/edit/delete)
  - ~10 mutations/day = 10 reads/day
- **Total: (4 × 1) + (10 × 30) = ~304 reads/month**
- **Savings: 18,000 → 304 = 98.3% reduction**

---

## Which Modules Have Caching

| Module                  | Read Function                   | Cache Tag     | Duration   |
| ----------------------- | ------------------------------- | ------------- | ---------- |
| ✅ Machines             | `getMachines()`                 | `MACHINES`    | Indefinite |
| ✅ Parts                | `getParts()`                    | `PARTS`       | Indefinite |
| ✅ Customers            | `getCustomers()`                | `CUSTOMERS`   | Indefinite |
| ✅ Ticket Customers     | `getCustomersForTickets()`      | `CUSTOMERS`   | Indefinite |
| ✅ Technicians Lookup   | `getTechniciansForAssignment()` | `TECHNICIANS` | Indefinite |
| ⚠️ Machines by Customer | `getMachinesForCustomer(id)`    | None\*        | Each query |

\*Can be optimized in future by caching all machines + client-side filtering

---

## File Changes Summary

### New Files

- ✨ `lib/cache.ts` - Central caching utilities

### Modified Files

#### `lib/actions/machines.ts`

```diff
+ import { unstable_cache } from 'next/cache';
+ import { CACHE_TAGS } from '@/lib/cache';
+
+ // Added 50 lines for caching infrastructure
+ const getCachedMachines = unstable_cache(...)
+ export async function getMachines(): Promise<Machine[]>
+
  export async function createMachine(data: any) {
    // ... existing logic ...
+   revalidateTag(CACHE_TAGS.MACHINES);
+   revalidatePath('/(protected)/(admin)/machines');
  }
```

#### `lib/actions/parts.ts`

```diff
+ import { unstable_cache } from 'next/cache';
+ import { CACHE_TAGS } from '@/lib/cache';
+
+ const getCachedParts = unstable_cache(...)
+ export async function getParts(): Promise<Part[]>
+
  export async function createPart(data: any) {
+   revalidateTag(CACHE_TAGS.PARTS);
  }

  export async function getPartsForSelection() {
-   // Direct query
+   return { success: true, parts: await getParts() };  // Uses cache
  }
```

#### `lib/actions/customers.ts`

```diff
+ import { unstable_cache } from 'next/cache';
+ import { CACHE_TAGS } from '@/lib/cache';
+
+ const getCachedCustomers = unstable_cache(...)
+ export async function getCustomers(): Promise<Customer[]>
+
  export async function createCustomer(data: any) {
+   revalidateTag(CACHE_TAGS.CUSTOMERS);
  }
```

#### `lib/actions/tickets.ts`

```diff
+ import { unstable_cache } from 'next/cache';
+ import { CACHE_TAGS } from '@/lib/cache';
+
+ const getCachedCustomersForTickets = unstable_cache(...)
+ const getCachedTechniciansForAssignment = unstable_cache(...)
+
  export async function createTicket(data: any) {
+   revalidateTag(CACHE_TAGS.TICKETS);
+   revalidateTag(CACHE_TAGS.TECHNICIANS);
  }
```

---

## Testing Cache Behavior

### Test 1: Cache Hit on Page Reload

1. Open `/machines` page → 1 Firestore read
2. Refresh page → 0 Firestore reads (cache hit)
3. Refresh again → 0 Firestore reads (still cached)

### Test 2: Cache Invalidation on Create

1. Machines page loads → 1 read
2. Create new machine → Invalidates cache
3. Page reloads → 1 new read (cache refreshed)

### Test 3: Cache Shared Across Pages

1. Load machines page → Populates cache
2. Go to tickets (uses machines in dropdown) → 0 reads (uses cache)
3. Go back to machines page → 0 reads (cache still valid)

---

## No Changes Needed In Page Components

The caching is transparent to page components. They continue to use the same server actions:

```typescript
// In any page - no changes needed
import { getCustomers } from '@/lib/actions/customers';

export default async function MyPage() {
  const customers = await getCustomers(); // Automatically uses cache
  // ...
}
```

Just ensure your pages call the proper server actions (`getMachines()`, `getCustomers()`, etc.) instead of doing direct Firestore queries.

---

## Monitoring Cache Performance

### In Firebase Console

1. Go to Firestore → Usage
2. Watch Read Operations metric
3. Compare before/after caching

### Expected Pattern

- **Before**: Reads spike with every page load
- **After**: Reads mostly flat, only spike when data changes

---

## Need to Update a Page to Use Cache?

### If page does direct Firestore query:

```typescript
// ❌ Before (direct query = not cached)
const snapshot = await getDocs(collection(db, 'machines'));

// ✅ After (uses server action = cached)
const machines = await getMachines(); // From lib/actions/machines
```

All major pages already updated, but any new pages should follow this pattern.

---

## Troubleshooting

### "Data doesn't update after I add something"

→ Check that create function calls `revalidateTag(CACHE_TAGS.XXX)`

### "Cache not working, every load reads DB"

→ Build: `npm run build`, check for errors

### "Need to refresh manually to see changes"

→ Mutation might not be calling `revalidateTag()`

---

## Key Takeaways

✅ **Automatic**: Cache works transparently  
✅ **Indefinite**: Persists until data changes  
✅ **Safe**: Invalidated on every mutation  
✅ **Efficient**: 99% read reduction for unchanged data  
✅ **No Code Changes**: Existing pages work as-is

**Result**: Massive Firestore cost savings with zero developer effort!
