import { Timestamp } from 'firebase/firestore';

// User types
export type UserRole = 'admin' | 'call_admin' | 'technician' | 'management';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
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
export type MachineType = 'Crescendo' | 'Espresso' | 'Grinder' | 'Other';

export interface Machine {
  id: string;
  customerId: string;
  serialNumber: string; // Globally unique, required
  type: MachineType; // Required
  location?: string; // Optional - specific location at customer site
  installationDate?: Date | Timestamp;
  notes?: string;
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
export type TicketStatus = 'Open' | 'Assigned' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

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
  issueDescription: string; // Overall issue description
  contactPerson: string; // Person who reported the issue
  assignedTo?: string; // Primary technician (optional - can be assigned later)
  assignedToName?: string; // Denormalized
  status: TicketStatus;
  scheduledVisitDate?: Date | Timestamp; // Scheduled date/time for technician site visit
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  closedAt?: Date | Timestamp;

  // Additional notes from technician (job-level, not machine-specific)
  additionalNotes?: string;

  // Metadata
  createdBy: string;
}
