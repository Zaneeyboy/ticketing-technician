# HQ Platform Brief — Admin Panel & User Management

## Caribbean Roasters Field Service Platform

**Prepared for:** Tech Dynamics  
**Client:** Caribbean Roasters Ltd  
**Date:** May 2026  
**Status:** Pre-development specification — extends MULTI_STORE_BRIEF.md

---

## 1. Purpose of This Brief

The multi-store architecture brief established how data is partitioned across stores and how the HQ layer sits above them. This brief goes deeper into three specific areas that were left
underspecified:

1. **The admin panel experience** — what the HQ user sees, how it's structured, and how it goes beyond just stores, tickets, and reports. The admin panel is not itself a store — it is a management
   interface whose content is drawn entirely from the stores beneath it.
2. **User management as a first-class concern** — a dedicated people layer across the platform, not just a sidebar item in each store.
3. **Access, roles, and onboarding** — how new users enter the system now that open self-signup is being retired.

These three areas are tightly coupled. Getting the role model right determines what the signup/invitation flow looks like. Getting the invitation flow right determines what the HQ user management
module needs to expose. All of it feeds into what the admin panel dashboard and navigation needs to prioritize.

---

## 2. Role Redesign

### 2.1 Current Roles (to be superseded)

```
super_admin | store_admin | call_admin | technician
```

The `call_admin` and `technician` roles were never clearly differentiated at the product level from the perspective of how they enter the system. Both previously relied on the same open signup page.
This is being removed.

### 2.2 Proposed Role Hierarchy

```typescript
type UserRole =
  | 'super_admin' // HQ — god mode, full platform control
  | 'manager' // HQ-adjacent — read-only cross-store visibility, export access
  | 'store_admin' // Per-store — protected account, assigned at store creation
  | 'call_admin' // Per-store — invite-only, creates and manages tickets
  | 'technician'; // Per-store — invite-only, executes and closes tickets
```

### 2.3 Role Definitions

#### `super_admin`

- **Scope:** Entire platform. No store restriction.
- **Capabilities:**
  - Create, edit, activate, deactivate any store
  - Create the `store_admin` account for any store (mandatory at store creation)
  - Create and manage `manager` accounts (HQ-level only)
  - View and manage all users across all stores
  - Disable, re-enable, or permanently delete any user — including `store_admin` accounts (the only role that can do this)
  - Full access to all HQ modules: stores, tickets, reports, users, analytics
  - Change a user's role at any scope
- **Created via:** Direct creation in code/seeding or via another `super_admin` from the HQ user management panel. Not accessible via signup.
- **Count:** Typically 1–3 platform-wide. Should be audited and kept minimal.

---

#### `manager` _(new role)_

- **Scope:** Admin panel — read-only. The `manager` role has no store assignment (`storeId: null`) and accesses only the aggregated, cross-store views within the `/hq/*` routes. They see the same data
  as `super_admin` but cannot take any write action.
- **Capabilities:**
  - View the HQ dashboard (aggregate KPIs)
  - View all stores and their status
  - View cross-store ticket reports
  - View all-user listing with role information
  - **Export** reports (CSV/PDF) from any module they can view
  - **Cannot** create, edit, delete, or manipulate any entity (stores, users, tickets, settings)
  - **Cannot** see any HQ management actions (no "Create Store", no "Disable User" buttons)
  - **Cannot** interact with any store's operational modules (tickets, customers, machines, parts) — HQ aggregate views only
- **Created via:** HQ user management panel by `super_admin` only.
- **Rationale:** Regional managers, C-suite, or stakeholders who need visibility and the ability to pull reports on demand without the risk of accidentally modifying platform state.

---

#### `store_admin`

- **Scope:** Their assigned store only.
- **Capabilities:**
  - Full access to their store's modules: tickets, customers, machines, parts, technicians, reports
  - Manage users within their store (invite `call_admin` and `technician` accounts)
  - Disable users within their store (cannot delete)
  - View their store's settings (cannot change island or status — admin panel only)
  - Cannot see other stores or HQ-level data
- **Created via:** Automatically during store creation by `super_admin`. One is required per store. A store cannot be created without also creating its first `store_admin`.
- **Account protections:**
  - A `store_admin` account **cannot be deleted** by anyone other than `super_admin`
  - A `store_admin` account **cannot be disabled** by `call_admin` or `technician` — only `super_admin` or another `store_admin` of the same store
  - Only `super_admin` can change a `store_admin`'s role or move them between stores
  - If a store has only one `store_admin` and a `super_admin` attempts to delete them, the platform must warn and require a replacement `store_admin` to be designated before deletion completes
