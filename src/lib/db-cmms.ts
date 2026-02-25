import { sql } from "@vercel/postgres";

// ─── Table Initialization ───────────────────────────────────────────────────

export async function initCmmsTables() {
  // Machine Types
  await sql`CREATE TABLE IF NOT EXISTS cmms_machine_types (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Production Lines
  await sql`CREATE TABLE IF NOT EXISTS cmms_production_lines (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    line_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Machines
  await sql`CREATE TABLE IF NOT EXISTS cmms_machines (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    machine_id VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    machine_type_id VARCHAR(36) NOT NULL,
    default_line_id VARCHAR(36),
    current_line_id VARCHAR(36),
    status VARCHAR(30) DEFAULT 'running',
    runtime_hours FLOAT DEFAULT 0,
    runtime_cycles INTEGER DEFAULT 0,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Machine–Technician assignments
  await sql`CREATE TABLE IF NOT EXISTS cmms_machine_technicians (
    machine_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (machine_id, user_id)
  )`;

  // Line reassignment audit log
  await sql`CREATE TABLE IF NOT EXISTS cmms_line_assignment_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    machine_id VARCHAR(36) NOT NULL,
    from_line_id VARCHAR(36),
    to_line_id VARCHAR(36),
    reason TEXT NOT NULL,
    changed_at VARCHAR(50) NOT NULL,
    changed_by VARCHAR(36) NOT NULL
  )`;

  // Procedure Sheets (header record)
  await sql`CREATE TABLE IF NOT EXISTS cmms_procedure_sheets (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    machine_type_id VARCHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL,
    current_revision INTEGER DEFAULT 1,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Procedure Revisions
  await sql`CREATE TABLE IF NOT EXISTS cmms_procedure_revisions (
    id VARCHAR(36) PRIMARY KEY,
    procedure_sheet_id VARCHAR(36) NOT NULL,
    revision_number INTEGER NOT NULL,
    content TEXT,
    safety_warnings TEXT,
    pdf_url TEXT,
    pdf_filename TEXT,
    is_current BOOLEAN DEFAULT true,
    created_at VARCHAR(50) NOT NULL,
    created_by VARCHAR(36) NOT NULL
  )`;
  // Idempotent migrations for existing tables
  try { await sql`ALTER TABLE cmms_procedure_revisions ADD COLUMN IF NOT EXISTS pdf_url TEXT`; } catch { /* already exists */ }
  try { await sql`ALTER TABLE cmms_procedure_revisions ADD COLUMN IF NOT EXISTS pdf_filename TEXT`; } catch { /* already exists */ }

  // Checklist Templates
  await sql`CREATE TABLE IF NOT EXISTS cmms_checklist_templates (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    machine_type_id VARCHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL,
    frequency VARCHAR(30) NOT NULL,
    interval_days INTEGER,
    interval_hours FLOAT,
    interval_cycles INTEGER,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Checklist Items
  await sql`CREATE TABLE IF NOT EXISTS cmms_checklist_items (
    id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL,
    order_num INTEGER NOT NULL,
    label VARCHAR(300) NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    expected_value VARCHAR(100),
    is_required BOOLEAN DEFAULT true
  )`;

  // Checklist Submissions
  await sql`CREATE TABLE IF NOT EXISTS cmms_checklist_submissions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    template_id VARCHAR(36) NOT NULL,
    machine_id VARCHAR(36) NOT NULL,
    submitted_by_id VARCHAR(36) NOT NULL,
    has_flags BOOLEAN DEFAULT false,
    notes TEXT,
    submitted_at VARCHAR(50) NOT NULL
  )`;

  // Checklist Responses
  await sql`CREATE TABLE IF NOT EXISTS cmms_checklist_responses (
    id VARCHAR(36) PRIMARY KEY,
    submission_id VARCHAR(36) NOT NULL,
    item_id VARCHAR(36) NOT NULL,
    value TEXT NOT NULL,
    is_flagged BOOLEAN DEFAULT false
  )`;

  // Log Sheet Templates
  await sql`CREATE TABLE IF NOT EXISTS cmms_log_sheet_templates (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    machine_type_id VARCHAR(36) NOT NULL,
    title VARCHAR(200) NOT NULL,
    frequency VARCHAR(30) NOT NULL,
    interval_days INTEGER,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Log Sheet Fields
  await sql`CREATE TABLE IF NOT EXISTS cmms_log_sheet_fields (
    id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL,
    order_num INTEGER NOT NULL,
    label VARCHAR(300) NOT NULL,
    unit VARCHAR(50),
    min_value FLOAT,
    max_value FLOAT,
    is_required BOOLEAN DEFAULT true
  )`;

  // Log Sheet Submissions
  await sql`CREATE TABLE IF NOT EXISTS cmms_log_sheet_submissions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    template_id VARCHAR(36) NOT NULL,
    machine_id VARCHAR(36) NOT NULL,
    submitted_by_id VARCHAR(36) NOT NULL,
    signed_off_by_id VARCHAR(36),
    signed_off_at VARCHAR(50),
    notes TEXT,
    submitted_at VARCHAR(50) NOT NULL
  )`;

  // Log Sheet Responses
  await sql`CREATE TABLE IF NOT EXISTS cmms_log_sheet_responses (
    id VARCHAR(36) PRIMARY KEY,
    submission_id VARCHAR(36) NOT NULL,
    field_id VARCHAR(36) NOT NULL,
    value TEXT NOT NULL,
    is_out_of_range BOOLEAN DEFAULT false
  )`;

  // Maintenance Schedules
  await sql`CREATE TABLE IF NOT EXISTS cmms_maintenance_schedules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    machine_type_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    frequency VARCHAR(30) NOT NULL,
    interval_days INTEGER,
    interval_hours FLOAT,
    interval_cycles INTEGER,
    warning_days_before_due INTEGER DEFAULT 1,
    checklist_template_id VARCHAR(36),
    log_sheet_template_id VARCHAR(36),
    assigned_tech_id VARCHAR(36),
    is_active BOOLEAN DEFAULT true,
    last_triggered_at VARCHAR(50),
    next_due_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL
  )`;

  // Work Orders
  await sql`CREATE TABLE IF NOT EXISTS cmms_work_orders (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    work_order_number VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    machine_id VARCHAR(36) NOT NULL,
    assigned_to_id VARCHAR(36),
    breakdown_report_id VARCHAR(36),
    description TEXT NOT NULL,
    resolution TEXT,
    parts_used TEXT,
    downtime_start VARCHAR(50),
    downtime_end VARCHAR(50),
    completed_at VARCHAR(50),
    closed_at VARCHAR(50),
    closed_by_id VARCHAR(36),
    created_at VARCHAR(50) NOT NULL,
    created_by_id VARCHAR(36) NOT NULL,
    procedure_revision_id VARCHAR(36),
    procedure_updated_flag BOOLEAN DEFAULT false
  )`;

  // Breakdown Reports
  await sql`CREATE TABLE IF NOT EXISTS cmms_breakdown_reports (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    machine_id VARCHAR(36) NOT NULL,
    reported_by_id VARCHAR(36) NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Notifications
  await sql`CREATE TABLE IF NOT EXISTS cmms_notifications (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(300) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    link VARCHAR(500),
    created_at VARCHAR(50) NOT NULL
  )`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function woNumber(year: number, seq: number): string {
  return `WO-${year}-${String(seq).padStart(4, "0")}`;
}

// ─── Machine Types ───────────────────────────────────────────────────────────

export interface CmmsMachineType {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

function mapMachineType(row: Record<string, unknown>): CmmsMachineType {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
  };
}

export const dbCmmsMachineTypes = {
  async getAll(tenantId: string | null): Promise<CmmsMachineType[]> {
    const result = tenantId
      ? await sql`SELECT * FROM cmms_machine_types WHERE tenant_id = ${tenantId} ORDER BY name`
      : await sql`SELECT * FROM cmms_machine_types ORDER BY name`;
    return result.rows.map(mapMachineType);
  },

  async getById(id: string): Promise<CmmsMachineType | null> {
    const result = await sql`SELECT * FROM cmms_machine_types WHERE id = ${id}`;
    return result.rows[0] ? mapMachineType(result.rows[0]) : null;
  },

  async create(tenantId: string, name: string): Promise<CmmsMachineType> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_machine_types (id, tenant_id, name, created_at) VALUES (${id}, ${tenantId}, ${name}, ${createdAt})`;
    return { id, tenantId, name, createdAt };
  },

  async update(id: string, tenantId: string, name: string): Promise<boolean> {
    const result = await sql`UPDATE cmms_machine_types SET name = ${name} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await sql`DELETE FROM cmms_machine_types WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },
};

