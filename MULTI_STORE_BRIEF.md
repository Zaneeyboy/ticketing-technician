# Multi-Store Architecture Brief

## Caribbean Roasters Field Service Platform

**Prepared for:** Tech Dynamics  
**Client:** Caribbean Roasters Ltd  
**Date:** May 2026  
**Status:** Pre-development specification

---

## 1. Executive Summary

Caribbean Roasters operates as a regional company servicing clients across multiple island territories. The current platform is architected as a flat, single-tenant system. This brief specifies the
changes required to transform it into a **multi-store, multi-tenant platform** where:

- Each Caribbean Roasters **branch/territory store** operates its own isolated workspace (its own tickets, customers, machines, parts, technicians).
- A **headquarters (HQ) super-admin** account has a unified view across all stores — aggregate reports, cross-store ticket visibility, global parts tracking, and store management.
- New stores can be **onboarded** by HQ without engineering involvement.
- The **current modules** (tickets, customers, machines, parts, technicians, reports) carry forward entirely — they are simply scoped to a store.

---

## 2. Glossary

| Term                 | Definition                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Store**            | A Caribbean Roasters branch or territory (e.g., "Trinidad Branch", "Barbados Branch", "Jamaica Branch")                                                                                             |
| **HQ / Admin Panel** | A management-only interface for the super_admin. It is **not a store** — it has no tickets, customers, or operational data of its own. All data displayed within it is aggregated from real stores. |
| **Store Admin**      | A per-store admin who manages that store's users, tickets, machines, parts                                                                                                                          |
| **Super Admin**      | Platform-level role with no store assignment; full read/write across all stores, manages store onboarding and global configuration                                                                  |
| **Store Scope**      | A query, view, or action limited to a single store's data                                                                                                                                           |
| **Global Scope**     | A query, view, or action spanning all stores (super_admin only); reads are aggregated, never written back to a fictitious HQ store                                                                  |

---

## 3. Current Architecture (Baseline)

### Firestore Structure (current — flat/single-tenant)

```
/users/{uid}
/tickets/{ticketId}
/customers/{customerId}
/machines/{machineId}
/parts/{partId}
```

### Roles (current)

```
admin | call_admin | technician | management
```

### Problems with current structure

- All data is global — no way to isolate Store A's tickets from Store B's
- No concept of a "store" entity
- `admin` role is ambiguous — is it a store admin or an HQ admin?
- Security rules have no tenancy boundary

---

## 4. Target Architecture

### 4.1 Firestore Structure (multi-tenant)

```
/stores/{storeId}                        ← Store registry (admin panel-managed)
  name: string
  island: string
  address: string
  status: 'active' | 'inactive' | 'onboarding'
  contactEmail: string
  contactPhone: string
  modules: { tickets, customers, machines, parts, reports }
  settings: { timezone, currency, locale }
  createdAt: Timestamp
  updatedAt: Timestamp

/stores/{storeId}/tickets/{ticketId}     ← Tickets scoped to store
/stores/{storeId}/customers/{customerId} ← Customers scoped to store
/stores/{storeId}/machines/{machineId}   ← Machines scoped to store
/stores/{storeId}/parts/{partId}         ← Parts inventory scoped to store

/users/{uid}                             ← Stays top-level (auth UID keyed)
  storeId: string | null                 ← null = super_admin (HQ, no store limit)
  role: UserRole                         ← See section 4.2
  ...existing fields
```

**Why subcollections over a `storeId` field on every document?**

- Firestore security rules can match on `stores/{storeId}/**` — one rule covers all sub-resources
- Prevents cross-store data leakage at the database level rather than in application code
- Cleaner query patterns — no compound indexes needed for `where('storeId', '==', x)`
- Natural data partitioning makes it easier to export/archive a single store's data

### 4.2 Updated Role Hierarchy

```typescript
type UserRole = 'super_admin' | 'store_admin' | 'call_admin' | 'technician';
```

