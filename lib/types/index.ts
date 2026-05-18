import { Timestamp } from 'firebase/firestore';

// Store types
export type StoreStatus = 'active' | 'inactive' | 'onboarding';
// No StoreType — the admin panel is not a store. Every /stores/{id} document is an operational branch.

export interface StoreModules {
  tickets: boolean;
  customers: boolean;
  machines: boolean;
  parts: boolean;
  reports: boolean;
}

export interface StoreSettings {
  timezone: string;
  currency: string;
  locale: string;
}

export interface Store {
  id: string;
  name: string;
  island: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  status: StoreStatus;
  modules: StoreModules;
  settings: StoreSettings;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Invitation types
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface Invitation {
  id: string; // same as the token — used as the Firestore document ID
  email: string;
  name: string;
  role: 'store_admin' | 'store_manager' | 'call_admin' | 'technician' | 'manager';
  storeId: string | null;
  storeName: string | null;
  invitedByUid: string;
  invitedByName: string;
  status: InvitationStatus;
  expiresAt: Date | Timestamp;
  acceptedAt?: Date | Timestamp | null;
  createdAt: Date | Timestamp;
}

// User types
export type UserRole = 'super_admin' | 'manager' | 'store_admin' | 'store_manager' | 'call_admin' | 'technician';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  storeId: string | null; // null for super_admin and manager
  storeName?: string; // denormalized
  isProtected?: boolean; // true for the primary store_admin of each store — only super_admin can delete/modify
  disabled?: boolean;
  internalPayRate?: number;
  chargeoutRate?: number;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Customer types
export interface Customer {
  id: string;
  companyName: string; // Required - company/organization name
  contactPerson: string; // Required - primary contact
  phone: string; // Required
  email: string; // Required
  address: string; // Required
  isDisabled?: boolean; // Optional - whether customer is disabled (soft delete)
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Machine types
/** Open string — any machine type is valid. Use MACHINE_TYPES for common suggestions. */
export type MachineType = string;

/**
 * Base machine/equipment types shown in dropdowns.
 * Not exhaustive — any string is accepted, and new types entered by admins
 * are stored per-store in Firestore and merged with this list at runtime.
 */
export const MACHINE_TYPES = [
  'iPilot Machine',
  'Brewer Machine',
  'Crescendo Machine',
  'Water Machine',
  'EGRO Machine',
  'Rancilio Espresso Machine',
  'Silvia Espresso Machine',
  'BUNN Grinder',
  'BUNN Kyro Grinder',
  'Samremo Grinder',
  'Nitron RMV',
  'BUNN Server',
  'Smartwave Brewer Machine',
  'Barista Tools',
  'BUNN Brewer Part',
  'BUNN Part',
  'iPilot Parts',
  'Rancilio Part',
  'Flo Jet Pump',
  'Misc. Part',
  'BUNN',
  'Espresso Part',
  'EGRO Part (Rancilio)',
] as const;

// Tracks parts that have been used on or are associated with a machine.
// Populated automatically when a work log records parts for that machine,
// and can also be set manually when creating/editing a machine.
export interface MachinePart {
  partId?: string; // Firestore part doc ID (if linked to the parts catalogue)
  partName: string; // Human-readable name — always present
  addedAt: Date | Timestamp;
}

export interface Machine {
  id: string;
  customerId: string;
  serialNumber: string; // Globally unique, required
  type: MachineType; // Required
  location?: string; // Optional - specific location at customer site
  installationDate?: Date | Timestamp;
  notes?: string;
  // Parts associated with this machine (auto-populated from work logs + manual entry)
  associatedParts?: MachinePart[];
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Parts types
export interface Part {
  id: string;
  name: string;
  description: string;
  category?: string;
  quantityInStock: number;
  minQuantity?: number;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Ticket Machine - represents a machine being serviced in a ticket
export interface TicketMachine {
  machineId: string;
  machineType: MachineType;
  serialNumber: string;
  customerId: string;
  customerName: string; // Denormalized
  priority: TicketPriority; // Priority for this specific machine
}

// Ticket types
export type TicketStatus = 'Open' | 'Assigned' | 'In Progress' | 'Pending Parts' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface StatusHistoryEntry {
  status: TicketStatus;
  changedAt: Date | Timestamp;
  changedByUid: string;
  changedByName: string;
}

export interface PartUsed {
  partId: string;
  partName: string;
  quantity: number;
}

export interface MaintenanceRecommendation {
  date: Date | Timestamp;
  notes: string;
}

export interface ScheduledMaintenance extends MaintenanceRecommendation {
  id?: string;
  machineId: string;
  reminderDate?: Date | Timestamp; // Auto-calculated (2 weeks before maintenance date)
  reminderSent?: boolean;
  sentTo?: string; // Admin user ID
}

export interface MediaAttachment {
  url: string;
  filename: string;
  uploadedAt: Date | Timestamp;
  uploadedBy: string;
}

// Machine Work Log - per-machine work logged by technician
export interface MachineWorkLog {
  id: string;
  ticketId: string;
  machineId: string;
  recordedBy: string; // Technician user ID
  arrivalTime?: Date | Timestamp;
  departureTime?: Date | Timestamp;
  workPerformed?: string; // Work done specifically for this machine
  outcome?: string; // Result/status for this machine
  partsUsed?: PartUsed[];
  mediaAttachments?: MediaAttachment[];
  maintenanceRecommendation?: ScheduledMaintenance;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// Main Ticket - updated for multiple machines
export interface Ticket {
  id: string;
  ticketNumber: string;
  machines: TicketMachine[]; // Array of machines being serviced