// ─── Production Lines ─────────────────────────────────────────────────────────

export interface CmmsProductionLine {
  id: string;
  tenantId: string;
  lineId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

function mapLine(row: Record<string, unknown>): CmmsProductionLine {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    lineId: row.line_id as string,
    name: row.name as string,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  };
}

export const dbCmmsLines = {
  async getAll(tenantId: string | null): Promise<CmmsProductionLine[]> {
    const result = tenantId
      ? await sql`SELECT * FROM cmms_production_lines WHERE tenant_id = ${tenantId} ORDER BY line_id`
      : await sql`SELECT * FROM cmms_production_lines ORDER BY line_id`;
    return result.rows.map(mapLine);
  },

  async getById(id: string): Promise<CmmsProductionLine | null> {
    const result = await sql`SELECT * FROM cmms_production_lines WHERE id = ${id}`;
    return result.rows[0] ? mapLine(result.rows[0]) : null;
  },

  async create(tenantId: string, lineId: string, name: string): Promise<CmmsProductionLine> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_production_lines (id, tenant_id, line_id, name, is_active, created_at) VALUES (${id}, ${tenantId}, ${lineId}, ${name}, true, ${createdAt})`;
    return { id, tenantId, lineId, name, isActive: true, createdAt };
  },

  async update(id: string, tenantId: string, data: { name?: string; isActive?: boolean }): Promise<boolean> {
    if (data.name !== undefined && data.isActive !== undefined) {
      const result = await sql`UPDATE cmms_production_lines SET name = ${data.name}, is_active = ${data.isActive} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    } else if (data.name !== undefined) {
      const result = await sql`UPDATE cmms_production_lines SET name = ${data.name} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    } else if (data.isActive !== undefined) {
      const result = await sql`UPDATE cmms_production_lines SET is_active = ${data.isActive} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    return false;
  },
};

// ─── Machines ─────────────────────────────────────────────────────────────────

export interface CmmsMachine {
  id: string;
  tenantId: string;
  machineId: string;
  name: string;
  machineTypeId: string;
  machineTypeName?: string;
  defaultLineId: string | null;
  currentLineId: string | null;
  currentLineName?: string;
  status: "running" | "under_maintenance" | "down";
  runtimeHours: number;
  runtimeCycles: number;
  assignedTechIds?: string[];
  createdAt: string;
}

function mapMachine(row: Record<string, unknown>): CmmsMachine {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    machineId: row.machine_id as string,
    name: row.name as string,
    machineTypeId: row.machine_type_id as string,
    machineTypeName: row.machine_type_name as string | undefined,
    defaultLineId: (row.default_line_id as string) || null,
    currentLineId: (row.current_line_id as string) || null,
    currentLineName: row.current_line_name as string | undefined,
    status: (row.status as "running" | "under_maintenance" | "down") || "running",
    runtimeHours: Number(row.runtime_hours) || 0,
    runtimeCycles: Number(row.runtime_cycles) || 0,
    createdAt: row.created_at as string,
  };
}

export const dbCmmsMachines = {
  async getAll(tenantId: string | null, filters?: { status?: string; machineTypeId?: string }): Promise<CmmsMachine[]> {
    let result;
    if (tenantId) {
      if (filters?.status && filters?.machineTypeId) {
        result = await sql`
          SELECT m.*, mt.name AS machine_type_name, pl.name AS current_line_name
          FROM cmms_machines m
          LEFT JOIN cmms_machine_types mt ON m.machine_type_id = mt.id
          LEFT JOIN cmms_production_lines pl ON m.current_line_id = pl.id
          WHERE m.tenant_id = ${tenantId} AND m.status = ${filters.status} AND m.machine_type_id = ${filters.machineTypeId}
          ORDER BY m.machine_id`;
      } else if (filters?.status) {
        result = await sql`
          SELECT m.*, mt.name AS machine_type_name, pl.name AS current_line_name
          FROM cmms_machines m
          LEFT JOIN cmms_machine_types mt ON m.machine_type_id = mt.id
          LEFT JOIN cmms_production_lines pl ON m.current_line_id = pl.id
          WHERE m.tenant_id = ${tenantId} AND m.status = ${filters.status}
          ORDER BY m.machine_id`;
      } else if (filters?.machineTypeId) {
        result = await sql`
          SELECT m.*, mt.name AS machine_type_name, pl.name AS current_line_name
          FROM cmms_machines m
          LEFT JOIN cmms_machine_types mt ON m.machine_type_id = mt.id
          LEFT JOIN cmms_production_lines pl ON m.current_line_id = pl.id
          WHERE m.tenant_id = ${tenantId} AND m.machine_type_id = ${filters.machineTypeId}
          ORDER BY m.machine_id`;
      } else {
        result = await sql`
          SELECT m.*, mt.name AS machine_type_name, pl.name AS current_line_name
          FROM cmms_machines m
          LEFT JOIN cmms_machine_types mt ON m.machine_type_id = mt.id
          LEFT JOIN cmms_production_lines pl ON m.current_line_id = pl.id
          WHERE m.tenant_id = ${tenantId}
          ORDER BY m.machine_id`;
      }
    } else {
      result = await sql`
        SELECT m.*, mt.name AS machine_type_name, pl.name AS current_line_name
        FROM cmms_machines m
        LEFT JOIN cmms_machine_types mt ON m.machine_type_id = mt.id
        LEFT JOIN cmms_production_lines pl ON m.current_line_id = pl.id
        ORDER BY m.machine_id`;
    }
    return result.rows.map(mapMachine);
  },

  async getById(id: string): Promise<CmmsMachine | null> {
    const result = await sql`
      SELECT m.*, mt.name AS machine_type_name, pl.name AS current_line_name
      FROM cmms_machines m
      LEFT JOIN cmms_machine_types mt ON m.machine_type_id = mt.id
      LEFT JOIN cmms_production_lines pl ON m.current_line_id = pl.id
      WHERE m.id = ${id}`;
    if (!result.rows[0]) return null;
    const machine = mapMachine(result.rows[0]);
    // fetch assigned techs
    const techs = await sql`SELECT user_id FROM cmms_machine_technicians WHERE machine_id = ${id}`;
    machine.assignedTechIds = techs.rows.map(r => r.user_id as string);
    return machine;
  },

  async create(tenantId: string, data: {
    machineId: string;
    name: string;
    machineTypeId: string;
    defaultLineId?: string;
    currentLineId?: string;
  }): Promise<CmmsMachine> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_machines (id, tenant_id, machine_id, name, machine_type_id, default_line_id, current_line_id, status, runtime_hours, runtime_cycles, created_at)
      VALUES (${id}, ${tenantId}, ${data.machineId}, ${data.name}, ${data.machineTypeId}, ${data.defaultLineId || null}, ${data.currentLineId || null}, 'running', 0, 0, ${createdAt})`;
    return {
      id, tenantId, machineId: data.machineId, name: data.name,
      machineTypeId: data.machineTypeId,
      defaultLineId: data.defaultLineId || null,
      currentLineId: data.currentLineId || null,
      status: "running", runtimeHours: 0, runtimeCycles: 0, createdAt,
    };
  },

  async update(id: string, tenantId: string, data: {
    name?: string;
    status?: string;
    defaultLineId?: string | null;
    currentLineId?: string | null;
  }): Promise<boolean> {
    const fields: string[] = [];
    if (data.name !== undefined) fields.push("name");
    if (data.status !== undefined) fields.push("status");
    if ("defaultLineId" in data) fields.push("default_line_id");
    if ("currentLineId" in data) fields.push("current_line_id");
    if (fields.length === 0) return false;

    // Build update with explicit checks for each possible field combination
    if (data.name !== undefined && data.status !== undefined) {
      const result = await sql`UPDATE cmms_machines SET name = ${data.name}, status = ${data.status} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    } else if (data.name !== undefined) {
      const result = await sql`UPDATE cmms_machines SET name = ${data.name} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    } else if (data.status !== undefined) {
      const result = await sql`UPDATE cmms_machines SET status = ${data.status} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    return false;
  },

  async updateStatus(id: string, tenantId: string, status: string): Promise<boolean> {
    const result = await sql`UPDATE cmms_machines SET status = ${status} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },

  async updateRuntime(id: string, tenantId: string, runtimeHours?: number, runtimeCycles?: number): Promise<boolean> {
    if (runtimeHours !== undefined && runtimeCycles !== undefined) {
      const result = await sql`UPDATE cmms_machines SET runtime_hours = ${runtimeHours}, runtime_cycles = ${runtimeCycles} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    } else if (runtimeHours !== undefined) {
      const result = await sql`UPDATE cmms_machines SET runtime_hours = ${runtimeHours} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    } else if (runtimeCycles !== undefined) {
      const result = await sql`UPDATE cmms_machines SET runtime_cycles = ${runtimeCycles} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    return false;
  },

  async reassignLine(id: string, tenantId: string, toLineId: string | null, reason: string, userId: string, permanent: boolean): Promise<boolean> {
    const machine = await sql`SELECT current_line_id, default_line_id FROM cmms_machines WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!machine.rows[0]) return false;
    const fromLineId = machine.rows[0].current_line_id as string | null;

    if (permanent) {
      await sql`UPDATE cmms_machines SET current_line_id = ${toLineId}, default_line_id = ${toLineId} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    } else {
      await sql`UPDATE cmms_machines SET current_line_id = ${toLineId} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    }

    // Log the reassignment
    await sql`INSERT INTO cmms_line_assignment_logs (id, tenant_id, machine_id, from_line_id, to_line_id, reason, changed_at, changed_by)
      VALUES (${uuid()}, ${tenantId}, ${id}, ${fromLineId}, ${toLineId}, ${reason}, ${now()}, ${userId})`;
    return true;
  },

  async setTechnicians(machineId: string, userIds: string[]): Promise<void> {
    await sql`DELETE FROM cmms_machine_technicians WHERE machine_id = ${machineId}`;
    for (const userId of userIds) {
      await sql`INSERT INTO cmms_machine_technicians (machine_id, user_id) VALUES (${machineId}, ${userId}) ON CONFLICT DO NOTHING`;
    }
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    const result = await sql`DELETE FROM cmms_machines WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },

  async getLineAssignmentLogs(machineId: string): Promise<Record<string, unknown>[]> {
    const result = await sql`SELECT * FROM cmms_line_assignment_logs WHERE machine_id = ${machineId} ORDER BY changed_at DESC`;
    return result.rows;
  },
};