| Role          | Store Access                 | Capabilities                                                                  |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| `super_admin` | All stores (`storeId: null`) | Manage stores, view all data globally, create store admins, aggregate reports |
| `store_admin` | Their store only             | Everything the current `admin` does, scoped to one store                      |
| `call_admin`  | Their store only             | Create tickets, manage customers — scoped to store                            |
| `technician`  | Their store only             | View/update assigned tickets — scoped to store                                |

**Retired roles:** `admin` (replaced by `store_admin`) and `management` (replaced by `super_admin`)

**Migration mapping:**

```
admin       → store_admin  (assigned to the first real branch store created during setup)
management  → super_admin  (storeId: null — no store assignment)
call_admin  → call_admin   (assigned to the first real branch store created during setup)
technician  → technician   (assigned to the first real branch store created during setup)
```

> **Note:** Because HQ is not a store, there is no "HQ store" to assign existing users to. Existing users with operational roles must be assigned to a proper store (created in Phase 0 step 1). The
> super_admin creates the first store, then the migration script assigns users to it.

### 4.3 Updated User Type

```typescript
interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  storeId: string | null; // NEW — null only for super_admin
  storeName?: string; // NEW — denormalized for display
  disabled?: boolean;
  internalPayRate?: number;
  chargeoutRate?: number;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
```

### 4.4 Store Type

```typescript
type StoreStatus = 'active' | 'inactive' | 'onboarding';
// No StoreType — all stores are branches. The admin panel is not a store.

interface StoreModules {
  tickets: boolean;
  customers: boolean;
  machines: boolean;
  parts: boolean;
  reports: boolean;
}

interface StoreSettings {
  timezone: string; // e.g., 'America/Port_of_Spain'
  currency: string; // e.g., 'TTD', 'BBD', 'JMD'
  locale: string; // e.g., 'en-TT'
}

interface Store {
  id: string;
  name: string; // e.g., "Trinidad Branch", "Barbados Branch"
  island: string; // e.g., "Trinidad", "Barbados", "Jamaica"
  address: string;
  contactEmail: string;
  contactPhone: string;
  // No 'type' field — every document in /stores is a real operational store
  status: StoreStatus;
  modules: StoreModules;
  settings: StoreSettings;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}
```

---

## 5. Session & Auth Changes

### 5.1 Session Token

The session cookie currently stores the Firebase UID and role. Add `storeId` to the session payload by writing it into Firestore's user doc (already fetched in `getCurrentUser()`). No changes to the
cookie itself — `getCurrentUser()` returns the full `User` including `storeId`.

### 5.2 Login Flow

1. User logs in (no change to login page)
2. `getCurrentUser()` returns user with `storeId`
3. If `role === 'super_admin'` → redirect to `/hq/dashboard` (new HQ root)
4. If `role === 'store_admin' | 'call_admin' | 'technician'` → redirect to `/dashboard` (current, now store-scoped)

### 5.3 Store Context (React)

Add a `StoreContext` provider that makes `storeId` and `store` metadata available to all protected pages without prop-drilling:

```typescript
// lib/providers/store-context.tsx
interface StoreContextValue {
  storeId: string | null; // null for super_admin and manager (no store)
  store: Store | null; // null for super_admin and manager
  isPlatformAdmin: boolean; // true if super_admin or manager (in /hq/* routes)
  selectedStoreId: string | null; // for admin panel drill-down into a specific store
  setSelectedStore: (id: string | null) => void;
}
```

> `isHQ` is renamed `isPlatformAdmin` to avoid implying the admin panel is itself a store.

Wrap `app/(protected)/layout.tsx` with `<StoreProvider>`.

All server actions receive `storeId` either from the session (store-scoped users) or from the selected store (super_admin drilling into a store).

---

## 6. URL Structure

No URL-level store routing is needed for store users — their store is determined by their session. Super admins use a separate top-level route group.

```
/dashboard                    → Store user dashboard (scoped to session.storeId)
/tickets                      → Store tickets
/customers                    → Store customers
/machines                     → Store machines
/parts                        → Store parts
/reports                      → Store reports
/technicians                  → Store technicians
/users                        → Store user management (store_admin only)

/hq/dashboard                 → HQ aggregate dashboard (super_admin only)
/hq/stores                    → Store management: list, create, edit stores
/hq/stores/[storeId]          → Individual store detail + drill-down
/hq/stores/new                → Onboard a new store
/hq/reports                   → Cross-store aggregate reports
/hq/tickets                   → All tickets across all stores
/hq/parts                     → Global parts overview (cross-store)
```