  // Descriptions — three-tier system (Jason Abraham feedback)
  briefDescription?: string; // One-liner shown in list/card views (optional; falls back to issueDescription)
  issueDescription: string; // Full public issue description (customer-facing in reports)
  internalNotes?: string; // Internal-only notes visible only to admins/techs (replaces additionalNotes)

  // Legacy — kept for backwards compatibility; new tickets should use internalNotes
  additionalNotes?: string;

  contactPerson: string; // Person who reported the issue
  assignedTo?: string; // Primary technician (optional - can be assigned later)
  assignedToName?: string; // Denormalized
  status: TicketStatus;
  scheduledVisitDate?: Date | Timestamp; // Scheduled date/time for technician site visit
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  closedAt?: Date | Timestamp;

  // Closure checklist — mandatory items that must be checked before ticket can close
  closureChecklist?: ClosureChecklistItem[];

  // Technician legal disclaimer — must be accepted before closing a ticket
  disclaimerAccepted?: boolean;
  disclaimerAcceptedAt?: Date | Timestamp;
  disclaimerAcceptedBy?: string; // Technician UID

  // Customer sign-off — digital signature captured on mobile
  customerSignOff?: CustomerSignOff;

  // Sign-off link — generated when technician completes work; shared with customer
  signOffLink?: {
    token: string;
    createdAt: Date | Timestamp;
    expiresAt: Date | Timestamp; // createdAt + 72 hours (3 days)
  };

  // Admin force-close fields (populated when admin closes without customer sign-off)
  forceClosedBy?: string; // admin UID
  forceClosedByName?: string;

  // Metadata
  createdBy: string;

  // Status audit trail — appended on every status change
  statusHistory?: StatusHistoryEntry[];
}

// Closure checklist item — each ticket has a set of mandatory steps before closing
export interface ClosureChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedAt?: Date | Timestamp;
  checkedBy?: string; // UID of user who checked it
}

// Customer sign-off — captured on the mobile sign-off page
export interface CustomerSignOff {
  signedAt: Date | Timestamp;
  signedByName: string; // Name typed by customer
  signatureDataUrl: string; // base64-encoded PNG of drawn signature
  satisfactionConfirmed: boolean; // Checkbox: "I confirm work was completed to my satisfaction"
  comments?: string | null; // Optional comments from customer
}