// ─── Procedure Sheets ─────────────────────────────────────────────────────────

export interface CmmsProcedureSheet {
  id: string;
  tenantId: string;
  machineTypeId: string;
  machineTypeName?: string;
  title: string;
  currentRevision: number;
  createdAt: string;
  content?: string;
  safetyWarnings?: string;
}

export interface CmmsProcedureRevision {
  id: string;
  procedureSheetId: string;
  revisionNumber: number;
  content: string | null;
  safetyWarnings: string | null;
  pdfUrl: string | null;
  pdfFilename: string | null;
  isCurrent: boolean;
  createdAt: string;
  createdBy: string;
}

function mapSheet(row: Record<string, unknown>): CmmsProcedureSheet {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    machineTypeId: row.machine_type_id as string,
    machineTypeName: row.machine_type_name as string | undefined,
    title: row.title as string,
    currentRevision: Number(row.current_revision) || 1,
    createdAt: row.created_at as string,
    content: row.content as string | undefined,
    safetyWarnings: row.safety_warnings as string | undefined,
  };
}

function mapRevision(row: Record<string, unknown>): CmmsProcedureRevision {
  return {
    id: row.id as string,
    procedureSheetId: row.procedure_sheet_id as string,
    revisionNumber: Number(row.revision_number),
    content: (row.content as string) || null,
    safetyWarnings: (row.safety_warnings as string) || null,
    pdfUrl: (row.pdf_url as string) || null,
    pdfFilename: (row.pdf_filename as string) || null,
    isCurrent: row.is_current as boolean,
    createdAt: row.created_at as string,
    createdBy: row.created_by as string,
  };
}

