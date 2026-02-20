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

// ─── Quality Templates (V2) ───

export const qualityFieldTypes = [
  "text",
  "numeric",
  "checkbox",
  "pass_fail",
  "photo",
  "calculated",
] as const;
export type QualityFieldType = (typeof qualityFieldTypes)[number];

export const qualityFieldTypeLabels: Record<QualityFieldType, string> = {
  text: "Text",
  numeric: "Numeric",
  checkbox: "Yes / No",
  pass_fail: "Pass / Fail",
  photo: "Photo",
  calculated: "Calculated",
};

export const qualityFieldStages = ["worker", "quality_tech"] as const;
export type QualityFieldStage = (typeof qualityFieldStages)[number];

export interface QualityTemplateField {
  id: string;
  label: string;
  type: QualityFieldType;
  context: "header" | "row";
  stage: QualityFieldStage;
  required: boolean;
  description?: string;
  unit?: string;
  numericMin?: number;
  numericMax?: number;
  decimalPlaces?: number;
  formula?: string;
  formulaFieldIds?: string[];
  defaultValue?: string | number | boolean;
}

export interface QualityTemplate {
  id: string;
  templateId: string;
  title: string;
  description?: string;
  headerFields: QualityTemplateField[];
  rowFields: QualityTemplateField[];
  active: boolean;
  defaultRowCount: number;
  minRowCount?: number;
  maxRowCount?: number;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityFieldValue {
  fieldId: string;
  fieldLabel: string;
  fieldType: QualityFieldType;
  textValue?: string;
  numericValue?: number;
  booleanValue?: boolean;
  photoUrl?: string;
  calculatedValue?: number;
  unit?: string;
}

export interface QualityDocRowV2 {
  serialNumber: number;
  values: QualityFieldValue[];
}

export type QualityDocStatusV2 = "draft" | "worker_filled" | "complete";

export interface QualityDocumentV2 {
  id: string;
  docId: string;
  templateId: string;
  templateTitle: string;
  headerValues: QualityFieldValue[];
  rows: QualityDocRowV2[];
  rowCount: number;
  status: QualityDocStatusV2;
  workerName?: string;
  qualityTechName?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  workerFilledAt?: string;
  completedAt?: string;
}

// ─── Users ───

export const userRoles = [
  "worker",
  "quality_tech",
  "engineer",
  "shipping",
  "admin",
  "owner",
  "super_admin",
] as const;

export type UserRole = (typeof userRoles)[number];

export const userRoleLabels: Record<UserRole, string> = {
  worker: "Worker",
  quality_tech: "Quality Tech",
  engineer: "Engineer",
  shipping: "Shipping",
  admin: "Admin",
  owner: "Owner",
  super_admin: "Super Admin",
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Shipments ───

export const shipmentStatuses = ["pending", "in_transit", "delivered"] as const;
export type ShipmentStatus = (typeof shipmentStatuses)[number];

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
};

export const shipmentTypes = ["incoming", "outgoing"] as const;
export type ShipmentType = (typeof shipmentTypes)[number];

export const shipmentTypeLabels: Record<ShipmentType, string> = {
  incoming: "Incoming",
  outgoing: "Outgoing",
};

export interface Shipment {
  id: string;
  shipmentId: string;
  type: ShipmentType;
  poNumber: string;
  materialCode: string;
  supplierName?: string;
  customerName?: string;
  carrier: string;
  shipmentDate: string;
  notes?: string;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Tenants ───

export interface Tenant {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: string;
}

// ─── Messaging ───

export interface MessageGroup {
  id: string;
  tenantId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  memberCount?: number;
}

export interface MessageGroupMember {
  groupId: string;
  userId: string;
  fullName: string;
  role: UserRole;
  muted: boolean;
  addedAt: string;
}

export interface Message {
  id: string;
  tenantId: string;
  senderId: string;
  senderName: string;
  groupId: string | null;
  recipientId: string | null;
  content: string;
  createdAt: string;
}

// ─── Instructions/Documents ───

export interface DocumentFolder {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface InstructionDocument {
  id: string;
  folderId: string;
  folderName: string;
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  previousFileUrl?: string;
  previousFileName?: string;
  allowedRoles: UserRole[];
  uploadedBy: string;
  uploadedByUserId: string;
  createdAt: string;
  updatedAt: string;
}
