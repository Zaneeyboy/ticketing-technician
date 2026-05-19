import { z } from 'zod';

// Invitation schemas
export const inviteUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['store_admin', 'call_admin', 'technician', 'manager']),
  storeId: z.string().nullable().optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(64, 'Invalid token'),
  name: z.string().min(2, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// User schemas
export const userRoleSchema = z.enum(['super_admin', 'manager', 'store_admin', 'call_admin', 'technician']);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: userRoleSchema,
  storeId: z.string().nullable().default(null),
});

// Store schemas
export const storeModulesSchema = z.object({
  tickets: z.boolean().default(true),
  customers: z.boolean().default(true),
  machines: z.boolean().default(true),
  parts: z.boolean().default(true),
  reports: z.boolean().default(true),
});

export const storeSettingsSchema = z.object({
  timezone: z.string().min(1, 'Timezone is required'),
  currency: z.string().min(1, 'Currency is required'),
  locale: z.string().min(1, 'Locale is required'),
});

export const createStoreSchema = z.object({
  name: z.string().min(2, 'Store name is required'),
  island: z.string().min(2, 'Island is required'),
  address: z.string().min(5, 'Address is required'),
  contactEmail: z.string().email('Invalid email'),
  contactPhone: z.string().min(7, 'Valid phone required'),
  // No 'type' field — all stores are operational branches
  status: z.enum(['active', 'inactive', 'onboarding']).default('onboarding'),
  modules: storeModulesSchema.default({ tickets: true, customers: true, machines: true, parts: true, reports: true }),
  settings: storeSettingsSchema.default({ timezone: 'America/Port_of_Spain', currency: 'TTD', locale: 'en-TT' }),
});

export const updateStoreSchema = createStoreSchema.partial();

// Store admin onboarding — creates store + sends invitation to initial store_admin
export const onboardStoreSchema = z.object({
  store: createStoreSchema,
  adminName: z.string().min(2, 'Admin name is required'),
  adminEmail: z.string().email('Invalid email'),
});

// Customer schemas
export const createCustomerSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactPerson: z.string().min(2, 'Contact person is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email('Invalid email address'),
  address: z.string().min(5, 'Address is required'),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Machine schemas
export const machineTypeSchema = z.string().min(1, 'Machine type is required');

export const machinePartSchema = z.object({
  partId: z.string().optional(),
  partName: z.string().min(1, 'Part name is required'),
  addedAt: z.date(),
});

export const createMachineSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  type: machineTypeSchema,
  serialNumber: z.string().min(1, 'Serial number is required'),
  installationDate: z.date().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  associatedParts: z.array(machinePartSchema).optional(),
});

export const updateMachineSchema = createMachineSchema.partial().extend({
  customerId: z.string().min(1, 'Customer is required'),
});

// Parts schemas
export const createPartSchema = z.object({
  name: z.string().min(2, 'Part name is required'),
  description: z.string().min(2, 'Description is required'),
  category: z.string().optional(),
  quantityInStock: z.number().int().min(0, 'Quantity cannot be negative'),
  minQuantity: z.number().int().min(0).optional(),
});

export const updatePartSchema = createPartSchema.partial();

// Ticket schemas
export const ticketStatusSchema = z.enum(['Open', 'Assigned', 'In Progress', 'Pending Parts', 'Signed Off', 'Closed']);
export const ticketPrioritySchema = z.enum(['Low', 'Medium', 'High', 'Urgent']);

export const partUsedSchema = z.object({
  partId: z.string(),
  partName: z.string(),
  quantity: z.number().min(1),
});

export const maintenanceRecommendationSchema = z.object({
  date: z.date(),
  notes: z.string().min(1),
});

// Multi-machine ticket support
export const ticketMachineSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  machineType: z.string().min(1, 'Machine type is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  priority: ticketPrioritySchema,
});

export const createTicketSchema = z.object({
  machines: z.array(ticketMachineSchema).min(1, 'At least one machine is required'),
  briefDescription: z.string().max(120, 'Brief description must be 120 characters or less').optional(),
  issueDescription: z.string().min(10, 'Please provide a detailed description'),
  internalNotes: z.string().optional(),
  // Legacy — still accepted for backwards compat
  additionalNotes: z.string().optional(),
  contactPerson: z.string().min(2, 'Contact person is required'),
  assignedTo: z.string().optional(),
  scheduledVisitDate: z.date().optional(),
});

export const updateTicketSchema = z.object({
  machines: z.array(ticketMachineSchema).min(1, 'At least one machine is required').optional(),
  assignedTo: z.string().optional(),
  briefDescription: z.string().max(120).optional(),
  issueDescription: z.string().min(10).optional(),
  internalNotes: z.string().optional(),
  additionalNotes: z.string().optional(),
  contactPerson: z.string().min(2).optional(),
  status: ticketStatusSchema.optional(),
  scheduledVisitDate: z.date().nullable().optional(),
});

// Closure checklist schema
export const closureChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  checked: z.boolean(),
});

// Customer sign-off schema
export const customerSignOffSchema = z.object({
  signedByName: z.string().min(2, 'Customer name is required'),
  signatureDataUrl: z.string().min(10, 'Signature is required'),
});

export const technicianUpdateSchema = z.object({
  arrivalTime: z.date().optional(),
  departureTime: z.date().optional(),
  hoursWorked: z.number().min(0.25, 'Hours worked must be at least 0.25').max(16, 'Hours worked cannot exceed 16 per shift').optional(),
  workPerformed: z.string().min(10, 'Please describe the work performed').optional(),
  outcome: z.string().min(5, 'Please describe the outcome').optional(),
  partsUsed: z.array(partUsedSchema).optional(),
  maintenanceRecommendation: maintenanceRecommendationSchema.optional(),
});

// Bulk work log schemas for multi-machine work logging
export const machineSpecificWorkSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  workPerformed: z.string().min(4, 'Please describe the work performed'),
  outcome: z.string().min(4, 'Please describe the outcome'),
  repairs: z.string().optional(),
  partsUsed: z.array(partUsedSchema).optional(),
  maintenanceRecommendation: z
    .object({
      date: z.coerce.date().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export const bulkWorkLogSchema = z.object({
  // Visit-level data (common across all machines)
  arrivalTime: z.coerce.date(),
  departureTime: z.coerce.date().optional(),
  hoursWorked: z.number().min(0.25, 'Hours worked must be at least 0.25').max(16, 'Hours worked cannot exceed 16 per shift'),
  checklistItems: z.array(z.number()).optional(),

  // Machine-specific work logs
  machineWorkLogs: z.array(machineSpecificWorkSchema).min(1, 'At least one machine work log is required'),
});

// Machine Work Log schemas (per-machine work documentation)
export const createMachineWorkLogSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  machineId: z.string().min(1, 'Machine ID is required'),
  arrivalTime: z.date(),
  departureTime: z.date(),
  hoursWorked: z.number().min(0.25, 'Hours worked must be at least 0.25').max(16, 'Hours worked cannot exceed 16 per shift'),
  workPerformed: z.string().min(10, 'Please describe the work performed'),
  outcome: z.string().min(5, 'Please describe the outcome'),
  partsUsed: z.array(partUsedSchema).optional(),
  maintenanceRecommendation: maintenanceRecommendationSchema.optional(),
});

// Scheduled Maintenance schemas
export const createScheduledMaintenanceSchema = z.object({
  machineId: z.string().min(1, 'Machine ID is required'),
  date: z.date(),
  notes: z.string().min(5, 'Maintenance notes are required'),
});

export const updateScheduledMaintenanceSchema = createScheduledMaintenanceSchema.partial();