export const dbCmmsProcedures = {
  async getAll(tenantId: string | null, machineTypeId?: string): Promise<CmmsProcedureSheet[]> {
    let result;
    if (tenantId && machineTypeId) {
      result = await sql`
        SELECT ps.*, mt.name AS machine_type_name,
               pr.content, pr.safety_warnings
        FROM cmms_procedure_sheets ps
        LEFT JOIN cmms_machine_types mt ON ps.machine_type_id = mt.id
        LEFT JOIN cmms_procedure_revisions pr ON pr.procedure_sheet_id = ps.id AND pr.is_current = true
        WHERE ps.tenant_id = ${tenantId} AND ps.machine_type_id = ${machineTypeId}
        ORDER BY ps.title`;
    } else if (tenantId) {
      result = await sql`
        SELECT ps.*, mt.name AS machine_type_name,
               pr.content, pr.safety_warnings
        FROM cmms_procedure_sheets ps
        LEFT JOIN cmms_machine_types mt ON ps.machine_type_id = mt.id
        LEFT JOIN cmms_procedure_revisions pr ON pr.procedure_sheet_id = ps.id AND pr.is_current = true
        WHERE ps.tenant_id = ${tenantId}
        ORDER BY ps.title`;
    } else {
      result = await sql`
        SELECT ps.*, mt.name AS machine_type_name,
               pr.content, pr.safety_warnings
        FROM cmms_procedure_sheets ps
        LEFT JOIN cmms_machine_types mt ON ps.machine_type_id = mt.id
        LEFT JOIN cmms_procedure_revisions pr ON pr.procedure_sheet_id = ps.id AND pr.is_current = true
        ORDER BY ps.title`;
    }
    return result.rows.map(mapSheet);
  },

  async getById(id: string): Promise<CmmsProcedureSheet | null> {
    const result = await sql`
      SELECT ps.*, mt.name AS machine_type_name,
             pr.content, pr.safety_warnings
      FROM cmms_procedure_sheets ps
      LEFT JOIN cmms_machine_types mt ON ps.machine_type_id = mt.id
      LEFT JOIN cmms_procedure_revisions pr ON pr.procedure_sheet_id = ps.id AND pr.is_current = true
      WHERE ps.id = ${id}`;
    return result.rows[0] ? mapSheet(result.rows[0]) : null;
  },

  async getRevisions(procedureSheetId: string): Promise<CmmsProcedureRevision[]> {
    const result = await sql`SELECT * FROM cmms_procedure_revisions WHERE procedure_sheet_id = ${procedureSheetId} ORDER BY revision_number DESC`;
    return result.rows.map(mapRevision);
  },

  async create(tenantId: string, machineTypeId: string, title: string, content: string | null, safetyWarnings: string | null, createdBy: string, pdfUrl?: string | null, pdfFilename?: string | null): Promise<CmmsProcedureSheet> {
    const sheetId = uuid();
    const revId = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_procedure_sheets (id, tenant_id, machine_type_id, title, current_revision, created_at)
      VALUES (${sheetId}, ${tenantId}, ${machineTypeId}, ${title}, 1, ${createdAt})`;
    await sql`INSERT INTO cmms_procedure_revisions (id, procedure_sheet_id, revision_number, content, safety_warnings, pdf_url, pdf_filename, is_current, created_at, created_by)
      VALUES (${revId}, ${sheetId}, 1, ${content || null}, ${safetyWarnings}, ${pdfUrl || null}, ${pdfFilename || null}, true, ${createdAt}, ${createdBy})`;
    return { id: sheetId, tenantId, machineTypeId, title, currentRevision: 1, createdAt, content: content || undefined, safetyWarnings: safetyWarnings || undefined };
  },

  async addRevision(sheetId: string, tenantId: string, content: string | null, safetyWarnings: string | null, createdBy: string, pdfUrl?: string | null, pdfFilename?: string | null): Promise<CmmsProcedureRevision | null> {
    const sheet = await sql`SELECT current_revision FROM cmms_procedure_sheets WHERE id = ${sheetId} AND tenant_id = ${tenantId}`;
    if (!sheet.rows[0]) return null;
    const nextRev = Number(sheet.rows[0].current_revision) + 1;
    const revId = uuid();
    const createdAt = now();

    // Archive all existing revisions
    await sql`UPDATE cmms_procedure_revisions SET is_current = false WHERE procedure_sheet_id = ${sheetId}`;
    // Insert new revision
    await sql`INSERT INTO cmms_procedure_revisions (id, procedure_sheet_id, revision_number, content, safety_warnings, pdf_url, pdf_filename, is_current, created_at, created_by)
      VALUES (${revId}, ${sheetId}, ${nextRev}, ${content || null}, ${safetyWarnings}, ${pdfUrl || null}, ${pdfFilename || null}, true, ${createdAt}, ${createdBy})`;
    // Update sheet's current_revision
    await sql`UPDATE cmms_procedure_sheets SET current_revision = ${nextRev} WHERE id = ${sheetId}`;

    // Flag open work orders for this machine type
    const machineTypeResult = await sql`SELECT machine_type_id, tenant_id FROM cmms_procedure_sheets WHERE id = ${sheetId}`;
    if (machineTypeResult.rows[0]) {
      const { machine_type_id, tenant_id } = machineTypeResult.rows[0];
      await sql`
        UPDATE cmms_work_orders SET procedure_updated_flag = true
        WHERE tenant_id = ${tenant_id}
          AND status IN ('open', 'in_progress')
          AND machine_id IN (SELECT id FROM cmms_machines WHERE machine_type_id = ${machine_type_id})`;
    }

    return {
      id: revId, procedureSheetId: sheetId, revisionNumber: nextRev,
      content: content || null, safetyWarnings, pdfUrl: pdfUrl || null,
      pdfFilename: pdfFilename || null, isCurrent: true, createdAt, createdBy,
    };
  },
};

// ─── Checklist Templates ──────────────────────────────────────────────────────

export interface CmmsChecklistTemplate {
  id: string;
  tenantId: string;
  machineTypeId: string;
  machineTypeName?: string;
  title: string;
  frequency: string;
  intervalDays: number | null;
  intervalHours: number | null;
  intervalCycles: number | null;
  createdAt: string;
  items?: CmmsChecklistItem[];
}

export interface CmmsChecklistItem {
  id: string;
  templateId: string;
  orderNum: number;
  label: string;
  itemType: "checkbox" | "numeric" | "pass_fail" | "text_note";
  expectedValue: string | null;
  isRequired: boolean;
}

function mapChecklistTemplate(row: Record<string, unknown>): CmmsChecklistTemplate {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    machineTypeId: row.machine_type_id as string,
    machineTypeName: row.machine_type_name as string | undefined,
    title: row.title as string,
    frequency: row.frequency as string,
    intervalDays: row.interval_days != null ? Number(row.interval_days) : null,
    intervalHours: row.interval_hours != null ? Number(row.interval_hours) : null,
    intervalCycles: row.interval_cycles != null ? Number(row.interval_cycles) : null,
    createdAt: row.created_at as string,
  };
}

function mapChecklistItem(row: Record<string, unknown>): CmmsChecklistItem {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    orderNum: Number(row.order_num),
    label: row.label as string,
    itemType: row.item_type as CmmsChecklistItem["itemType"],
    expectedValue: (row.expected_value as string) || null,
    isRequired: row.is_required as boolean,
  };
}

export const dbCmmsChecklistTemplates = {
  async getAll(tenantId: string | null, machineTypeId?: string): Promise<CmmsChecklistTemplate[]> {
    let result;
    if (tenantId && machineTypeId) {
      result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_checklist_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id WHERE t.tenant_id = ${tenantId} AND t.machine_type_id = ${machineTypeId} ORDER BY t.title`;
    } else if (tenantId) {
      result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_checklist_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id WHERE t.tenant_id = ${tenantId} ORDER BY t.title`;
    } else {
      result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_checklist_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id ORDER BY t.title`;
    }
    return result.rows.map(mapChecklistTemplate);
  },

  async getById(id: string): Promise<CmmsChecklistTemplate | null> {
    const result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_checklist_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id WHERE t.id = ${id}`;
    if (!result.rows[0]) return null;
    const template = mapChecklistTemplate(result.rows[0]);
    const items = await sql`SELECT * FROM cmms_checklist_items WHERE template_id = ${id} ORDER BY order_num`;
    template.items = items.rows.map(mapChecklistItem);
    return template;
  },

  async create(tenantId: string, data: {
    machineTypeId: string;
    title: string;
    frequency: string;
    intervalDays?: number;
    intervalHours?: number;
    intervalCycles?: number;
    items: Array<{ label: string; itemType: string; expectedValue?: string; isRequired: boolean }>;
  }): Promise<CmmsChecklistTemplate> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_checklist_templates (id, tenant_id, machine_type_id, title, frequency, interval_days, interval_hours, interval_cycles, created_at)
      VALUES (${id}, ${tenantId}, ${data.machineTypeId}, ${data.title}, ${data.frequency}, ${data.intervalDays || null}, ${data.intervalHours || null}, ${data.intervalCycles || null}, ${createdAt})`;
    const items: CmmsChecklistItem[] = [];
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const itemId = uuid();
      await sql`INSERT INTO cmms_checklist_items (id, template_id, order_num, label, item_type, expected_value, is_required)
        VALUES (${itemId}, ${id}, ${i + 1}, ${item.label}, ${item.itemType}, ${item.expectedValue || null}, ${item.isRequired})`;
      items.push({ id: itemId, templateId: id, orderNum: i + 1, label: item.label, itemType: item.itemType as CmmsChecklistItem["itemType"], expectedValue: item.expectedValue || null, isRequired: item.isRequired });
    }
    return {
      id, tenantId, machineTypeId: data.machineTypeId, title: data.title,
      frequency: data.frequency, intervalDays: data.intervalDays || null,
      intervalHours: data.intervalHours || null, intervalCycles: data.intervalCycles || null,
      createdAt, items,
    };
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    await sql`DELETE FROM cmms_checklist_items WHERE template_id = ${id}`;
    const result = await sql`DELETE FROM cmms_checklist_templates WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },
};

// ─── Checklist Submissions ────────────────────────────────────────────────────

export interface CmmsChecklistSubmission {
  id: string;
  tenantId: string;
  templateId: string;
  templateTitle?: string;
  machineId: string;
  machineName?: string;
  submittedById: string;
  submittedByName?: string;
  hasFlags: boolean;
  notes: string | null;
  submittedAt: string;
  responses?: CmmsChecklistResponse[];
}

export interface CmmsChecklistResponse {
  id: string;
  submissionId: string;
  itemId: string;
  itemLabel?: string;
  value: string;
  isFlagged: boolean;
}

function mapChecklistSubmission(row: Record<string, unknown>): CmmsChecklistSubmission {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    templateId: row.template_id as string,
    templateTitle: row.template_title as string | undefined,
    machineId: row.machine_id as string,
    machineName: row.machine_name as string | undefined,
    submittedById: row.submitted_by_id as string,
    submittedByName: row.submitted_by_name as string | undefined,
    hasFlags: row.has_flags as boolean,
    notes: (row.notes as string) || null,
    submittedAt: row.submitted_at as string,
  };
}

export const dbCmmsChecklistSubmissions = {
  async getAll(tenantId: string | null, filters?: { machineId?: string; hasFlags?: boolean }): Promise<CmmsChecklistSubmission[]> {
    let result;
    const baseQuery = `
      SELECT s.*, t.title AS template_title, m.name AS machine_name, u.full_name AS submitted_by_name
      FROM cmms_checklist_submissions s
      LEFT JOIN cmms_checklist_templates t ON s.template_id = t.id
      LEFT JOIN cmms_machines m ON s.machine_id = m.id
      LEFT JOIN users u ON s.submitted_by_id = u.id`;

    if (tenantId && filters?.machineId && filters?.hasFlags !== undefined) {
      result = await sql`${baseQuery} WHERE s.tenant_id = ${tenantId} AND s.machine_id = ${filters.machineId} AND s.has_flags = ${filters.hasFlags} ORDER BY s.submitted_at DESC`;
    } else if (tenantId && filters?.machineId) {
      result = await sql`${baseQuery} WHERE s.tenant_id = ${tenantId} AND s.machine_id = ${filters.machineId} ORDER BY s.submitted_at DESC`;
    } else if (tenantId && filters?.hasFlags !== undefined) {
      result = await sql`${baseQuery} WHERE s.tenant_id = ${tenantId} AND s.has_flags = ${filters.hasFlags} ORDER BY s.submitted_at DESC`;
    } else if (tenantId) {
      result = await sql`${baseQuery} WHERE s.tenant_id = ${tenantId} ORDER BY s.submitted_at DESC`;
    } else {
      result = await sql`${baseQuery} ORDER BY s.submitted_at DESC`;
    }
    return result.rows.map(mapChecklistSubmission);
  },

  async getById(id: string): Promise<CmmsChecklistSubmission | null> {
    const result = await sql`
      SELECT s.*, t.title AS template_title, m.name AS machine_name, u.full_name AS submitted_by_name
      FROM cmms_checklist_submissions s
      LEFT JOIN cmms_checklist_templates t ON s.template_id = t.id
      LEFT JOIN cmms_machines m ON s.machine_id = m.id
      LEFT JOIN users u ON s.submitted_by_id = u.id
      WHERE s.id = ${id}`;
    if (!result.rows[0]) return null;
    const sub = mapChecklistSubmission(result.rows[0]);
    const responses = await sql`
      SELECT r.*, i.label AS item_label FROM cmms_checklist_responses r
      LEFT JOIN cmms_checklist_items i ON r.item_id = i.id
      WHERE r.submission_id = ${id} ORDER BY i.order_num`;
    sub.responses = responses.rows.map(r => ({
      id: r.id as string,
      submissionId: r.submission_id as string,
      itemId: r.item_id as string,
      itemLabel: r.item_label as string,
      value: r.value as string,
      isFlagged: r.is_flagged as boolean,
    }));
    return sub;
  },

  async create(tenantId: string, data: {
    templateId: string;
    machineId: string;
    submittedById: string;
    notes?: string;
    responses: Array<{ itemId: string; value: string; isFlagged: boolean }>;
  }): Promise<CmmsChecklistSubmission> {
    const id = uuid();
    const submittedAt = now();
    const hasFlags = data.responses.some(r => r.isFlagged);
    await sql`INSERT INTO cmms_checklist_submissions (id, tenant_id, template_id, machine_id, submitted_by_id, has_flags, notes, submitted_at)
      VALUES (${id}, ${tenantId}, ${data.templateId}, ${data.machineId}, ${data.submittedById}, ${hasFlags}, ${data.notes || null}, ${submittedAt})`;
    for (const r of data.responses) {
      await sql`INSERT INTO cmms_checklist_responses (id, submission_id, item_id, value, is_flagged)
        VALUES (${uuid()}, ${id}, ${r.itemId}, ${r.value}, ${r.isFlagged})`;
    }
    return {
      id, tenantId, templateId: data.templateId, machineId: data.machineId,
      submittedById: data.submittedById, hasFlags, notes: data.notes || null, submittedAt,
    };
  },

  async getFlagged(tenantId: string): Promise<CmmsChecklistSubmission[]> {
    const result = await sql`
      SELECT s.*, t.title AS template_title, m.name AS machine_name, u.full_name AS submitted_by_name
      FROM cmms_checklist_submissions s
      LEFT JOIN cmms_checklist_templates t ON s.template_id = t.id
      LEFT JOIN cmms_machines m ON s.machine_id = m.id
      LEFT JOIN users u ON s.submitted_by_id = u.id
      WHERE s.tenant_id = ${tenantId} AND s.has_flags = true
      ORDER BY s.submitted_at DESC`;
    return result.rows.map(mapChecklistSubmission);
  },
};

// ─── Log Sheet Templates ──────────────────────────────────────────────────────

export interface CmmsLogSheetTemplate {
  id: string;
  tenantId: string;
  machineTypeId: string;
  machineTypeName?: string;
  title: string;
  frequency: string;
  intervalDays: number | null;
  createdAt: string;
  fields?: CmmsLogSheetField[];
}

export interface CmmsLogSheetField {
  id: string;
  templateId: string;
  orderNum: number;
  label: string;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  isRequired: boolean;
}

function mapLogTemplate(row: Record<string, unknown>): CmmsLogSheetTemplate {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    machineTypeId: row.machine_type_id as string,
    machineTypeName: row.machine_type_name as string | undefined,
    title: row.title as string,
    frequency: row.frequency as string,
    intervalDays: row.interval_days != null ? Number(row.interval_days) : null,
    createdAt: row.created_at as string,
  };
}

function mapLogField(row: Record<string, unknown>): CmmsLogSheetField {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    orderNum: Number(row.order_num),
    label: row.label as string,
    unit: (row.unit as string) || null,
    minValue: row.min_value != null ? Number(row.min_value) : null,
    maxValue: row.max_value != null ? Number(row.max_value) : null,
    isRequired: row.is_required as boolean,
  };
}

export const dbCmmsLogTemplates = {
  async getAll(tenantId: string | null, machineTypeId?: string): Promise<CmmsLogSheetTemplate[]> {
    let result;
    if (tenantId && machineTypeId) {
      result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_log_sheet_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id WHERE t.tenant_id = ${tenantId} AND t.machine_type_id = ${machineTypeId} ORDER BY t.title`;
    } else if (tenantId) {
      result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_log_sheet_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id WHERE t.tenant_id = ${tenantId} ORDER BY t.title`;
    } else {
      result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_log_sheet_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id ORDER BY t.title`;
    }
    return result.rows.map(mapLogTemplate);
  },

  async getById(id: string): Promise<CmmsLogSheetTemplate | null> {
    const result = await sql`SELECT t.*, mt.name AS machine_type_name FROM cmms_log_sheet_templates t LEFT JOIN cmms_machine_types mt ON t.machine_type_id = mt.id WHERE t.id = ${id}`;
    if (!result.rows[0]) return null;
    const template = mapLogTemplate(result.rows[0]);
    const fields = await sql`SELECT * FROM cmms_log_sheet_fields WHERE template_id = ${id} ORDER BY order_num`;
    template.fields = fields.rows.map(mapLogField);
    return template;
  },

  async create(tenantId: string, data: {
    machineTypeId: string;
    title: string;
    frequency: string;
    intervalDays?: number;
    fields: Array<{ label: string; unit?: string; minValue?: number; maxValue?: number; isRequired: boolean }>;
  }): Promise<CmmsLogSheetTemplate> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_log_sheet_templates (id, tenant_id, machine_type_id, title, frequency, interval_days, created_at)
      VALUES (${id}, ${tenantId}, ${data.machineTypeId}, ${data.title}, ${data.frequency}, ${data.intervalDays || null}, ${createdAt})`;
    const fields: CmmsLogSheetField[] = [];
    for (let i = 0; i < data.fields.length; i++) {
      const f = data.fields[i];
      const fId = uuid();
      await sql`INSERT INTO cmms_log_sheet_fields (id, template_id, order_num, label, unit, min_value, max_value, is_required)
        VALUES (${fId}, ${id}, ${i + 1}, ${f.label}, ${f.unit || null}, ${f.minValue ?? null}, ${f.maxValue ?? null}, ${f.isRequired})`;
      fields.push({ id: fId, templateId: id, orderNum: i + 1, label: f.label, unit: f.unit || null, minValue: f.minValue ?? null, maxValue: f.maxValue ?? null, isRequired: f.isRequired });
    }
    return { id, tenantId, machineTypeId: data.machineTypeId, title: data.title, frequency: data.frequency, intervalDays: data.intervalDays || null, createdAt, fields };
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    await sql`DELETE FROM cmms_log_sheet_fields WHERE template_id = ${id}`;
    const result = await sql`DELETE FROM cmms_log_sheet_templates WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },
};

