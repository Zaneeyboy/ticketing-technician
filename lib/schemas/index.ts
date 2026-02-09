import { z } from 'zod';

// User schemas
export const userRoleSchema = z.enum(['admin', 'call_admin', 'technician', 'management']);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: userRoleSchema,
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
export const machineTypeSchema = z.enum(['Crescendo', 'Espresso', 'Grinder', 'Other']);

export const createMachineSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  type: machineTypeSchema,
  serialNumber: z.string().min(1, 'Serial number is required'),
  installationDate: z.date().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
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
export const ticketStatusSchema = z.enum(['Open', 'Assigned', 'Closed']);
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
  machineType: z.enum(['Crescendo', 'Espresso', 'Grinder', 'Other']),
  serialNumber: z.string().min(1, 'Serial number is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  priority: ticketPrioritySchema,
});

export const createTicketSchema = z.object({
  machines: z.array(ticketMachineSchema).min(1, 'At least one machine is required'),
  issueDescription: z.string().min(10, 'Please provide a detailed description'),
  contactPerson: z.string().min(2, 'Contact person is required'),
  assignedTo: z.string().optional(),
  scheduledVisitDate: z.date().optional(),
  additionalNotes: z.string().optional(),
});

export const updateTicketSchema = z.object({
  assignedTo: z.string().optional(),
  issueDescription: z.string().min(10).optional(),
  contactPerson: z.string().min(2).optional(),
  additionalNotes: z.string().optional(),
  status: ticketStatusSchema.optional(),
  scheduledVisitDate: z.date().nullable().optional(),
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
  workPerformed: z.string().min(10, 'Please describe the work performed'),
  outcome: z.string().min(5, 'Please describe the outcome'),
  repairs: z.string().optional(),
  partsUsed: z.array(partUsedSchema).optional(),
  maintenanceRecommendation: z
    .object({
      date: z.date().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export const bulkWorkLogSchema = z.object({
  // Visit-level data (common across all machines)
  arrivalTime: z.date(),
  departureTime: z.date().optional(),
  hoursWorked: z.number().min(0.25, 'Hours worked must be at least 0.25').max(16, 'Hours worked cannot exceed 16 per shift'),

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
