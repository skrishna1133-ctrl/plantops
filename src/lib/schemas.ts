import { z } from "zod";

export const incidentReportSchema = z.object({
  reporterName: z.string().min(2, "Name must be at least 2 characters"),
  plant: z.enum(["plant-a", "plant-b"], {
    message: "Please select a plant",
  }),
  category: z.enum(["safety", "equipment", "quality", "environmental"], {
    message: "Please select a category",
  }),
  description: z.string().min(10, "Description must be at least 10 characters"),
  criticality: z.enum(["minor", "major", "critical"], {
    message: "Please select criticality level",
  }),
  incidentDate: z.string().min(1, "Please provide the incident date and time"),
});

export type IncidentReportInput = z.infer<typeof incidentReportSchema>;

export interface IncidentReport extends IncidentReportInput {
  id: string;
  ticketId: string;
  status: "open" | "in_progress" | "resolved";
  photoUrl?: string;
  createdAt: string;
}

// ─── Checklists ───

export const checklistTypes = [
  "shift_start",
  "shift_end",
  "line_machine_start",
  "maintenance",
  "safety",
  "quality_incoming",
  "quality_outgoing",
] as const;

export type ChecklistType = (typeof checklistTypes)[number];

export const checklistTypeLabels: Record<ChecklistType, string> = {
  shift_start: "Shift Start",
  shift_end: "Shift End",
  line_machine_start: "Line/Machine Start",
  maintenance: "Maintenance",
  safety: "Safety",
  quality_incoming: "Quality (Incoming)",
  quality_outgoing: "Quality (Outgoing)",
};

export const itemTypes = ["checkbox", "pass_fail", "numeric", "text"] as const;
export type ItemType = (typeof itemTypes)[number];

export const itemTypeLabels: Record<ItemType, string> = {
  checkbox: "Yes / No",
  pass_fail: "Pass / Fail",
  numeric: "Numeric",
  text: "Text",
};

export interface TemplateItem {
  id: string;
  title: string;
  type: ItemType;
  description?: string;
  required: boolean;
  unit?: string;
  numericMin?: number;
  numericMax?: number;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  type: ChecklistType;
  description?: string;
  items: TemplateItem[];
  active: boolean;
  createdAt: string;
}

export interface ItemResponse {
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
  checkboxValue?: boolean;
  passFail?: "pass" | "fail";
  numericValue?: number;
  numericMin?: number;
  numericMax?: number;
  numericUnit?: string;
  textValue?: string;
}

export interface ChecklistSubmission {
  id: string;
  submissionId: string;
  templateId: string;
  templateTitle: string;
  templateType: ChecklistType;
  personName: string;
  shift: "day" | "night";
  responses: ItemResponse[];
  notes?: string;
  submittedAt: string;
}

// ─── Quality Documents ───

export type QualityDocStatus = "draft" | "worker_filled" | "complete";

export interface QualityDocRow {
  serialNumber: number;
  grossWeight?: number;
  netWeight?: number;
  bulkDensityGcc?: number;
  bulkDensityLbcc?: number;
  metalContamGrams?: number;
  metalContamPct?: number;
  photoUrl?: string;
}

export interface QualityDocument {
  id: string;
  docId: string;
  poNumber: string;
  materialCode: string;
  customerName: string;
  customerPo: string;
  tareWeight: number;
  rowCount: number;
  personName?: string;
  rows: QualityDocRow[];
  status: QualityDocStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Users ───

export const userRoles = [
  "worker",
  "lab_tech",
  "engineer",
  "admin",
  "owner",
] as const;

export type UserRole = (typeof userRoles)[number];

export const userRoleLabels: Record<UserRole, string> = {
  worker: "Worker",
  lab_tech: "Lab Tech",
  engineer: "Engineer",
  admin: "Admin",
  owner: "Owner",
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