// ─── Log Sheet Submissions ────────────────────────────────────────────────────

export interface CmmsLogSheetSubmission {
  id: string;
  tenantId: string;
  templateId: string;
  templateTitle?: string;
  machineId: string;
  machineName?: string;
  submittedById: string;
  submittedByName?: string;
  signedOffById: string | null;
  signedOffByName?: string;
  signedOffAt: string | null;
  notes: string | null;
  submittedAt: string;
  responses?: CmmsLogSheetResponse[];
}

export interface CmmsLogSheetResponse {
  id: string;
  submissionId: string;
  fieldId: string;
  fieldLabel?: string;
  value: string;
  isOutOfRange: boolean;
}

function mapLogSubmission(row: Record<string, unknown>): CmmsLogSheetSubmission {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    templateId: row.template_id as string,
    templateTitle: row.template_title as string | undefined,
    machineId: row.machine_id as string,
    machineName: row.machine_name as string | undefined,
    submittedById: row.submitted_by_id as string,
    submittedByName: row.submitted_by_name as string | undefined,
    signedOffById: (row.signed_off_by_id as string) || null,
    signedOffByName: row.signed_off_by_name as string | undefined,
    signedOffAt: (row.signed_off_at as string) || null,
    notes: (row.notes as string) || null,
    submittedAt: row.submitted_at as string,
  };
}

