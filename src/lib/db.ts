import { sql } from "@vercel/postgres";
import type {
  IncidentReport,
  ChecklistTemplate,
  ChecklistSubmission,
  QualityDocument,
  User,
  UserRole,
  Shipment,
  ShipmentStatus,
  ShipmentType,
  QualityTemplate,
  QualityDocumentV2,
  QualityTemplateField,
  QualityFieldValue,
  QualityDocRowV2,
  DocumentFolder,
  InstructionDocument,
  Tenant,
} from "./schemas";
import { getFlags } from "./flags";

const FPI_ID = "00000000-0000-0000-0000-000000000001";

// ─── Table Initialization ───

let tablesInitialized = false;

async function initTables() {
  if (tablesInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS incidents (
      id UUID PRIMARY KEY,
      ticket_id VARCHAR(20) NOT NULL UNIQUE,
      reporter_name VARCHAR(100) NOT NULL,
      plant VARCHAR(20) NOT NULL,
      category VARCHAR(20) NOT NULL,
      description TEXT NOT NULL,
      criticality VARCHAR(10) NOT NULL,
      incident_date VARCHAR(50) NOT NULL,
      photo_url TEXT,
      status VARCHAR(20) DEFAULT 'open',
      created_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id UUID PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      type VARCHAR(30) NOT NULL,
      description TEXT,
      items JSONB NOT NULL DEFAULT '[]',
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS checklist_submissions (
      id UUID PRIMARY KEY,
      submission_id VARCHAR(20) NOT NULL UNIQUE,
      template_id UUID NOT NULL,
      template_title VARCHAR(200) NOT NULL,
      template_type VARCHAR(30) NOT NULL,
      person_name VARCHAR(100) NOT NULL,
      shift VARCHAR(10) NOT NULL,
      responses JSONB NOT NULL DEFAULT '[]',
      notes TEXT,
      submitted_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL,
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shipments (
      id UUID PRIMARY KEY,
      shipment_id VARCHAR(20) NOT NULL UNIQUE,
      type VARCHAR(10) NOT NULL,
      po_number VARCHAR(100) NOT NULL,
      material_code VARCHAR(100) NOT NULL,
      supplier_name VARCHAR(200),
      customer_name VARCHAR(200),
      carrier VARCHAR(200) NOT NULL,
      shipment_date VARCHAR(50) NOT NULL,
      notes TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS quality_documents (
      id UUID PRIMARY KEY,
      doc_id VARCHAR(20) NOT NULL UNIQUE,
      po_number VARCHAR(100) NOT NULL,
      material_code VARCHAR(100) NOT NULL,
      customer_name VARCHAR(200) NOT NULL,
      customer_po VARCHAR(100) NOT NULL,
      tare_weight NUMERIC NOT NULL DEFAULT 75,
      row_count INT NOT NULL,
      person_name VARCHAR(100),
      rows JSONB NOT NULL DEFAULT '[]',
      status VARCHAR(20) DEFAULT 'draft',
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS quality_templates (
      id UUID PRIMARY KEY,
      template_id VARCHAR(20) NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      header_fields JSONB NOT NULL DEFAULT '[]',
      row_fields JSONB NOT NULL DEFAULT '[]',
      active BOOLEAN DEFAULT true,
      default_row_count INT DEFAULT 1,
      min_row_count INT,
      max_row_count INT,
      tenant_id VARCHAR(50),
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS quality_documents_v2 (
      id UUID PRIMARY KEY,
      doc_id VARCHAR(20) NOT NULL UNIQUE,
      template_id UUID NOT NULL,
      template_title VARCHAR(200) NOT NULL,
      header_values JSONB NOT NULL DEFAULT '[]',
      rows JSONB NOT NULL DEFAULT '[]',
      row_count INT NOT NULL,
      status VARCHAR(20) DEFAULT 'draft',
      worker_name VARCHAR(100),
      quality_tech_name VARCHAR(100),
      tenant_id VARCHAR(50),
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL,
      worker_filled_at VARCHAR(50),
      completed_at VARCHAR(50)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS document_folders (
      id UUID PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      created_at VARCHAR(50) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS instruction_documents (
      id UUID PRIMARY KEY,
      folder_id UUID NOT NULL,
      folder_name VARCHAR(200) NOT NULL,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      file_name VARCHAR(500) NOT NULL,
      file_url TEXT NOT NULL,
      file_size INT NOT NULL,
      previous_file_url TEXT,
      previous_file_name VARCHAR(500),
      allowed_roles JSONB NOT NULL DEFAULT '[]',
      uploaded_by VARCHAR(100) NOT NULL,
      uploaded_by_user_id VARCHAR(50) NOT NULL,
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;

  // ── Tenant isolation columns (idempotent migrations) ──
  await sql`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE checklist_submissions ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE shipments ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE quality_documents ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS tenant_id UUID`;
  await sql`ALTER TABLE instruction_documents ADD COLUMN IF NOT EXISTS tenant_id UUID`;

  // ── Seed FPI tenant ──
  const now = new Date().toISOString();
  await sql`
    INSERT INTO tenants (id, name, code, active, created_at)
    VALUES (${FPI_ID}, 'FPI', 'FPI', true, ${now})
    ON CONFLICT (code) DO NOTHING
  `;

  // ── Migrate existing data to FPI tenant ──
  await sql`UPDATE incidents SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE checklist_templates SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE checklist_submissions SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE users SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL AND role != 'super_admin'`;
  await sql`UPDATE shipments SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE quality_documents SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE quality_templates SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE quality_documents_v2 SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE document_folders SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;
  await sql`UPDATE instruction_documents SET tenant_id = ${FPI_ID} WHERE tenant_id IS NULL`;

  tablesInitialized = true;
}

// ─── Tenants ───

export const dbTenants = {
  async getAll(): Promise<Tenant[]> {
    await initTables();
    const { rows } = await sql`SELECT * FROM tenants ORDER BY name ASC`;
    return rows.map(mapTenant);
  },

  async getById(id: string): Promise<Tenant | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM tenants WHERE id = ${id}`;
    return rows.length > 0 ? mapTenant(rows[0]) : null;
  },

  async getByCode(code: string): Promise<Tenant | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM tenants WHERE code = ${code} AND active = true`;
    return rows.length > 0 ? mapTenant(rows[0]) : null;
  },

  async create(tenant: Tenant): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO tenants (id, name, code, active, created_at)
      VALUES (${tenant.id}, ${tenant.name}, ${tenant.code}, ${tenant.active}, ${tenant.createdAt})
    `;
  },
};

function mapTenant(row: Record<string, unknown>): Tenant {
  return {
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    active: row.active as boolean,
    createdAt: row.created_at as string,
  };
}

// ─── Incidents ───

export const dbIncidents = {
  async getAll(tenantId: string | null): Promise<IncidentReport[]> {
    await initTables();
    if (tenantId !== null) {
      const { rows } = await sql`
        SELECT * FROM incidents WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
      `;
      return rows.map(mapIncident);
    }
    const { rows } = await sql`SELECT * FROM incidents ORDER BY created_at DESC`;
    return rows.map(mapIncident);
  },

  async create(incident: IncidentReport, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO incidents (id, ticket_id, reporter_name, plant, category, description, criticality, incident_date, photo_url, status, created_at, tenant_id)
      VALUES (${incident.id}, ${incident.ticketId}, ${incident.reporterName}, ${incident.plant}, ${incident.category}, ${incident.description}, ${incident.criticality}, ${incident.incidentDate}, ${incident.photoUrl || null}, ${incident.status}, ${incident.createdAt}, ${tenantId})
    `;
  },

  async update(id: string, data: Partial<IncidentReport>): Promise<boolean> {
    await initTables();
    if (data.status) {
      const { rowCount } = await sql`
        UPDATE incidents SET status = ${data.status} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    return false;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM incidents WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

// ─── Checklist Templates ───

export const dbTemplates = {
  async getAll(
    tenantId: string | null,
    filters?: { type?: string; active?: boolean }
  ): Promise<ChecklistTemplate[]> {
    await initTables();
    const type = filters?.type;
    const active = filters?.active;

    if (tenantId !== null) {
      if (type !== undefined && active !== undefined) {
        const { rows } = await sql`SELECT * FROM checklist_templates WHERE tenant_id = ${tenantId} AND type = ${type} AND active = ${active} ORDER BY created_at DESC`;
        return rows.map(mapTemplate);
      }
      if (type !== undefined) {
        const { rows } = await sql`SELECT * FROM checklist_templates WHERE tenant_id = ${tenantId} AND type = ${type} ORDER BY created_at DESC`;
        return rows.map(mapTemplate);
      }
      if (active !== undefined) {
        const { rows } = await sql`SELECT * FROM checklist_templates WHERE tenant_id = ${tenantId} AND active = ${active} ORDER BY created_at DESC`;
        return rows.map(mapTemplate);
      }
      const { rows } = await sql`SELECT * FROM checklist_templates WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
      return rows.map(mapTemplate);
    }

    // super_admin: no tenant filter
    if (type !== undefined && active !== undefined) {
      const { rows } = await sql`SELECT * FROM checklist_templates WHERE type = ${type} AND active = ${active} ORDER BY created_at DESC`;
      return rows.map(mapTemplate);
    }
    if (type !== undefined) {
      const { rows } = await sql`SELECT * FROM checklist_templates WHERE type = ${type} ORDER BY created_at DESC`;
      return rows.map(mapTemplate);
    }
    if (active !== undefined) {
      const { rows } = await sql`SELECT * FROM checklist_templates WHERE active = ${active} ORDER BY created_at DESC`;
      return rows.map(mapTemplate);
    }
    const { rows } = await sql`SELECT * FROM checklist_templates ORDER BY created_at DESC`;
    return rows.map(mapTemplate);
  },

  async getById(id: string): Promise<ChecklistTemplate | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM checklist_templates WHERE id = ${id}`;
    return rows.length > 0 ? mapTemplate(rows[0]) : null;
  },

  async create(template: ChecklistTemplate, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO checklist_templates (id, title, type, description, items, active, created_at, tenant_id)
      VALUES (${template.id}, ${template.title}, ${template.type}, ${template.description || null}, ${JSON.stringify(template.items)}, ${template.active}, ${template.createdAt}, ${tenantId})
    `;
  },

  async update(id: string, data: Partial<ChecklistTemplate>): Promise<boolean> {
    await initTables();
    if (data.active !== undefined) {
      const { rowCount } = await sql`UPDATE checklist_templates SET active = ${data.active} WHERE id = ${id}`;
      return (rowCount ?? 0) > 0;
    }
    if (data.title) {
      const { rowCount } = await sql`UPDATE checklist_templates SET title = ${data.title} WHERE id = ${id}`;
      return (rowCount ?? 0) > 0;
    }
    return false;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM checklist_templates WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

// ─── Checklist Submissions ───

export const dbSubmissions = {
  async getAll(
    tenantId: string | null,
    filters?: { type?: string; shift?: string }
  ): Promise<ChecklistSubmission[]> {
    await initTables();
    const type = filters?.type;
    const shift = filters?.shift;

    if (tenantId !== null) {
      if (type !== undefined && shift !== undefined) {
        const { rows } = await sql`SELECT * FROM checklist_submissions WHERE tenant_id = ${tenantId} AND template_type = ${type} AND shift = ${shift} ORDER BY submitted_at DESC`;
        return rows.map(mapSubmission);
      }
      if (type !== undefined) {
        const { rows } = await sql`SELECT * FROM checklist_submissions WHERE tenant_id = ${tenantId} AND template_type = ${type} ORDER BY submitted_at DESC`;
        return rows.map(mapSubmission);
      }
      if (shift !== undefined) {
        const { rows } = await sql`SELECT * FROM checklist_submissions WHERE tenant_id = ${tenantId} AND shift = ${shift} ORDER BY submitted_at DESC`;
        return rows.map(mapSubmission);
      }
      const { rows } = await sql`SELECT * FROM checklist_submissions WHERE tenant_id = ${tenantId} ORDER BY submitted_at DESC`;
      return rows.map(mapSubmission);
    }

    // super_admin: no tenant filter
    if (type !== undefined && shift !== undefined) {
      const { rows } = await sql`SELECT * FROM checklist_submissions WHERE template_type = ${type} AND shift = ${shift} ORDER BY submitted_at DESC`;
      return rows.map(mapSubmission);
    }
    if (type !== undefined) {
      const { rows } = await sql`SELECT * FROM checklist_submissions WHERE template_type = ${type} ORDER BY submitted_at DESC`;
      return rows.map(mapSubmission);
    }
    if (shift !== undefined) {
      const { rows } = await sql`SELECT * FROM checklist_submissions WHERE shift = ${shift} ORDER BY submitted_at DESC`;
      return rows.map(mapSubmission);
    }
    const { rows } = await sql`SELECT * FROM checklist_submissions ORDER BY submitted_at DESC`;
    return rows.map(mapSubmission);
  },

  async create(submission: ChecklistSubmission, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO checklist_submissions (id, submission_id, template_id, template_title, template_type, person_name, shift, responses, notes, submitted_at, tenant_id)
      VALUES (${submission.id}, ${submission.submissionId}, ${submission.templateId}, ${submission.templateTitle}, ${submission.templateType}, ${submission.personName}, ${submission.shift}, ${JSON.stringify(submission.responses)}, ${submission.notes || null}, ${submission.submittedAt}, ${tenantId})
    `;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM checklist_submissions WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },

  async deleteCleanBefore(cutoffDate: string, tenantId: string | null): Promise<number> {
    await initTables();
    let rows: Record<string, unknown>[];
    if (tenantId !== null) {
      const result = await sql`
        SELECT * FROM checklist_submissions WHERE submitted_at < ${cutoffDate} AND tenant_id = ${tenantId}
      `;
      rows = result.rows;
    } else {
      const result = await sql`
        SELECT * FROM checklist_submissions WHERE submitted_at < ${cutoffDate}
      `;
      rows = result.rows;
    }
    let removed = 0;
    for (const row of rows) {
      const sub = mapSubmission(row);
      if (getFlags(sub).length === 0) {
        await sql`DELETE FROM checklist_submissions WHERE id = ${sub.id}`;
        removed++;
      }
    }
    return removed;
  },
};

// ─── Row Mappers ───

function mapIncident(row: Record<string, unknown>): IncidentReport {
  return {
    id: row.id as string,
    ticketId: row.ticket_id as string,
    reporterName: row.reporter_name as string,
    plant: row.plant as "plant-a" | "plant-b",
    category: row.category as "safety" | "equipment" | "quality" | "environmental",
    description: row.description as string,
    criticality: row.criticality as "minor" | "major" | "critical",
    incidentDate: row.incident_date as string,
    photoUrl: (row.photo_url as string) || undefined,
    status: row.status as "open" | "in_progress" | "resolved",
    createdAt: row.created_at as string,
  };
}

function mapTemplate(row: Record<string, unknown>): ChecklistTemplate {
  return {
    id: row.id as string,
    title: row.title as string,
    type: row.type as ChecklistTemplate["type"],
    description: (row.description as string) || undefined,
    items: typeof row.items === "string" ? JSON.parse(row.items as string) : row.items as ChecklistTemplate["items"],
    active: row.active as boolean,
    createdAt: row.created_at as string,
  };
}

function mapSubmission(row: Record<string, unknown>): ChecklistSubmission {
  return {
    id: row.id as string,
    submissionId: row.submission_id as string,
    templateId: row.template_id as string,
    templateTitle: row.template_title as string,
    templateType: row.template_type as ChecklistSubmission["templateType"],
    personName: row.person_name as string,
    shift: row.shift as "day" | "night",
    responses: typeof row.responses === "string" ? JSON.parse(row.responses as string) : row.responses as ChecklistSubmission["responses"],
    notes: (row.notes as string) || undefined,
    submittedAt: row.submitted_at as string,
  };
}

// ─── Quality Documents ───

export const dbQualityDocs = {
  async getAll(tenantId: string | null, filters?: { status?: string }): Promise<QualityDocument[]> {
    await initTables();
    if (tenantId !== null) {
      if (filters?.status) {
        const { rows } = await sql`SELECT * FROM quality_documents WHERE tenant_id = ${tenantId} AND status = ${filters.status} ORDER BY created_at DESC`;
        return rows.map(mapQualityDoc);
      }
      const { rows } = await sql`SELECT * FROM quality_documents WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
      return rows.map(mapQualityDoc);
    }
    if (filters?.status) {
      const { rows } = await sql`SELECT * FROM quality_documents WHERE status = ${filters.status} ORDER BY created_at DESC`;
      return rows.map(mapQualityDoc);
    }
    const { rows } = await sql`SELECT * FROM quality_documents ORDER BY created_at DESC`;
    return rows.map(mapQualityDoc);
  },

  async getById(id: string): Promise<QualityDocument | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM quality_documents WHERE id = ${id}`;
    return rows.length > 0 ? mapQualityDoc(rows[0]) : null;
  },

  async create(doc: QualityDocument, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO quality_documents (id, doc_id, po_number, material_code, customer_name, customer_po, tare_weight, row_count, person_name, rows, status, created_at, updated_at, tenant_id)
      VALUES (${doc.id}, ${doc.docId}, ${doc.poNumber}, ${doc.materialCode}, ${doc.customerName}, ${doc.customerPo}, ${doc.tareWeight}, ${doc.rowCount}, ${doc.personName || null}, ${JSON.stringify(doc.rows)}, ${doc.status}, ${doc.createdAt}, ${doc.updatedAt}, ${tenantId})
    `;
  },

  async update(id: string, data: Partial<QualityDocument>): Promise<boolean> {
    await initTables();
    const now = new Date().toISOString();

    if (data.rows !== undefined && data.status !== undefined && data.personName !== undefined) {
      const { rowCount } = await sql`
        UPDATE quality_documents SET rows = ${JSON.stringify(data.rows)}, status = ${data.status}, person_name = ${data.personName}, updated_at = ${now} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    if (data.rows !== undefined && data.status !== undefined) {
      const { rowCount } = await sql`
        UPDATE quality_documents SET rows = ${JSON.stringify(data.rows)}, status = ${data.status}, updated_at = ${now} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    if (data.rows !== undefined) {
      const { rowCount } = await sql`
        UPDATE quality_documents SET rows = ${JSON.stringify(data.rows)}, updated_at = ${now} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    if (data.status !== undefined) {
      const { rowCount } = await sql`
        UPDATE quality_documents SET status = ${data.status}, updated_at = ${now} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    return false;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM quality_documents WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

function mapQualityDoc(row: Record<string, unknown>): QualityDocument {
  return {
    id: row.id as string,
    docId: row.doc_id as string,
    poNumber: row.po_number as string,
    materialCode: row.material_code as string,
    customerName: row.customer_name as string,
    customerPo: row.customer_po as string,
    tareWeight: Number(row.tare_weight),
    rowCount: row.row_count as number,
    personName: (row.person_name as string) || undefined,
    rows: typeof row.rows === "string" ? JSON.parse(row.rows as string) : row.rows as QualityDocument["rows"],
    status: row.status as QualityDocument["status"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Users ───

export const dbUsers = {
  async getAll(tenantId: string | null): Promise<User[]> {
    await initTables();
    if (tenantId !== null) {
      const { rows } = await sql`
        SELECT id, username, full_name, role, active, tenant_id, created_at, updated_at FROM users WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
      `;
      return rows.map(mapUser);
    }
    const { rows } = await sql`
      SELECT id, username, full_name, role, active, tenant_id, created_at, updated_at FROM users ORDER BY created_at DESC
    `;
    return rows.map(mapUser);
  },

  async getAllWithTenantName(): Promise<(User & { tenantName: string | null })[]> {
    await initTables();
    const { rows } = await sql`
      SELECT u.id, u.username, u.full_name, u.role, u.active, u.tenant_id, u.created_at, u.updated_at, t.name as tenant_name
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      ORDER BY u.created_at DESC
    `;
    return rows.map((row) => ({
      ...mapUser(row),
      tenantName: (row.tenant_name as string) || null,
    }));
  },

  async getByUsername(username: string, tenantId: string | null): Promise<(User & { passwordHash: string }) | null> {
    await initTables();
    let rows: Record<string, unknown>[];
    if (tenantId !== null) {
      const result = await sql`
        SELECT * FROM users WHERE username = ${username} AND tenant_id = ${tenantId} AND active = true
      `;
      rows = result.rows;
    } else {
      const result = await sql`
        SELECT * FROM users WHERE username = ${username} AND tenant_id IS NULL AND active = true
      `;
      rows = result.rows;
    }
    if (rows.length === 0) return null;
    const row = rows[0];
    return { ...mapUser(row), passwordHash: row.password_hash as string };
  },

  async getById(id: string): Promise<User | null> {
    await initTables();
    const { rows } = await sql`
      SELECT id, username, full_name, role, active, tenant_id, created_at, updated_at FROM users WHERE id = ${id}
    `;
    return rows.length > 0 ? mapUser(rows[0]) : null;
  },

  async create(user: User & { passwordHash: string }, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO users (id, username, password_hash, full_name, role, active, tenant_id, created_at, updated_at)
      VALUES (${user.id}, ${user.username}, ${user.passwordHash}, ${user.fullName}, ${user.role}, ${user.active}, ${tenantId}, ${user.createdAt}, ${user.updatedAt})
    `;
  },

  async update(id: string, data: { fullName?: string; role?: UserRole; active?: boolean; passwordHash?: string }): Promise<boolean> {
    await initTables();
    const now = new Date().toISOString();
    const user = await this.getById(id);
    if (!user) return false;

    const fullName = data.fullName ?? user.fullName;
    const role = data.role ?? user.role;
    const active = data.active ?? user.active;

    if (data.passwordHash) {
      const { rowCount } = await sql`
        UPDATE users SET full_name = ${fullName}, role = ${role}, active = ${active}, password_hash = ${data.passwordHash}, updated_at = ${now} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    const { rowCount } = await sql`
      UPDATE users SET full_name = ${fullName}, role = ${role}, active = ${active}, updated_at = ${now} WHERE id = ${id}
    `;
    return (rowCount ?? 0) > 0;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM users WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    fullName: row.full_name as string,
    role: row.role as UserRole,
    active: row.active as boolean,
    tenantId: (row.tenant_id as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Shipments ───

export const dbShipments = {
  async getAll(tenantId: string | null, filters?: { type?: string; status?: string }): Promise<Shipment[]> {
    await initTables();
    const type = filters?.type;
    const status = filters?.status;

    if (tenantId !== null) {
      if (type !== undefined && status !== undefined) {
        const { rows } = await sql`SELECT * FROM shipments WHERE tenant_id = ${tenantId} AND type = ${type} AND status = ${status} ORDER BY created_at DESC`;
        return rows.map(mapShipment);
      }
      if (type !== undefined) {
        const { rows } = await sql`SELECT * FROM shipments WHERE tenant_id = ${tenantId} AND type = ${type} ORDER BY created_at DESC`;
        return rows.map(mapShipment);
      }
      if (status !== undefined) {
        const { rows } = await sql`SELECT * FROM shipments WHERE tenant_id = ${tenantId} AND status = ${status} ORDER BY created_at DESC`;
        return rows.map(mapShipment);
      }
      const { rows } = await sql`SELECT * FROM shipments WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
      return rows.map(mapShipment);
    }

    // super_admin: no tenant filter
    if (type !== undefined && status !== undefined) {
      const { rows } = await sql`SELECT * FROM shipments WHERE type = ${type} AND status = ${status} ORDER BY created_at DESC`;
      return rows.map(mapShipment);
    }
    if (type !== undefined) {
      const { rows } = await sql`SELECT * FROM shipments WHERE type = ${type} ORDER BY created_at DESC`;
      return rows.map(mapShipment);
    }
    if (status !== undefined) {
      const { rows } = await sql`SELECT * FROM shipments WHERE status = ${status} ORDER BY created_at DESC`;
      return rows.map(mapShipment);
    }
    const { rows } = await sql`SELECT * FROM shipments ORDER BY created_at DESC`;
    return rows.map(mapShipment);
  },

  async getById(id: string): Promise<Shipment | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM shipments WHERE id = ${id}`;
    return rows.length > 0 ? mapShipment(rows[0]) : null;
  },

  async create(shipment: Shipment, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO shipments (id, shipment_id, type, po_number, material_code, supplier_name, customer_name, carrier, shipment_date, notes, status, created_at, updated_at, tenant_id)
      VALUES (${shipment.id}, ${shipment.shipmentId}, ${shipment.type}, ${shipment.poNumber}, ${shipment.materialCode}, ${shipment.supplierName || null}, ${shipment.customerName || null}, ${shipment.carrier}, ${shipment.shipmentDate}, ${shipment.notes || null}, ${shipment.status}, ${shipment.createdAt}, ${shipment.updatedAt}, ${tenantId})
    `;
  },

  async update(id: string, data: Partial<Shipment>): Promise<boolean> {
    await initTables();
    const now = new Date().toISOString();
    const existing = await this.getById(id);
    if (!existing) return false;

    const type = data.type ?? existing.type;
    const poNumber = data.poNumber ?? existing.poNumber;
    const materialCode = data.materialCode ?? existing.materialCode;
    const supplierName = data.supplierName !== undefined ? data.supplierName : existing.supplierName;
    const customerName = data.customerName !== undefined ? data.customerName : existing.customerName;
    const carrier = data.carrier ?? existing.carrier;
    const shipmentDate = data.shipmentDate ?? existing.shipmentDate;
    const notes = data.notes !== undefined ? data.notes : existing.notes;
    const status = data.status ?? existing.status;

    const { rowCount } = await sql`
      UPDATE shipments SET type = ${type}, po_number = ${poNumber}, material_code = ${materialCode}, supplier_name = ${supplierName || null}, customer_name = ${customerName || null}, carrier = ${carrier}, shipment_date = ${shipmentDate}, notes = ${notes || null}, status = ${status}, updated_at = ${now} WHERE id = ${id}
    `;
    return (rowCount ?? 0) > 0;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM shipments WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

function mapShipment(row: Record<string, unknown>): Shipment {
  return {
    id: row.id as string,
    shipmentId: row.shipment_id as string,
    type: row.type as ShipmentType,
    poNumber: row.po_number as string,
    materialCode: row.material_code as string,
    supplierName: (row.supplier_name as string) || undefined,
    customerName: (row.customer_name as string) || undefined,
    carrier: row.carrier as string,
    shipmentDate: row.shipment_date as string,
    notes: (row.notes as string) || undefined,
    status: row.status as ShipmentStatus,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Quality Templates ───

export const dbQualityTemplates = {
  async getAll(tenantId: string | null, filters?: { active?: boolean }): Promise<QualityTemplate[]> {
    await initTables();
    const active = filters?.active;

    if (tenantId !== null) {
      if (active !== undefined) {
        const { rows } = await sql`SELECT * FROM quality_templates WHERE tenant_id = ${tenantId} AND active = ${active} ORDER BY created_at DESC`;
        return rows.map(mapQualityTemplate);
      }
      const { rows } = await sql`SELECT * FROM quality_templates WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
      return rows.map(mapQualityTemplate);
    }

    // super_admin: no tenant filter
    if (active !== undefined) {
      const { rows } = await sql`SELECT * FROM quality_templates WHERE active = ${active} ORDER BY created_at DESC`;
      return rows.map(mapQualityTemplate);
    }
    const { rows } = await sql`SELECT * FROM quality_templates ORDER BY created_at DESC`;
    return rows.map(mapQualityTemplate);
  },

  async getById(id: string): Promise<QualityTemplate | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM quality_templates WHERE id = ${id}`;
    return rows.length > 0 ? mapQualityTemplate(rows[0]) : null;
  },

  async create(template: QualityTemplate, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO quality_templates (id, template_id, title, description, header_fields, row_fields, active, default_row_count, min_row_count, max_row_count, tenant_id, created_at, updated_at)
      VALUES (${template.id}, ${template.templateId}, ${template.title}, ${template.description || null}, ${JSON.stringify(template.headerFields)}, ${JSON.stringify(template.rowFields)}, ${template.active}, ${template.defaultRowCount}, ${template.minRowCount ?? null}, ${template.maxRowCount ?? null}, ${tenantId}, ${template.createdAt}, ${template.updatedAt})
    `;
  },

  async update(id: string, data: Partial<QualityTemplate>): Promise<boolean> {
    await initTables();
    const now = new Date().toISOString();
    if (data.active !== undefined) {
      const { rowCount } = await sql`UPDATE quality_templates SET active = ${data.active}, updated_at = ${now} WHERE id = ${id}`;
      return (rowCount ?? 0) > 0;
    }
    if (data.title) {
      const { rowCount } = await sql`UPDATE quality_templates SET title = ${data.title}, updated_at = ${now} WHERE id = ${id}`;
      return (rowCount ?? 0) > 0;
    }
    return false;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM quality_templates WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

function mapQualityTemplate(row: Record<string, unknown>): QualityTemplate {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    title: row.title as string,
    description: (row.description as string) || undefined,
    headerFields: (typeof row.header_fields === "string" ? JSON.parse(row.header_fields as string) : row.header_fields) as QualityTemplateField[],
    rowFields: (typeof row.row_fields === "string" ? JSON.parse(row.row_fields as string) : row.row_fields) as QualityTemplateField[],
    active: row.active as boolean,
    defaultRowCount: row.default_row_count as number,
    minRowCount: (row.min_row_count as number) || undefined,
    maxRowCount: (row.max_row_count as number) || undefined,
    tenantId: (row.tenant_id as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Quality Documents V2 ───

export const dbQualityDocsV2 = {
  async getAll(tenantId: string | null, filters?: { status?: string; templateId?: string }): Promise<QualityDocumentV2[]> {
    await initTables();
    const status = filters?.status;
    const templateId = filters?.templateId;

    if (tenantId !== null) {
      if (status !== undefined && templateId !== undefined) {
        const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE tenant_id = ${tenantId} AND status = ${status} AND template_id = ${templateId} ORDER BY created_at DESC`;
        return rows.map(mapQualityDocV2);
      }
      if (status !== undefined) {
        const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE tenant_id = ${tenantId} AND status = ${status} ORDER BY created_at DESC`;
        return rows.map(mapQualityDocV2);
      }
      if (templateId !== undefined) {
        const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE tenant_id = ${tenantId} AND template_id = ${templateId} ORDER BY created_at DESC`;
        return rows.map(mapQualityDocV2);
      }
      const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
      return rows.map(mapQualityDocV2);
    }

    // super_admin: no tenant filter
    if (status !== undefined && templateId !== undefined) {
      const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE status = ${status} AND template_id = ${templateId} ORDER BY created_at DESC`;
      return rows.map(mapQualityDocV2);
    }
    if (status !== undefined) {
      const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE status = ${status} ORDER BY created_at DESC`;
      return rows.map(mapQualityDocV2);
    }
    if (templateId !== undefined) {
      const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE template_id = ${templateId} ORDER BY created_at DESC`;
      return rows.map(mapQualityDocV2);
    }
    const { rows } = await sql`SELECT * FROM quality_documents_v2 ORDER BY created_at DESC`;
    return rows.map(mapQualityDocV2);
  },

  async getById(id: string): Promise<QualityDocumentV2 | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM quality_documents_v2 WHERE id = ${id}`;
    return rows.length > 0 ? mapQualityDocV2(rows[0]) : null;
  },

  async create(doc: QualityDocumentV2, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO quality_documents_v2 (id, doc_id, template_id, template_title, header_values, rows, row_count, status, worker_name, quality_tech_name, tenant_id, created_at, updated_at, worker_filled_at, completed_at)
      VALUES (${doc.id}, ${doc.docId}, ${doc.templateId}, ${doc.templateTitle}, ${JSON.stringify(doc.headerValues)}, ${JSON.stringify(doc.rows)}, ${doc.rowCount}, ${doc.status}, ${doc.workerName || null}, ${doc.qualityTechName || null}, ${tenantId}, ${doc.createdAt}, ${doc.updatedAt}, ${doc.workerFilledAt || null}, ${doc.completedAt || null})
    `;
  },

  async update(id: string, data: Partial<QualityDocumentV2>): Promise<boolean> {
    await initTables();
    const now = new Date().toISOString();
    const existing = await this.getById(id);
    if (!existing) return false;

    const headerValues = data.headerValues !== undefined ? JSON.stringify(data.headerValues) : JSON.stringify(existing.headerValues);
    const rows = data.rows !== undefined ? JSON.stringify(data.rows) : JSON.stringify(existing.rows);
    const status = data.status ?? existing.status;
    const workerName = data.workerName !== undefined ? data.workerName : existing.workerName;
    const qualityTechName = data.qualityTechName !== undefined ? data.qualityTechName : existing.qualityTechName;
    const workerFilledAt = data.workerFilledAt !== undefined ? data.workerFilledAt : existing.workerFilledAt;
    const completedAt = data.completedAt !== undefined ? data.completedAt : existing.completedAt;

    const { rowCount } = await sql`
      UPDATE quality_documents_v2
      SET header_values = ${headerValues}::jsonb,
          rows = ${rows}::jsonb,
          status = ${status},
          worker_name = ${workerName || null},
          quality_tech_name = ${qualityTechName || null},
          worker_filled_at = ${workerFilledAt || null},
          completed_at = ${completedAt || null},
          updated_at = ${now}
      WHERE id = ${id}
    `;
    return (rowCount ?? 0) > 0;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM quality_documents_v2 WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

function mapQualityDocV2(row: Record<string, unknown>): QualityDocumentV2 {
  return {
    id: row.id as string,
    docId: row.doc_id as string,
    templateId: row.template_id as string,
    templateTitle: row.template_title as string,
    headerValues: (typeof row.header_values === "string" ? JSON.parse(row.header_values as string) : row.header_values) as QualityFieldValue[],
    rows: (typeof row.rows === "string" ? JSON.parse(row.rows as string) : row.rows) as QualityDocRowV2[],
    rowCount: row.row_count as number,
    status: row.status as QualityDocumentV2["status"],
    workerName: (row.worker_name as string) || undefined,
    qualityTechName: (row.quality_tech_name as string) || undefined,
    tenantId: (row.tenant_id as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    workerFilledAt: (row.worker_filled_at as string) || undefined,
    completedAt: (row.completed_at as string) || undefined,
  };
}

// ─── Document Folders ───

export const dbDocumentFolders = {
  async getAll(tenantId: string | null): Promise<DocumentFolder[]> {
    await initTables();
    if (tenantId !== null) {
      const { rows } = await sql`SELECT * FROM document_folders WHERE tenant_id = ${tenantId} ORDER BY name ASC`;
      return rows.map(mapDocumentFolder);
    }
    const { rows } = await sql`SELECT * FROM document_folders ORDER BY name ASC`;
    return rows.map(mapDocumentFolder);
  },

  async getById(id: string): Promise<DocumentFolder | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM document_folders WHERE id = ${id}`;
    return rows.length > 0 ? mapDocumentFolder(rows[0]) : null;
  },

  async create(folder: DocumentFolder, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO document_folders (id, name, description, created_at, tenant_id)
      VALUES (${folder.id}, ${folder.name}, ${folder.description || null}, ${folder.createdAt}, ${tenantId})
    `;
  },

  async update(id: string, data: { name?: string; description?: string }): Promise<boolean> {
    await initTables();
    if (data.name) {
      const { rowCount } = await sql`UPDATE document_folders SET name = ${data.name} WHERE id = ${id}`;
      await sql`UPDATE instruction_documents SET folder_name = ${data.name} WHERE folder_id = ${id}`;
      return (rowCount ?? 0) > 0;
    }
    return false;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM document_folders WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },
};

function mapDocumentFolder(row: Record<string, unknown>): DocumentFolder {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    createdAt: row.created_at as string,
  };
}

// ─── Instruction Documents ───

export const dbInstructionDocuments = {
  async getAll(tenantId: string | null, filters?: { folderId?: string; role?: string }): Promise<InstructionDocument[]> {
    await initTables();
    let rows: Record<string, unknown>[];

    if (tenantId !== null) {
      if (filters?.folderId) {
        const result = await sql`SELECT * FROM instruction_documents WHERE tenant_id = ${tenantId} AND folder_id = ${filters.folderId} ORDER BY created_at DESC`;
        rows = result.rows;
      } else {
        const result = await sql`SELECT * FROM instruction_documents WHERE tenant_id = ${tenantId} ORDER BY created_at DESC`;
        rows = result.rows;
      }
    } else {
      if (filters?.folderId) {
        const result = await sql`SELECT * FROM instruction_documents WHERE folder_id = ${filters.folderId} ORDER BY created_at DESC`;
        rows = result.rows;
      } else {
        const result = await sql`SELECT * FROM instruction_documents ORDER BY created_at DESC`;
        rows = result.rows;
      }
    }

    const docs = rows.map(mapInstructionDocument);
    if (filters?.role) {
      return docs.filter((d) => d.allowedRoles.includes(filters.role as UserRole));
    }
    return docs;
  },

  async getById(id: string): Promise<InstructionDocument | null> {
    await initTables();
    const { rows } = await sql`SELECT * FROM instruction_documents WHERE id = ${id}`;
    return rows.length > 0 ? mapInstructionDocument(rows[0]) : null;
  },

  async create(doc: InstructionDocument, tenantId: string | null): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO instruction_documents (id, folder_id, folder_name, title, description, file_name, file_url, file_size, previous_file_url, previous_file_name, allowed_roles, uploaded_by, uploaded_by_user_id, created_at, updated_at, tenant_id)
      VALUES (${doc.id}, ${doc.folderId}, ${doc.folderName}, ${doc.title}, ${doc.description || null}, ${doc.fileName}, ${doc.fileUrl}, ${doc.fileSize}, ${doc.previousFileUrl || null}, ${doc.previousFileName || null}, ${JSON.stringify(doc.allowedRoles)}::jsonb, ${doc.uploadedBy}, ${doc.uploadedByUserId}, ${doc.createdAt}, ${doc.updatedAt}, ${tenantId})
    `;
  },

  async update(id: string, data: Partial<InstructionDocument>): Promise<boolean> {
    await initTables();
    const existing = await this.getById(id);
    if (!existing) return false;

    const now = new Date().toISOString();
    const title = data.title ?? existing.title;
    const description = data.description !== undefined ? data.description : existing.description;
    const fileName = data.fileName ?? existing.fileName;
    const fileUrl = data.fileUrl ?? existing.fileUrl;
    const fileSize = data.fileSize ?? existing.fileSize;
    const previousFileUrl = data.previousFileUrl !== undefined ? data.previousFileUrl : existing.previousFileUrl;
    const previousFileName = data.previousFileName !== undefined ? data.previousFileName : existing.previousFileName;
    const allowedRoles = data.allowedRoles ?? existing.allowedRoles;

    const { rowCount } = await sql`
      UPDATE instruction_documents SET
        title = ${title},
        description = ${description || null},
        file_name = ${fileName},
        file_url = ${fileUrl},
        file_size = ${fileSize},
        previous_file_url = ${previousFileUrl || null},
        previous_file_name = ${previousFileName || null},
        allowed_roles = ${JSON.stringify(allowedRoles)}::jsonb,
        updated_at = ${now}
      WHERE id = ${id}
    `;
    return (rowCount ?? 0) > 0;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`DELETE FROM instruction_documents WHERE id = ${id}`;
    return (rowCount ?? 0) > 0;
  },

  async countByFolder(folderId: string): Promise<number> {
    await initTables();
    const { rows } = await sql`SELECT COUNT(*) as count FROM instruction_documents WHERE folder_id = ${folderId}`;
    return Number(rows[0].count);
  },
};

function mapInstructionDocument(row: Record<string, unknown>): InstructionDocument {
  return {
    id: row.id as string,
    folderId: row.folder_id as string,
    folderName: row.folder_name as string,
    title: row.title as string,
    description: (row.description as string) || undefined,
    fileName: row.file_name as string,
    fileUrl: row.file_url as string,
    fileSize: row.file_size as number,
    previousFileUrl: (row.previous_file_url as string) || undefined,
    previousFileName: (row.previous_file_name as string) || undefined,
    allowedRoles: (typeof row.allowed_roles === "string" ? JSON.parse(row.allowed_roles as string) : row.allowed_roles) as UserRole[],
    uploadedBy: row.uploaded_by as string,
    uploadedByUserId: row.uploaded_by_user_id as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