- **Rationale:** The `store_admin` is the anchor of a store. Losing them through accidental deletion or manipulation by store-level users would leave a store orphaned.

---

#### `call_admin`

- **Scope:** Their assigned store only.
- **Capabilities:**
  - Create and manage tickets
  - Create and manage customers
  - Assign tickets to technicians
  - View machines and parts (read-only, cannot modify)
  - View their own profile
- **Created via:** Invitation only — `store_admin` sends an invitation from within the store's user management panel. Invitation expires after 72 hours.
- **Cannot:** Create other users, change any settings, access reports.

---

#### `technician`

- **Scope:** Their assigned store only.
- **Capabilities:**
  - View tickets assigned to them
  - Update ticket status (In Progress, Pending Part, Closed)
  - Log parts used on a ticket
  - Submit closure details (checklist, notes, signature capture)
  - View their own profile
- **Created via:** Invitation only — same flow as `call_admin`, initiated by `store_admin`.
- **Cannot:** Create tickets, see all tickets in the store (only assigned), access customer data directly, access reports.

---

### 2.4 Permission Matrix

| Action                            | super_admin | manager | store_admin | call_admin | technician |
| --------------------------------- | :---------: | :-----: | :---------: | :--------: | :--------: |
| Create store                      |      ✓      |    —    |      —      |     —      |     —      |
| Edit store settings               |      ✓      |    —    | ✓ (limited) |     —      |     —      |
| Deactivate store                  |      ✓      |    —    |      —      |     —      |     —      |
| View all stores (HQ)              |      ✓      |    ✓    |      —      |     —      |     —      |
| Create store_admin                |      ✓      |    —    |      —      |     —      |     —      |
| Delete store_admin                |      ✓      |    —    |      —      |     —      |     —      |
| Invite call_admin / technician    |      ✓      |    —    |      ✓      |     —      |     —      |
| Disable user (same store)         |      ✓      |    —    |      ✓      |     —      |     —      |
| Delete user                       |      ✓      |    —    |      —      |     —      |     —      |
| View all users (HQ)               |      ✓      |    ✓    |      —      |     —      |     —      |
| View store users                  |      ✓      |    ✓    |      ✓      |     —      |     —      |
| Create ticket                     |      ✓      |    —    |      ✓      |     ✓      |     —      |
| View all tickets (HQ cross-store) |      ✓      |    ✓    |      —      |     —      |     —      |
| View store tickets                |      ✓      |    —    |      ✓      |     ✓      |  own only  |
| Export reports (HQ)               |      ✓      |    ✓    |      —      |     —      |     —      |
| Export reports (store)            |      ✓      |    —    |      ✓      |     —      |     —      |
| View HQ dashboard                 |      ✓      |    ✓    |      —      |     —      |     —      |
| View store dashboard              |      ✓      |    —    |      ✓      |     ✓      |     ✓      |

---

## 3. Signup & Invitation Flow Redesign

### 3.1 Decision: Retire Open Signup

The current `/signup` page allows anyone with the URL to create any role — including `super_admin`. This was useful for initial bootstrapping but is not appropriate for a production platform. The page
is to be removed (or locked behind a flag) once the invitation flow is in place.

**The replacement model:**

- `super_admin` and `manager` accounts are created from within the HQ user management panel
- `store_admin` accounts are created during store creation, not standalone
- `call_admin` and `technician` accounts are created via invitation from the store's user management panel

No user will self-register.

### 3.2 Invitation Flow

When a `store_admin` (or `super_admin`) adds a new user:

1. They fill in the user's name, email address, and role in an "Invite User" modal
2. The system creates a **pending invitation record** in Firestore:
   ```
   /invitations/{invitationId}
     email: string
     role: UserRole
     storeId: string
     storeName: string
     invitedBy: string (uid)
     status: 'pending' | 'accepted' | 'expired'
     token: string (cryptographically random, 32 bytes)
     expiresAt: Timestamp (72 hours from now)
     createdAt: Timestamp
   ```