export const dbCmmsLogSubmissions = {
  async getAll(tenantId: string | null, filters?: { machineId?: string; pendingSignOff?: boolean }): Promise<CmmsLogSheetSubmission[]> {
    let result;
    if (tenantId && filters?.machineId) {
      result = await sql`
        SELECT s.*, t.title AS template_title, m.name AS machine_name,
               u1.full_name AS submitted_by_name, u2.full_name AS signed_off_by_name
        FROM cmms_log_sheet_submissions s
        LEFT JOIN cmms_log_sheet_templates t ON s.template_id = t.id
        LEFT JOIN cmms_machines m ON s.machine_id = m.id
        LEFT JOIN users u1 ON s.submitted_by_id = u1.id
        LEFT JOIN users u2 ON s.signed_off_by_id = u2.id
        WHERE s.tenant_id = ${tenantId} AND s.machine_id = ${filters.machineId}
        ORDER BY s.submitted_at DESC`;
    } else if (tenantId && filters?.pendingSignOff) {
      result = await sql`
        SELECT s.*, t.title AS template_title, m.name AS machine_name,
               u1.full_name AS submitted_by_name, u2.full_name AS signed_off_by_name
        FROM cmms_log_sheet_submissions s
        LEFT JOIN cmms_log_sheet_templates t ON s.template_id = t.id
        LEFT JOIN cmms_machines m ON s.machine_id = m.id
        LEFT JOIN users u1 ON s.submitted_by_id = u1.id
        LEFT JOIN users u2 ON s.signed_off_by_id = u2.id
        WHERE s.tenant_id = ${tenantId} AND s.signed_off_by_id IS NULL
        ORDER BY s.submitted_at DESC`;
    } else if (tenantId) {
      result = await sql`
        SELECT s.*, t.title AS template_title, m.name AS machine_name,
               u1.full_name AS submitted_by_name, u2.full_name AS signed_off_by_name
        FROM cmms_log_sheet_submissions s
        LEFT JOIN cmms_log_sheet_templates t ON s.template_id = t.id
        LEFT JOIN cmms_machines m ON s.machine_id = m.id
        LEFT JOIN users u1 ON s.submitted_by_id = u1.id
        LEFT JOIN users u2 ON s.signed_off_by_id = u2.id
        WHERE s.tenant_id = ${tenantId}
        ORDER BY s.submitted_at DESC`;
    } else {
      result = await sql`
        SELECT s.*, t.title AS template_title, m.name AS machine_name,
               u1.full_name AS submitted_by_name, u2.full_name AS signed_off_by_name
        FROM cmms_log_sheet_submissions s
        LEFT JOIN cmms_log_sheet_templates t ON s.template_id = t.id
        LEFT JOIN cmms_machines m ON s.machine_id = m.id
        LEFT JOIN users u1 ON s.submitted_by_id = u1.id
        LEFT JOIN users u2 ON s.signed_off_by_id = u2.id
        ORDER BY s.submitted_at DESC`;
    }
    return result.rows.map(mapLogSubmission);
  },

  async getById(id: string): Promise<CmmsLogSheetSubmission | null> {
    const result = await sql`
      SELECT s.*, t.title AS template_title, m.name AS machine_name,
             u1.full_name AS submitted_by_name, u2.full_name AS signed_off_by_name
      FROM cmms_log_sheet_submissions s
      LEFT JOIN cmms_log_sheet_templates t ON s.template_id = t.id
      LEFT JOIN cmms_machines m ON s.machine_id = m.id
      LEFT JOIN users u1 ON s.submitted_by_id = u1.id
      LEFT JOIN users u2 ON s.signed_off_by_id = u2.id
      WHERE s.id = ${id}`;
    if (!result.rows[0]) return null;
    const sub = mapLogSubmission(result.rows[0]);
    const responses = await sql`
      SELECT r.*, f.label AS field_label FROM cmms_log_sheet_responses r
      LEFT JOIN cmms_log_sheet_fields f ON r.field_id = f.id
      WHERE r.submission_id = ${id} ORDER BY f.order_num`;
    sub.responses = responses.rows.map(r => ({
      id: r.id as string,
      submissionId: r.submission_id as string,
      fieldId: r.field_id as string,
      fieldLabel: r.field_label as string,
      value: r.value as string,
      isOutOfRange: r.is_out_of_range as boolean,
    }));
    return sub;
  },

  async create(tenantId: string, data: {
    templateId: string;
    machineId: string;
    submittedById: string;
    notes?: string;
    responses: Array<{ fieldId: string; value: string; isOutOfRange: boolean }>;
  }): Promise<CmmsLogSheetSubmission> {
    const id = uuid();
    const submittedAt = now();
    await sql`INSERT INTO cmms_log_sheet_submissions (id, tenant_id, template_id, machine_id, submitted_by_id, notes, submitted_at)
      VALUES (${id}, ${tenantId}, ${data.templateId}, ${data.machineId}, ${data.submittedById}, ${data.notes || null}, ${submittedAt})`;
    for (const r of data.responses) {
      await sql`INSERT INTO cmms_log_sheet_responses (id, submission_id, field_id, value, is_out_of_range)
        VALUES (${uuid()}, ${id}, ${r.fieldId}, ${r.value}, ${r.isOutOfRange})`;
    }
    return {
      id, tenantId, templateId: data.templateId, machineId: data.machineId,
      submittedById: data.submittedById, signedOffById: null, signedOffAt: null,
      notes: data.notes || null, submittedAt,
    };
  },

  async signOff(id: string, tenantId: string, signedOffById: string): Promise<boolean> {
    const result = await sql`UPDATE cmms_log_sheet_submissions SET signed_off_by_id = ${signedOffById}, signed_off_at = ${now()} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },
};

// ─── Maintenance Schedules ────────────────────────────────────────────────────

export interface CmmsSchedule {
  id: string;
  tenantId: string;
  machineTypeId: string;
  machineTypeName?: string;
  name: string;
  frequency: string;
  intervalDays: number | null;
  intervalHours: number | null;
  intervalCycles: number | null;
  warningDaysBeforeDue: number;
  checklistTemplateId: string | null;
  logSheetTemplateId: string | null;
  assignedTechId: string | null;
  isActive: boolean;
  lastTriggeredAt: string | null;
  nextDueAt: string | null;
  createdAt: string;
}

function mapSchedule(row: Record<string, unknown>): CmmsSchedule {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    machineTypeId: row.machine_type_id as string,
    machineTypeName: row.machine_type_name as string | undefined,
    name: row.name as string,
    frequency: row.frequency as string,
    intervalDays: row.interval_days != null ? Number(row.interval_days) : null,
    intervalHours: row.interval_hours != null ? Number(row.interval_hours) : null,
    intervalCycles: row.interval_cycles != null ? Number(row.interval_cycles) : null,
    warningDaysBeforeDue: Number(row.warning_days_before_due) || 1,
    checklistTemplateId: (row.checklist_template_id as string) || null,
    logSheetTemplateId: (row.log_sheet_template_id as string) || null,
    assignedTechId: (row.assigned_tech_id as string) || null,
    isActive: row.is_active as boolean,
    lastTriggeredAt: (row.last_triggered_at as string) || null,
    nextDueAt: (row.next_due_at as string) || null,
    createdAt: row.created_at as string,
  };
}

export const dbCmmsSchedules = {
  async getAll(tenantId: string | null): Promise<CmmsSchedule[]> {
    const result = tenantId
      ? await sql`SELECT s.*, mt.name AS machine_type_name FROM cmms_maintenance_schedules s LEFT JOIN cmms_machine_types mt ON s.machine_type_id = mt.id WHERE s.tenant_id = ${tenantId} ORDER BY s.name`
      : await sql`SELECT s.*, mt.name AS machine_type_name FROM cmms_maintenance_schedules s LEFT JOIN cmms_machine_types mt ON s.machine_type_id = mt.id ORDER BY s.name`;
    return result.rows.map(mapSchedule);
  },

  async getById(id: string): Promise<CmmsSchedule | null> {
    const result = await sql`SELECT s.*, mt.name AS machine_type_name FROM cmms_maintenance_schedules s LEFT JOIN cmms_machine_types mt ON s.machine_type_id = mt.id WHERE s.id = ${id}`;
    return result.rows[0] ? mapSchedule(result.rows[0]) : null;
  },

  async getDueToday(tenantId: string): Promise<CmmsSchedule[]> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await sql`
      SELECT s.*, mt.name AS machine_type_name FROM cmms_maintenance_schedules s
      LEFT JOIN cmms_machine_types mt ON s.machine_type_id = mt.id
      WHERE s.tenant_id = ${tenantId} AND s.is_active = true
        AND s.next_due_at IS NOT NULL AND s.next_due_at <= ${today}
      ORDER BY s.next_due_at`;
    return result.rows.map(mapSchedule);
  },

  async create(tenantId: string, data: {
    machineTypeId: string;
    name: string;
    frequency: string;
    intervalDays?: number;
    intervalHours?: number;
    intervalCycles?: number;
    warningDaysBeforeDue?: number;
    checklistTemplateId?: string;
    logSheetTemplateId?: string;
    assignedTechId?: string;
    nextDueAt?: string;
  }): Promise<CmmsSchedule> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_maintenance_schedules (id, tenant_id, machine_type_id, name, frequency, interval_days, interval_hours, interval_cycles, warning_days_before_due, checklist_template_id, log_sheet_template_id, assigned_tech_id, is_active, next_due_at, created_at)
      VALUES (${id}, ${tenantId}, ${data.machineTypeId}, ${data.name}, ${data.frequency}, ${data.intervalDays || null}, ${data.intervalHours || null}, ${data.intervalCycles || null}, ${data.warningDaysBeforeDue || 1}, ${data.checklistTemplateId || null}, ${data.logSheetTemplateId || null}, ${data.assignedTechId || null}, true, ${data.nextDueAt || null}, ${createdAt})`;
    return {
      id, tenantId, machineTypeId: data.machineTypeId, name: data.name,
      frequency: data.frequency, intervalDays: data.intervalDays || null,
      intervalHours: data.intervalHours || null, intervalCycles: data.intervalCycles || null,
      warningDaysBeforeDue: data.warningDaysBeforeDue || 1,
      checklistTemplateId: data.checklistTemplateId || null,
      logSheetTemplateId: data.logSheetTemplateId || null,
      assignedTechId: data.assignedTechId || null,
      isActive: true, lastTriggeredAt: null, nextDueAt: data.nextDueAt || null, createdAt,
    };
  },

  async update(id: string, tenantId: string, data: {
    isActive?: boolean;
    assignedTechId?: string | null;
    nextDueAt?: string;
    lastTriggeredAt?: string;
  }): Promise<boolean> {
    if (data.isActive !== undefined) {
      await sql`UPDATE cmms_maintenance_schedules SET is_active = ${data.isActive} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    }
    if (data.assignedTechId !== undefined) {
      await sql`UPDATE cmms_maintenance_schedules SET assigned_tech_id = ${data.assignedTechId} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    }
    if (data.nextDueAt !== undefined) {
      await sql`UPDATE cmms_maintenance_schedules SET next_due_at = ${data.nextDueAt} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    }
    if (data.lastTriggeredAt !== undefined) {
      await sql`UPDATE cmms_maintenance_schedules SET last_triggered_at = ${data.lastTriggeredAt} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    }
    return true;
  },
};