---

## 7. Server Actions Changes

Every server action must accept and enforce `storeId`. The pattern:

```typescript
// BEFORE
export async function getTickets() {
  const tickets = await adminDb.collection('tickets').get();
}

// AFTER
export async function getTickets(storeId: string) {
  const tickets = await adminDb.collection('stores').doc(storeId).collection('tickets').get();
}
```

All actions in `lib/actions/` need this treatment:

- `tickets.ts` — `getTickets(storeId)`, `createTicket(storeId, data)`, `updateTicket(storeId, id, data)`
- `customers.ts` — all functions accept `storeId`
- `machines.ts` — all functions accept `storeId`
- `parts.ts` — all functions accept `storeId`
- `users.ts` — `getUsers(storeId)` returns only that store's users; `createUser(storeId, data)` sets the user's `storeId`

**Calling pattern in page/component:** Store-scoped users: `storeId` comes from `StoreContext` (populated from session).  
Super admin in store drill-down: `storeId` comes from `selectedStoreId` in `StoreContext`.  
Super admin in global view: action iterates all stores or uses a collection group query.

---

## 8. Firestore Security Rules (updated)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function role() { return userDoc().role; }
    function userStoreId() { return userDoc().storeId; }
    function isSuperAdmin() { return signedIn() && role() == 'super_admin'; }
    function isStoreAdmin() { return signedIn() && role() == 'store_admin'; }
    function belongsToStore(storeId) {
      return signedIn() && userStoreId() == storeId;
    }
    function canAccessStore(storeId) {
      return isSuperAdmin() || belongsToStore(storeId);
    }

    // Store registry — super_admin manages, others can read their own
    match /stores/{storeId} {
      allow read: if canAccessStore(storeId);
      allow write: if isSuperAdmin();

      // All store subcollections
      match /tickets/{ticketId} {
        allow read: if canAccessStore(storeId);
        allow create: if belongsToStore(storeId) &&
          (isStoreAdmin() || role() == 'call_admin');
        allow update: if belongsToStore(storeId);
        allow delete: if isSuperAdmin() || isStoreAdmin();
      }

      match /customers/{customerId} {
        allow read: if canAccessStore(storeId);
        allow write: if belongsToStore(storeId) &&
          (isStoreAdmin() || role() == 'call_admin');
        allow delete: if isSuperAdmin() || isStoreAdmin();
      }

      match /machines/{machineId} {
        allow read: if canAccessStore(storeId);
        allow write: if belongsToStore(storeId) &&
          (isStoreAdmin() || role() == 'call_admin');
      }

      match /parts/{partId} {
        allow read: if canAccessStore(storeId);
        allow write: if belongsToStore(storeId) &&
          (isStoreAdmin() || role() == 'technician');
      }
    }

    // Users — top-level
    match /users/{userId} {
      allow read: if signedIn();
      allow create: if signedIn();
      allow update: if signedIn() &&
        (request.auth.uid == userId || isSuperAdmin() || isStoreAdmin());
      allow delete: if isSuperAdmin();
    }
  }
}
```

---

## 9. Phased Implementation Plan

### Phase 0 — Data Migration (prerequisite, ~1 day)

> Must happen before any new code is deployed.

> **Important:** The admin panel (HQ) is not a store and has no store document. All existing operational data (tickets, customers, machines, parts) must be migrated into the first **real** store —
> typically the primary Trinidad branch — not into a fictitious HQ store.

1. **Create the first real store document** in Firestore via the admin panel UI (or seed script): `/stores/{first-store-id}` for the primary operating branch (e.g., Trinidad Branch),
   `status: 'active'`, all modules enabled. No `type` field.
2. **Copy all existing flat collections** into that store's subcollection:
   - All `/tickets/**` → `/stores/{first-store-id}/tickets/**`
   - All `/customers/**` → `/stores/{first-store-id}/customers/**`
   - All `/machines/**` → `/stores/{first-store-id}/machines/**`
   - All `/parts/**` → `/stores/{first-store-id}/parts/**`
3. **Update all user documents** — set `storeId` to `{first-store-id}` for operational users (`admin` → `store_admin`, `call_admin`, `technician`). Set `storeId: null` for `management` users being
   promoted to `super_admin`. Update `role` per the mapping in section 4.2.
4. Write a one-off migration script at `scripts/migrate-to-multitenant.ts`.
5. After verifying data in subcollections, delete the original flat collections.

**Deliverable:** Migration script + verification checklist before cutover.

---

### Phase 1 — Core Infrastructure (~3 days)

**Goal:** App runs exactly as before but data is now stored/read from `stores/{storeId}/*`. No new UI yet.

#### 1.1 Types & Schemas

- Add `Store`, `StoreModules`, `StoreSettings` interfaces to `lib/types/index.ts`
- Update `User` interface: add `storeId: string | null`, `storeName?: string`
- Update `UserRole`: add `'super_admin'`, `'store_admin'`; retire `'admin'`, `'management'`
- Add `StoreSchema` to `lib/schemas/index.ts`

#### 1.2 Store Context Provider

- Create `lib/providers/store-context.tsx`
- Add `StoreProvider` to `app/(protected)/layout.tsx`
- `StoreProvider` reads `user.storeId` from `useAuth()` and fetches the store document on mount
- Exports `useStore()` hook

#### 1.3 Server Actions Refactor

Refactor all action files to accept `storeId` as first parameter and use `stores/{storeId}/collection` paths:

- `lib/actions/tickets.ts`
- `lib/actions/customers.ts`
- `lib/actions/machines.ts`
- `lib/actions/parts.ts`
- `lib/actions/users.ts`
- Add new `lib/actions/stores.ts` (CRUD for store documents, super_admin only)

#### 1.4 Auth Layer

- Update `getCurrentUser()` in `lib/auth/session.ts` to return `storeId` and `storeName`
- Update `role-guard.ts` to understand the new role hierarchy
- Update `auth-provider.tsx` to expose `storeId` in the auth context

#### 1.5 Security Rules

- Deploy updated `firestore.rules` (see section 8)

**Deliverable:** Existing app functionality unchanged from user perspective, but data reads/writes go through store subcollections.

---

### Phase 2 — HQ Super Admin Layer (~4 days)

**Goal:** Super admin can log in and see a global dashboard, manage stores, and drill into any store.

#### 2.1 Route Group

Create `app/(protected)/(hq)/` route group with its own layout.  
The `(hq)` layout checks `role === 'super_admin'` — redirects others away.

#### 2.2 HQ Dashboard `/hq/dashboard`

Cards showing:

- Total open tickets across all stores
- Total tickets closed this month
- Active stores count
- Stores needing attention (unassigned tickets > threshold)
- Per-store ticket status breakdown table (stores as rows)

#### 2.3 Store Management `/hq/stores`

- Table of all stores: name, island, status, ticket counts, user counts, last activity
- "Onboard New Store" button → `/hq/stores/new`
- Row actions: view detail, activate/deactivate, edit settings

#### 2.4 Store Onboarding `/hq/stores/new`

Multi-step form:

1. **Store details** — name, island, address, contact email/phone, type (hq/branch)
2. **Module selection** — toggle which modules the store has access to
3. **Settings** — timezone, currency
4. **Initial store admin** — create the first `store_admin` user for this store (email + temp password sent via Firebase Auth)
5. Review + confirm → creates Firestore store doc + user doc atomically

#### 2.5 Store Drill-Down `/hq/stores/[storeId]`

When HQ clicks into a store, they see that store's dashboard, tickets, customers, etc. using the same existing components — just with `storeId` overridden in `StoreContext` to `selectedStoreId`.

Add a store selector banner at the top of the HQ layout when viewing a specific store: `"Viewing: Barbados Branch"` with an `×` to return to global view.

#### 2.6 Cross-Store Tickets `/hq/tickets`

Table with all tickets across all stores. Columns include a **Store** column. Filterable by store, status, technician, date range. Uses Firestore collection group query: `collectionGroup('tickets')`.

#### 2.7 Cross-Store Reports `/hq/reports`

- Tickets closed per store (bar chart, by month)
- Parts usage by store (stacked chart)
- Technician KPI aggregated across stores
- Island-level breakdown

---

### Phase 3 — Store Admin & Onboarding UX (~2 days)

**Goal:** Store admins can self-manage their store's users without HQ involvement for day-to-day operations.

#### 3.1 User Management within Store

`/users` page for `store_admin` shows only their store's users.  
Store admin can:

- Invite new users (call_admin, technician) → Firebase Auth invite email
- Disable/enable users
- Cannot create another `store_admin` (HQ only)
- Cannot see users from other stores

#### 3.2 Store Settings Page

`/settings` (new route, store_admin only) — edit store contact details, timezone, currency. Cannot change store type or status (HQ only).

#### 3.3 Module Guards

If a store has a module disabled (e.g., `modules.parts === false`), the sidebar link is hidden and the route redirects to dashboard. Enforced in the `(protected)` layout.

---

### Phase 4 — Feedback Features (existing backlog, now store-scoped)

These were already planned — implement them now using the multi-store architecture from the start:

1. **Closure checklist** — per-store configurable checklist items (stored on the store doc), enforced on ticket close
2. **Technician disclaimer modal** — configurable disclaimer text per store (or global default)
3. **Customer sign-off** — mobile signature page at `/tickets/[id]/sign-off`
4. **Parts bulk upload** — Excel/CSV import scoped to the store
5. **New reports** — daily, monthly, client activity, parts usage, technician KPI — all store-scoped; super admin sees global aggregate versions under `/hq/reports`

---

## 10. Component & Page Inventory

### Pages to CREATE

| Route                    | Role Access         | Purpose                       |
| ------------------------ | ------------------- | ----------------------------- |
| `/hq/dashboard`          | super_admin         | Global aggregate dashboard    |
| `/hq/stores`             | super_admin         | Store list & management       |
| `/hq/stores/new`         | super_admin         | Store onboarding wizard       |
| `/hq/stores/[storeId]`   | super_admin         | Store detail & drill-down     |
| `/hq/tickets`            | super_admin         | All tickets cross-store       |
| `/hq/reports`            | super_admin         | Cross-store aggregate reports |
| `/settings`              | store_admin         | Store settings                |
| `/tickets/[id]/sign-off` | public (token-auth) | Customer sign-off page        |

### Pages to MODIFY (add `storeId` context)

| Route          | Change                                                        |
| -------------- | ------------------------------------------------------------- |
| `/dashboard`   | Read `storeId` from `useStore()`, pass to data fetching       |
| `/tickets`     | Pass `storeId` to all server actions                          |
| `/customers`   | Pass `storeId` to all server actions                          |
| `/machines`    | Pass `storeId` to all server actions                          |
| `/parts`       | Pass `storeId` to all server actions                          |
| `/reports`     | Pass `storeId` to all server actions                          |
| `/technicians` | Filter users by `storeId`                                     |
| `/users`       | Filter by `storeId`, hide store creation from non-super_admin |

### Components to CREATE

| Component                                | Purpose                                                  |
| ---------------------------------------- | -------------------------------------------------------- |
| `components/store-selector.tsx`          | HQ store selector dropdown (in HQ layout header)         |
| `components/store-banner.tsx`            | "Viewing: Store Name" banner when HQ drills into a store |
| `components/hq-sidebar.tsx`              | HQ-specific sidebar with global nav links                |
| `components/store-onboarding-wizard.tsx` | Multi-step store creation form                           |
| `components/store-status-badge.tsx`      | active / inactive / onboarding badge                     |

---

## 11. Migration Script Specification

File: `scripts/migrate-to-multitenant.ts`

```typescript
// Pseudocode — to be implemented
async function migrate() {
  const HQ_STORE_ID = 'cr-hq-001';

  // Step 1: Create HQ store document
  await adminDb
    .collection('stores')
    .doc(HQ_STORE_ID)
    .set({
      name: 'Caribbean Roasters HQ',
      island: 'Trinidad',
      type: 'hq',
      status: 'active',
      modules: { tickets: true, customers: true, machines: true, parts: true, reports: true },
      settings: { timezone: 'America/Port_of_Spain', currency: 'TTD', locale: 'en-TT' },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  // Step 2: Copy flat collections into store subcollections
  for (const collection of ['tickets', 'customers', 'machines', 'parts']) {
    const docs = await adminDb.collection(collection).get();
    const batch = adminDb.batch();
    docs.forEach((doc) => {
      const ref = adminDb.collection('stores').doc(HQ_STORE_ID).collection(collection).doc(doc.id);
      batch.set(ref, doc.data());
    });
    await batch.commit();
    console.log(`Migrated ${docs.size} ${collection} documents`);
  }

  // Step 3: Update all users
  const users = await adminDb.collection('users').get();
  const batch = adminDb.batch();
  users.forEach((doc) => {
    const data = doc.data();
    const newRole = data.role === 'admin' ? 'store_admin' : data.role === 'management' ? 'super_admin' : data.role; // call_admin, technician unchanged
    const newStoreId = newRole === 'super_admin' ? null : HQ_STORE_ID;
    batch.update(doc.ref, { role: newRole, storeId: newStoreId, updatedAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
  console.log(`Updated ${users.size} users`);

  // Step 4: Verify counts match before deleting originals
  // (manual verification step — do not auto-delete)
}
```

**DO NOT delete the original flat collections until counts are verified manually.**

---

## 12. Key Design Decisions & Rationale

| Decision                                                              | Rationale                                                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Firestore subcollections (not a `storeId` field)                      | Security rules enforce tenancy at the DB level; no risk of accidental cross-store data exposure in queries |
| `storeId: null` for super_admin (not a special store)                 | Prevents super_admin from being accidentally constrained; cleaner type checking                            |
| Existing `/dashboard`, `/tickets` etc. URLs unchanged for store users | Zero retraining needed for existing users; store context is transparent                                    |
| HQ routes under `/hq/*`                                               | Clear separation; impossible for store users to accidentally navigate there; easy to middleware-guard      |
| Store-level module toggles                                            | Future-proofs for stores that only need ticketing without full parts management                            |
| Denormalize `storeName` on user doc                                   | Avoids an extra Firestore read just to show the store name in the UI                                       |
| Collection group query for cross-store views                          | Native Firestore feature; no fan-out needed; requires a composite index per collection                     |

---

## 13. Open Questions for Client

Before development begins, confirm the following with Caribbean Roasters:

1. **How many stores/branches are anticipated at launch?** (affects whether to set up indexing aggressively or lazily)
2. **Are technicians ever shared across stores?** (e.g., a technician from Trinidad dispatched to Barbados) — if yes, the `storeId: string` on a user becomes `storeIds: string[]` which adds
   complexity.
3. **Should parts inventory be shared or per-store?** (Currently specified as per-store — confirm this is correct before migration)
4. **Who manages the "closure checklist" template — is it the same for all stores or configurable per store?**
5. **Is customer sign-off required for all ticket types or only specific ones?**
6. **Currency/pricing:** Do reports need to show multi-currency comparisons or just local currency per store?

---

## 14. Development Order (Recommended)

```
Week 1:  Phase 0 (migration script + data migration)
         Phase 1.1–1.3 (types, store context, server actions refactor)
Week 2:  Phase 1.4–1.5 (auth layer, security rules)
         Phase 2.1–2.3 (HQ dashboard, store management, onboarding form)
Week 3:  Phase 2.4–2.7 (store drill-down, cross-store tickets & reports)
         Phase 3 (store admin UX, module guards, settings page)
Week 4:  Phase 4 (closure checklist, disclaimer, sign-off, parts bulk upload)
         Phase 4 continued (new reports — store-level + HQ aggregate)
```

---

_End of brief. This document is the authoritative specification for the multi-store architecture. All implementation decisions not covered here should default to the simplest approach and be flagged
for review._
