import type { TicketPriority, TicketStatus } from '@/lib/types';

export interface ReportTicketMachine {
  machineId: string;
  customerId: string;
  customerName: string;
  machineType: string;
  serialNumber: string;
  priority?: TicketPriority;
}

export interface ReportTicket {
  id: string;
  ticketNumber: string;
  status: TicketStatus;
  createdAt: string | null;
  closedAt?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  issueDescription?: string | null;
  machines: ReportTicketMachine[];
}

export interface ReportWorkLogPart {
  partId: string;
  partName: string;
  quantity: number;
}

export interface ReportWorkLog {
  id: string;
  ticketId: string;
  machineId: string;
  recordedBy?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  hoursWorked?: number | null;
  workPerformed?: string | null;
  outcome?: string | null;
  repairs?: string | null;
  partsUsed?: ReportWorkLogPart[];
}

export interface ReportMachine {
  id: string;
  customerId: string;
  type: string;
  serialNumber: string;
}

export interface ReportCustomer {
  id: string;
  companyName: string;
}

export interface ReportTechnician {
  id: string;
  name: string;
}

export interface ReportPart {
  id: string;
  name: string;
  category?: string | null;
}

export interface ReportBaseData {
  tickets: ReportTicket[];
  workLogs: ReportWorkLog[];
  customers: ReportCustomer[];
  machines: ReportMachine[];
  technicians: ReportTechnician[];
  parts: ReportPart[];
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  statuses: TicketStatus[];
  technicianIds: string[];
  customerIds: string[];
  partNames: string[];
  partCategories: string[];
}