// ─── Work Orders ──────────────────────────────────────────────────────────────

export interface CmmsWorkOrder {
  id: string;
  tenantId: string;
  workOrderNumber: string;
  type: "corrective" | "unplanned";
  status: "open" | "in_progress" | "completed" | "closed";
  machineId: string;
  machineName?: string;
  machineIdCode?: string;
  assignedToId: string | null;
  assignedToName?: string;
  breakdownReportId: string | null;
  description: string;
  resolution: string | null;
  partsUsed: string | null;
  downtimeStart: string | null;
  downtimeEnd: string | null;
  completedAt: string | null;
  closedAt: string | null;
  closedById: string | null;
  createdAt: string;
  createdById: string;
  createdByName?: string;
  procedureRevisionId: string | null;
  procedureUpdatedFlag: boolean;
}

function mapWorkOrder(row: Record<string, unknown>): CmmsWorkOrder {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    workOrderNumber: row.work_order_number as string,
    type: row.type as "corrective" | "unplanned",
    status: row.status as CmmsWorkOrder["status"],
    machineId: row.machine_id as string,
    machineName: row.machine_name as string | undefined,
    machineIdCode: row.machine_id_code as string | undefined,
    assignedToId: (row.assigned_to_id as string) || null,
    assignedToName: row.assigned_to_name as string | undefined,
    breakdownReportId: (row.breakdown_report_id as string) || null,
    description: row.description as string,
    resolution: (row.resolution as string) || null,
    partsUsed: (row.parts_used as string) || null,
    downtimeStart: (row.downtime_start as string) || null,
    downtimeEnd: (row.downtime_end as string) || null,
    completedAt: (row.completed_at as string) || null,
    closedAt: (row.closed_at as string) || null,
    closedById: (row.closed_by_id as string) || null,
    createdAt: row.created_at as string,
    createdById: row.created_by_id as string,
    createdByName: row.created_by_name as string | undefined,
    procedureRevisionId: (row.procedure_revision_id as string) || null,
    procedureUpdatedFlag: row.procedure_updated_flag as boolean,
  };
}