3. A **Firebase Auth "set password" link** or a custom invitation email (via Firebase Extensions or a transactional email service) is sent to the email address containing a unique link:
   `https://app.domain.com/join?token={token}`
4. The invitee clicks the link, lands on `/join`, and is prompted to set their password and optionally confirm their name. No role or store selection — those are pre-determined by the invitation.
5. On submit, a Firebase Auth user is created (or linked if the email exists), the Firestore `users/{uid}` doc is created with the pre-assigned role and storeId, and the invitation is marked
   `accepted`.
6. The invitee is redirected to their store dashboard.

**Expired invitations:** A background function (Firebase Scheduled Function or Next.js route handler polling) marks invitations as `expired` after 72 hours. The `super_admin` or `store_admin` can
resend an invitation, generating a new token and resetting the expiry.

**Invitation management UI:** The store's Users page shows a "Pending Invitations" section listing unaccepted invitations with a "Resend" and "Cancel" action.

### 3.3 Transitional Option (if invitation infrastructure is not yet ready)

Until the email invitation flow is built, allow a **"Create User Directly"** option from the store's user panel where the admin sets the email and a temporary password. The user is created in Firebase
Auth immediately and added to Firestore with the correct storeId and role. The admin must share the credentials out-of-band. This bypasses email but keeps signup off the public web.

This is a short-term workaround. The invitation flow should replace it.

### 3.4 What Happens to `/signup`

Phase 1: Restrict the signup page to `super_admin` creation only — a single, hard-coded `allowedRoles` check that only permits `super_admin` to be created if no `super_admin` exists yet (bootstrapping
guard). All other role options are removed from the form.

Phase 2: Remove `/signup` entirely. Add it back as a hidden admin-only route (`/admin/bootstrap`) protected by an environment variable flag, for disaster recovery only.

---

## 4. HQ Admin Panel — Module Expansion

> **Architectural note:** The admin panel (`/hq/*`) is not a store. It has no `/stores/hq` Firestore document and no operational data of its own. Every number, ticket, or user shown in the admin panel
> is read from real stores via aggregated queries. Creating a store from the admin panel does not create an entry "for" the admin panel — it creates an independent, fully operational branch store.

### 4.1 Current HQ Modules (from MULTI_STORE_BRIEF.md Phase 2)

- `/hq/dashboard` — aggregate KPIs
- `/hq/stores` — store list and management
- `/hq/stores/new` — store onboarding
- `/hq/stores/[storeId]` — store drill-down
- `/hq/tickets` — cross-store ticket view
- `/hq/reports` — cross-store aggregate reports

### 4.2 Missing: People & Users Module

The HQ layer has no visibility into the humans operating the platform. This is critical for:

- Auditing who is active across which stores
- Spotting orphaned accounts (user left but account wasn't disabled)
- Coordinating role changes when someone moves between stores
- Giving management (`manager` role) a headcount view

**Add:** `/hq/users` — the People module.

#### `/hq/users` — HQ People Panel

**Visible to:** `super_admin`, `manager` (read-only)

**Features:**

1. **All Users Table** (default view)
   - Columns: Name, Email, Role (badge), Store Assigned, Status (Active/Disabled), Last Login, Date Created
   - Filterable by: Role, Store, Status (Active/Disabled/Pending Invitation)
   - Sortable by: Name, Role, Store, Created Date
   - Searchable: name or email fuzzy search

2. **Role Tabs** (quick filter across the top)
   - All | Store Admins | Call Admins | Technicians | Managers
   - Each tab shows only that role's users with relevant column set

3. **Per-User Actions** (`super_admin` only)
   - View profile
   - Edit name, email
   - Change role (guarded — cannot elevate to `super_admin` carelessly; confirmation required)
   - Move to a different store (only for `call_admin` and `technician`)
   - Disable account (suspends access immediately)
   - Enable account
   - Delete account (confirmation dialog; hard delete from Auth + Firestore)
   - Resend invitation (if status is "Pending Invitation")

4. **Create User Button** (`super_admin` only)
   - Opens the same invitation flow as inside a store panel, but with store selector and role selector
   - For `store_admin`: creates the account immediately (no invitation flow — store admin accounts are provisioned directly)
   - For `manager`: creates account immediately with HQ scope (no store assignment)
   - For `call_admin` / `technician`: sends invitation to the specified store

5. **Export** (`super_admin` + `manager`)
   - Download user list as CSV: name, email, role, store, status, created date

#### `/hq/users/[uid]` — User Detail Page

- Full profile view
- Activity log (last login, recent actions — if audit logging is implemented)
- Assigned store with link to that store's detail page
- Edit controls for `super_admin`

---

### 4.3 Store Creation Flow — Full Specification

Store creation must be a guarded, multi-step wizard — not a simple form — because it has side effects that cannot be undone easily (creating protected accounts, Firestore documents).

**Route:** `/hq/stores/new`

**Step 1: Store Details**

- Store name (required)
- Island / territory (dropdown: Trinidad, Barbados, Jamaica, Guyana, St. Lucia, Grenada, Other)
- Address
- Contact email
- Contact phone _(No store type field — every store created here is an operational branch store. The admin panel itself is not created here and has no Firestore document.)_
- Status: defaults to `onboarding`; can be changed to `active` at step 4

**Step 2: Module Selection**

- Toggle checkboxes: Tickets, Customers, Machines, Parts, Reports
- Minimum: Tickets must always be enabled

**Step 3: Store Settings**

- Timezone (dropdown, defaults to island-appropriate)
- Currency (dropdown: TTD, BBD, JMD, GYD, XCD)
- Locale

**Step 4: Store Admin Account** _(mandatory — cannot skip)_

- First name, Last name
- Email address
- The system will send a set-password invitation to this email OR allow the `super_admin` to set a temporary password directly
- Clearly labeled: _"This account cannot be deleted by store-level users. Only a Super Admin can modify or remove it."_

**Step 5: Review & Confirm**

- Summary of all entered data
- Warning: _"Creating this store will send an account setup email to {email}. This action cannot be undone without Super Admin intervention."_
- Confirm button

**On submission:**

1. Create `/stores/{newStoreId}` Firestore document
2. Create Firebase Auth user for the `store_admin`
3. Create `/users/{uid}` Firestore document with role `store_admin`, storeId set to the new store
4. Send the invitation/set-password email
5. Redirect to `/hq/stores/{newStoreId}` (the new store's detail page)
6. Revalidate `/hq/stores` listing

**Error handling:**

- If the email is already in use by a Firebase Auth user: prompt to either link the existing user to this store or use a different email
- If Firestore write fails after Auth user creation: rollback Auth user (delete it) before showing error

---

### 4.4 HQ Navigation Structure (revised)

```
HQ Sidebar
├── Dashboard          /hq/dashboard
├── Stores             /hq/stores
├── Tickets            /hq/tickets
├── Reports            /hq/reports
├── People             /hq/users           ← NEW
└── Settings           /hq/settings        ← (future: platform-wide settings)
```

The People link is visible to both `super_admin` (full read/write) and `manager` (read-only). The "Settings" link is `super_admin` only.

---

## 5. UX & Experience Improvements

### 5.1 Post-Login Experience (First Impression)

Currently the user is dropped into a flat dashboard with cards. The experience should feel more purposeful and role-aware.

**Proposed improvements:**

#### Contextual Welcome State

On first login (or when the dashboard has no data), show a role-appropriate "Getting Started" panel instead of empty cards:

- `store_admin` (new store, no data): _"Your store is set up. Start by adding your first customer, then log your first ticket."_ with CTA buttons.
- `call_admin` (no tickets yet): _"You're ready to go. Create your first ticket to get started."_
- `technician` (no assigned tickets): _"No tickets assigned yet. Check back soon."_ with a note about who to contact.
- `super_admin` (new platform, no stores): _"Welcome to Caribbean Roasters HQ. Create your first store to get started."_ with a large CTA.

#### Stat Cards Should Pulse / Animate In

Rather than static numbers on mount, the KPI cards should count up from 0 to their value over ~800ms. This gives the sense of a live, loaded system rather than a static report.

#### HQ Dashboard — Richer Data Story

Current cards: Active Stores, Open Tickets, Assigned Tickets, Closed Tickets.

Proposed additions:

- **Overdue Tickets** — tickets open for more than X days (configurable threshold)
- **Response Time Avg** — average time from ticket creation to first assignment (last 30 days)
- **Top Performing Store** — store with highest close rate this month
- **Activity Feed** — live or recent stream of ticket events across stores (last 10 actions: "Barbados — Ticket #44 closed by Marco A.")

#### Store Drill-Down Banner

When a `super_admin` drills into a specific store (`/hq/stores/[storeId]`), display a persistent top banner:

```
┌─────────────────────────────────────────────────────────┐
│ 👁 Viewing: Barbados Branch   [Return to HQ Overview]   │
└─────────────────────────────────────────────────────────┘
```

This makes it unambiguous whether you are viewing global or store-scoped data.

### 5.2 Visual Hierarchy in HQ

The HQ sidebar is currently identical in weight to the store sidebar. Given that `super_admin` has much broader responsibilities, the HQ interface should visually communicate authority and scope.

**Proposed:**

- HQ sidebar uses the dark navy background (already in the brand palette `oklch(0.17 0.01 240)`)
- Store sidebar uses a slightly lighter variant to visually differentiate the scope
- HQ pages use a subtle top bar accent in the brand primary blue `#007CB5`
- Module icons in HQ sidebar are slightly larger / bolder than store sidebar
- Page titles in HQ always include the scope: _"All Tickets — Cross-Store"_, _"People — All Stores"_

### 5.3 Users & People Page — UX Details

The `/hq/users` page should not feel like a raw data table. Improvements:

- **Role badges** use distinct colors per role:
  - `super_admin` — deep blue (brand primary)
  - `manager` — purple
  - `store_admin` — teal
  - `call_admin` — amber
  - `technician` — slate/neutral

- **Status indicators** — a colored dot next to each name:
  - Green = Active
  - Red = Disabled
  - Yellow = Pending Invitation

- **Store pills** — the store assignment shows as a clickable pill that navigates to `/hq/stores/[storeId]`

- **Inline disable/enable toggle** — rather than a modal for a common operation like disabling a user, an inline switch on the row with a single confirmation tooltip.

---

## 6. Store-Level User Management

### 6.1 `/users` (store scope — store_admin view)

The existing `/users` page in the store dashboard should be elevated into a proper User Management module:

**Sections:**

1. **Team Members** — list of all `call_admin` and `technician` users in this store
2. **Pending Invitations** — invitations sent but not yet accepted
3. **Inactive** — disabled accounts that still exist

**Actions available to `store_admin`:**

- Invite new user (call_admin or technician) — opens invitation modal
- Disable user (soft delete — suspends access, account retained)
- Re-enable user
- Resend invitation (for pending)
- Cancel invitation (for pending)
- Cannot: Create another `store_admin`, delete any user, change a user's store

**Actions NOT available to `store_admin` (HQ only):**

- Delete user permanently
- Change role to/from `store_admin`
- Move user to a different store

### 6.2 User Cannot See Other Store's Users

Firestore rules enforce this. The store-level `/users` server action filters by `storeId` at the query level, not just in the UI.

---

## 7. Data Model Additions

### 7.1 Invitations Collection

```
/invitations/{invitationId}
  email: string
  name: string                     ← pre-filled display name
  role: 'call_admin' | 'technician'
  storeId: string
  storeName: string                ← denormalized for email display
  invitedByUid: string
  invitedByName: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  token: string                    ← 32-byte random hex, single-use
  expiresAt: Timestamp
  acceptedAt: Timestamp | null
  createdAt: Timestamp
```

**Security rules for invitations:**

- Anyone can read a specific invitation by token (for the `/join` page) — but only the token field and status need to be readable without auth
- Only `super_admin` and `store_admin` (of the matching store) can create invitations
- Only `super_admin` can delete invitations
- The `/join` route handler validates the token server-side (Admin SDK) and never exposes other invitation records

### 7.2 Updated Role Type

```typescript
type UserRole = 'super_admin' | 'manager' | 'store_admin' | 'call_admin' | 'technician';
```

### 7.3 Updated User Type

```typescript
interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  storeId: string | null; // null for super_admin and manager
  storeName?: string; // denormalized
  isProtected?: boolean; // true for the primary store_admin of each store
  disabled: boolean;
  lastLoginAt?: Date; // populated from Firebase Auth metadata
  createdAt: Date;
  updatedAt: Date;
}
```

The `isProtected` flag on a user document is set to `true` when a `store_admin` is created during store creation. Any deletion or role-change action on a `isProtected === true` user requires
`super_admin` auth and an explicit override confirmation.

---

## 8. Phased Implementation Plan (HQ Expansion)

This extends Phase 2 and Phase 3 from MULTI_STORE_BRIEF.md.

### Phase 2B — HQ People Module (~2 days)

> Prerequisite: Phase 1 and Phase 2 from MULTI_STORE_BRIEF.md complete.

- Add `/hq/users` page with all-users table, role tabs, search, filter
- Add `/hq/users/[uid]` profile detail page
- Add `manager` role to `UserRole` type, role guards, and nav guards
- Add HQ People sidebar link (visible to `super_admin` and `manager`)
- Add disable/enable user actions (server action in `lib/actions/users.ts`)
- Add role-colored badges and status indicators
- Export CSV server action for user list

### Phase 2C — Invitation System (~3 days)

- Add `/invitations` Firestore collection + schema
- Add `/join` page — accepts token query param, validates server-side, shows set-password form
- Add `inviteUser` server action (creates invitation record, sends email via Firebase Auth `generateEmailVerificationLink` or transactional email)
- Add `acceptInvitation` server action (creates Auth user + Firestore user doc, marks invitation accepted)
- Add `cancelInvitation` and `resendInvitation` server actions
- Add Pending Invitations section to `/users` (store level) and `/hq/users`
- Remove all role options except `super_admin` from the public `/signup` page (bootstrapping guard)

### Phase 2D — Store Creation Wizard (~2 days)

> Replaces the existing basic `/hq/stores/new` page.

- Multi-step wizard with progress indicator (5 steps)
- Step 4: Store Admin account creation with protected-flag logic
- Atomic creation: store doc + auth user + user doc in a single server action with rollback on failure
- Redirect to new store detail page on success

### Phase 3B — Store-Level User Management UX (~1 day)

- Elevate `/users` store page to full Team Management page
- Add invitation send/resend/cancel UI
- Add inline disable/enable toggle
- Add "Pending Invitations" table section

### Phase 4 — Signup Page Retirement

- Remove `call_admin`, `technician`, `store_admin`, `manager` options from `/signup`
- Add bootstrapping guard: only allow signup if zero `super_admin` users exist in the system
- Eventually replace with `/admin/bootstrap` hidden route

---

## 9. Open Questions for Client Sign-Off

Before implementation, the following decisions need to be confirmed:

| #   | Question                                                                                                                      | Default Assumption                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Should `manager` accounts have any store-level drill-down access (read-only into a specific store's tickets)?                 | No — HQ aggregate views only                           |
| 2   | Can a `store_admin` invite another `store_admin` for their own store (co-admin)?                                              | No — HQ only creates `store_admin` accounts            |
| 3   | Invitation email: use Firebase Auth's built-in email templates or integrate a transactional email service (SendGrid, Resend)? | Firebase Auth built-in (simpler, launch-ready)         |
| 4   | Should invitation expiry be 72 hours or configurable per store?                                                               | Fixed 72 hours platform-wide                           |
| 5   | When a `store_admin` is the last admin of a store and HQ wants to remove them, require designating a replacement first?       | Yes — platform blocks deletion with a warning          |
| 6   | Should `technician` be able to see all tickets in their store, or only assigned ones?                                         | Only assigned (current assumption)                     |
| 7   | Does the `/join` page set a password, or does Firebase Auth send its own link?                                                | Custom `/join` page (better UX, brand control)         |
| 8   | Should the `manager` role appear in the store-level user listings for stores they can "see"?                                  | No — manager is HQ-scoped and invisible at store level |

---

## 10. Summary of Changes from MULTI_STORE_BRIEF.md

| Area                     | Previous Brief           | This Brief                                                                                       |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------ |
| Roles                    | 4 roles                  | 5 roles (adds `manager`)                                                                         |
| HQ modules               | Stores, Tickets, Reports | + **People / Users**                                                                             |
| Store creation           | Basic form               | Multi-step wizard, mandatory `store_admin`, rollback safety                                      |
| `store_admin` protection | Not specified            | Cannot be deleted by store-level roles; `isProtected` flag; requires replacement before deletion |
| Signup                   | Open (all roles)         | Restricted to bootstrapping only; all other roles via invitation                                 |
| Invitation system        | Not specified            | Full invitation lifecycle with token, expiry, resend, cancel                                     |
| UX                       | Not specified            | Contextual welcome states, animated stats, scope banners, role-colored badges                    |
| `manager` role           | Not present              | Read-only HQ access, export capability, no manipulation                                          |