export const dbCmmsWorkOrders = {
  async getAll(tenantId: string | null, filters?: { status?: string; assignedToId?: string }): Promise<CmmsWorkOrder[]> {
    let result;
    if (tenantId && filters?.assignedToId) {
      result = await sql`
        SELECT wo.*, m.name AS machine_name, m.machine_id AS machine_id_code,
               u1.full_name AS assigned_to_name, u2.full_name AS created_by_name
        FROM cmms_work_orders wo
        LEFT JOIN cmms_machines m ON wo.machine_id = m.id
        LEFT JOIN users u1 ON wo.assigned_to_id = u1.id
        LEFT JOIN users u2 ON wo.created_by_id = u2.id
        WHERE wo.tenant_id = ${tenantId} AND wo.assigned_to_id = ${filters.assignedToId}
        ORDER BY wo.created_at DESC`;
    } else if (tenantId && filters?.status) {
      result = await sql`
        SELECT wo.*, m.name AS machine_name, m.machine_id AS machine_id_code,
               u1.full_name AS assigned_to_name, u2.full_name AS created_by_name
        FROM cmms_work_orders wo
        LEFT JOIN cmms_machines m ON wo.machine_id = m.id
        LEFT JOIN users u1 ON wo.assigned_to_id = u1.id
        LEFT JOIN users u2 ON wo.created_by_id = u2.id
        WHERE wo.tenant_id = ${tenantId} AND wo.status = ${filters.status}
        ORDER BY wo.created_at DESC`;
    } else if (tenantId) {
      result = await sql`
        SELECT wo.*, m.name AS machine_name, m.machine_id AS machine_id_code,
               u1.full_name AS assigned_to_name, u2.full_name AS created_by_name
        FROM cmms_work_orders wo
        LEFT JOIN cmms_machines m ON wo.machine_id = m.id
        LEFT JOIN users u1 ON wo.assigned_to_id = u1.id
        LEFT JOIN users u2 ON wo.created_by_id = u2.id
        WHERE wo.tenant_id = ${tenantId}
        ORDER BY wo.created_at DESC`;
    } else {
      result = await sql`
        SELECT wo.*, m.name AS machine_name, m.machine_id AS machine_id_code,
               u1.full_name AS assigned_to_name, u2.full_name AS created_by_name
        FROM cmms_work_orders wo
        LEFT JOIN cmms_machines m ON wo.machine_id = m.id
        LEFT JOIN users u1 ON wo.assigned_to_id = u1.id
        LEFT JOIN users u2 ON wo.created_by_id = u2.id
        ORDER BY wo.created_at DESC`;
    }
    return result.rows.map(mapWorkOrder);
  },

  async getById(id: string): Promise<CmmsWorkOrder | null> {
    const result = await sql`
      SELECT wo.*, m.name AS machine_name, m.machine_id AS machine_id_code,
             u1.full_name AS assigned_to_name, u2.full_name AS created_by_name
      FROM cmms_work_orders wo
      LEFT JOIN cmms_machines m ON wo.machine_id = m.id
      LEFT JOIN users u1 ON wo.assigned_to_id = u1.id
      LEFT JOIN users u2 ON wo.created_by_id = u2.id
      WHERE wo.id = ${id}`;
    return result.rows[0] ? mapWorkOrder(result.rows[0]) : null;
  },

  async getNextNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    const result = await sql`SELECT COUNT(*) AS cnt FROM cmms_work_orders WHERE tenant_id = ${tenantId} AND work_order_number LIKE ${prefix + "%"}`;
    const seq = Number(result.rows[0].cnt) + 1;
    return woNumber(year, seq);
  },

  async create(tenantId: string, data: {
    type: string;
    machineId: string;
    assignedToId?: string;
    breakdownReportId?: string;
    description: string;
    downtimeStart?: string;
    createdById: string;
    procedureRevisionId?: string;
  }): Promise<CmmsWorkOrder> {
    const id = uuid();
    const createdAt = now();
    const workOrderNumber = await dbCmmsWorkOrders.getNextNumber(tenantId);
    await sql`INSERT INTO cmms_work_orders (id, tenant_id, work_order_number, type, status, machine_id, assigned_to_id, breakdown_report_id, description, downtime_start, created_at, created_by_id, procedure_revision_id)
      VALUES (${id}, ${tenantId}, ${workOrderNumber}, ${data.type}, 'open', ${data.machineId}, ${data.assignedToId || null}, ${data.breakdownReportId || null}, ${data.description}, ${data.downtimeStart || null}, ${createdAt}, ${data.createdById}, ${data.procedureRevisionId || null})`;
    return {
      id, tenantId, workOrderNumber, type: data.type as "corrective" | "unplanned",
      status: "open", machineId: data.machineId, assignedToId: data.assignedToId || null,
      breakdownReportId: data.breakdownReportId || null, description: data.description,
      resolution: null, partsUsed: null, downtimeStart: data.downtimeStart || null,
      downtimeEnd: null, completedAt: null, closedAt: null, closedById: null,
      createdAt, createdById: data.createdById, procedureRevisionId: data.procedureRevisionId || null,
      procedureUpdatedFlag: false,
    };
  },

  async update(id: string, tenantId: string, data: {
    status?: string;
    assignedToId?: string | null;
    resolution?: string;
    partsUsed?: string;
    downtimeStart?: string;
    procedureUpdatedFlag?: boolean;
  }): Promise<boolean> {
    if (data.status === "completed") {
      const result = await sql`UPDATE cmms_work_orders SET status = ${data.status}, resolution = ${data.resolution || null}, parts_used = ${data.partsUsed || null}, completed_at = ${now()} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    if (data.status !== undefined) {
      const result = await sql`UPDATE cmms_work_orders SET status = ${data.status} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    if (data.resolution !== undefined || data.partsUsed !== undefined) {
      const result = await sql`UPDATE cmms_work_orders SET resolution = ${data.resolution || null}, parts_used = ${data.partsUsed || null} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    if (data.assignedToId !== undefined) {
      const result = await sql`UPDATE cmms_work_orders SET assigned_to_id = ${data.assignedToId} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    if (data.procedureUpdatedFlag !== undefined) {
      const result = await sql`UPDATE cmms_work_orders SET procedure_updated_flag = ${data.procedureUpdatedFlag} WHERE id = ${id} AND tenant_id = ${tenantId}`;
      return (result.rowCount ?? 0) > 0;
    }
    return false;
  },

  async close(id: string, tenantId: string, closedById: string, downtimeEnd?: string): Promise<boolean> {
    const result = await sql`UPDATE cmms_work_orders SET status = 'closed', closed_at = ${now()}, closed_by_id = ${closedById}, downtime_end = ${downtimeEnd || null} WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return (result.rowCount ?? 0) > 0;
  },
};

// ─── Breakdown Reports ────────────────────────────────────────────────────────

export interface CmmsBreakdownReport {
  id: string;
  tenantId: string;
  machineId: string;
  machineName?: string;
  machineIdCode?: string;
  reportedById: string;
  reportedByName?: string;
  description: string;
  photoUrl: string | null;
  hasWorkOrder?: boolean;
  createdAt: string;
}

function mapBreakdown(row: Record<string, unknown>): CmmsBreakdownReport {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    machineId: row.machine_id as string,
    machineName: row.machine_name as string | undefined,
    machineIdCode: row.machine_id_code as string | undefined,
    reportedById: row.reported_by_id as string,
    reportedByName: row.reported_by_name as string | undefined,
    description: row.description as string,
    photoUrl: (row.photo_url as string) || null,
    hasWorkOrder: row.has_work_order != null ? Boolean(row.has_work_order) : undefined,
    createdAt: row.created_at as string,
  };
}

export const dbCmmsBreakdownReports = {
  async getAll(tenantId: string | null, reportedById?: string): Promise<CmmsBreakdownReport[]> {
    let result;
    if (tenantId && reportedById) {
      result = await sql`
        SELECT br.*, m.name AS machine_name, m.machine_id AS machine_id_code,
               u.full_name AS reported_by_name,
               (SELECT COUNT(*) FROM cmms_work_orders wo WHERE wo.breakdown_report_id = br.id) > 0 AS has_work_order
        FROM cmms_breakdown_reports br
        LEFT JOIN cmms_machines m ON br.machine_id = m.id
        LEFT JOIN users u ON br.reported_by_id = u.id
        WHERE br.tenant_id = ${tenantId} AND br.reported_by_id = ${reportedById}
        ORDER BY br.created_at DESC`;
    } else if (tenantId) {
      result = await sql`
        SELECT br.*, m.name AS machine_name, m.machine_id AS machine_id_code,
               u.full_name AS reported_by_name,
               (SELECT COUNT(*) FROM cmms_work_orders wo WHERE wo.breakdown_report_id = br.id) > 0 AS has_work_order
        FROM cmms_breakdown_reports br
        LEFT JOIN cmms_machines m ON br.machine_id = m.id
        LEFT JOIN users u ON br.reported_by_id = u.id
        WHERE br.tenant_id = ${tenantId}
        ORDER BY br.created_at DESC`;
    } else {
      result = await sql`
        SELECT br.*, m.name AS machine_name, m.machine_id AS machine_id_code,
               u.full_name AS reported_by_name,
               (SELECT COUNT(*) FROM cmms_work_orders wo WHERE wo.breakdown_report_id = br.id) > 0 AS has_work_order
        FROM cmms_breakdown_reports br
        LEFT JOIN cmms_machines m ON br.machine_id = m.id
        LEFT JOIN users u ON br.reported_by_id = u.id
        ORDER BY br.created_at DESC`;
    }
    return result.rows.map(mapBreakdown);
  },

  async getById(id: string): Promise<CmmsBreakdownReport | null> {
    const result = await sql`
      SELECT br.*, m.name AS machine_name, m.machine_id AS machine_id_code,
             u.full_name AS reported_by_name,
             (SELECT COUNT(*) FROM cmms_work_orders wo WHERE wo.breakdown_report_id = br.id) > 0 AS has_work_order
      FROM cmms_breakdown_reports br
      LEFT JOIN cmms_machines m ON br.machine_id = m.id
      LEFT JOIN users u ON br.reported_by_id = u.id
      WHERE br.id = ${id}`;
    return result.rows[0] ? mapBreakdown(result.rows[0]) : null;
  },

  async create(tenantId: string, data: {
    machineId: string;
    reportedById: string;
    description: string;
    photoUrl?: string;
  }): Promise<CmmsBreakdownReport> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_breakdown_reports (id, tenant_id, machine_id, reported_by_id, description, photo_url, created_at)
      VALUES (${id}, ${tenantId}, ${data.machineId}, ${data.reportedById}, ${data.description}, ${data.photoUrl || null}, ${createdAt})`;
    return {
      id, tenantId, machineId: data.machineId, reportedById: data.reportedById,
      description: data.description, photoUrl: data.photoUrl || null, createdAt,
    };
  },
};

// ─── Notifications ────────────────────────────────────────────────────────────

export interface CmmsNotification {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

function mapNotification(row: Record<string, unknown>): CmmsNotification {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    userId: row.user_id as string,
    title: row.title as string,
    message: row.message as string,
    isRead: row.is_read as boolean,
    link: (row.link as string) || null,
    createdAt: row.created_at as string,
  };
}

export const dbCmmsNotifications = {
  async getForUser(userId: string, tenantId: string): Promise<CmmsNotification[]> {
    const result = await sql`SELECT * FROM cmms_notifications WHERE user_id = ${userId} AND tenant_id = ${tenantId} ORDER BY created_at DESC LIMIT 50`;
    return result.rows.map(mapNotification);
  },

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    const result = await sql`SELECT COUNT(*) AS cnt FROM cmms_notifications WHERE user_id = ${userId} AND tenant_id = ${tenantId} AND is_read = false`;
    return Number(result.rows[0].cnt);
  },

  async markRead(id: string, userId: string): Promise<boolean> {
    const result = await sql`UPDATE cmms_notifications SET is_read = true WHERE id = ${id} AND user_id = ${userId}`;
    return (result.rowCount ?? 0) > 0;
  },

  async markAllRead(userId: string, tenantId: string): Promise<void> {
    await sql`UPDATE cmms_notifications SET is_read = true WHERE user_id = ${userId} AND tenant_id = ${tenantId}`;
  },

  async create(tenantId: string, data: {
    userId: string;
    title: string;
    message: string;
    link?: string;
  }): Promise<CmmsNotification> {
    const id = uuid();
    const createdAt = now();
    await sql`INSERT INTO cmms_notifications (id, tenant_id, user_id, title, message, is_read, link, created_at)
      VALUES (${id}, ${tenantId}, ${data.userId}, ${data.title}, ${data.message}, false, ${data.link || null}, ${createdAt})`;
    return { id, tenantId, userId: data.userId, title: data.title, message: data.message, isRead: false, link: data.link || null, createdAt };
  },

  async createForMany(tenantId: string, userIds: string[], title: string, message: string, link?: string): Promise<void> {
    const createdAt = now();
    for (const userId of userIds) {
      await sql`INSERT INTO cmms_notifications (id, tenant_id, user_id, title, message, is_read, link, created_at)
        VALUES (${uuid()}, ${tenantId}, ${userId}, ${title}, ${message}, false, ${link || null}, ${createdAt})`;
    }
  },
};
