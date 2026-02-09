import { sql } from "@vercel/postgres";
import type {
  IncidentReport,
  ChecklistTemplate,
  ChecklistSubmission,
} from "./schemas";

// ─── Table Initialization ───

let tablesInitialized = false;

async function initTables() {
  if (tablesInitialized) return;

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

  tablesInitialized = true;
}

// ─── Incidents ───

export const dbIncidents = {
  async getAll(): Promise<IncidentReport[]> {
    await initTables();
    const { rows } = await sql`
      SELECT * FROM incidents ORDER BY created_at DESC
    `;
    return rows.map(mapIncident);
  },

  async create(incident: IncidentReport): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO incidents (id, ticket_id, reporter_name, plant, category, description, criticality, incident_date, photo_url, status, created_at)
      VALUES (${incident.id}, ${incident.ticketId}, ${incident.reporterName}, ${incident.plant}, ${incident.category}, ${incident.description}, ${incident.criticality}, ${incident.incidentDate}, ${incident.photoUrl || null}, ${incident.status}, ${incident.createdAt})
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
    const { rowCount } = await sql`
      DELETE FROM incidents WHERE id = ${id}
    `;
    return (rowCount ?? 0) > 0;
  },
};

// ─── Checklist Templates ───

export const dbTemplates = {
  async getAll(filters?: {
    type?: string;
    active?: boolean;
  }): Promise<ChecklistTemplate[]> {
    await initTables();

    if (filters?.type && filters?.active !== undefined) {
      const { rows } = await sql`
        SELECT * FROM checklist_templates WHERE type = ${filters.type} AND active = ${filters.active} ORDER BY created_at DESC
      `;
      return rows.map(mapTemplate);
    }
    if (filters?.type) {
      const { rows } = await sql`
        SELECT * FROM checklist_templates WHERE type = ${filters.type} ORDER BY created_at DESC
      `;
      return rows.map(mapTemplate);
    }
    if (filters?.active !== undefined) {
      const { rows } = await sql`
        SELECT * FROM checklist_templates WHERE active = ${filters.active} ORDER BY created_at DESC
      `;
      return rows.map(mapTemplate);
    }

    const { rows } = await sql`
      SELECT * FROM checklist_templates ORDER BY created_at DESC
    `;
    return rows.map(mapTemplate);
  },

  async getById(id: string): Promise<ChecklistTemplate | null> {
    await initTables();
    const { rows } = await sql`
      SELECT * FROM checklist_templates WHERE id = ${id}
    `;
    return rows.length > 0 ? mapTemplate(rows[0]) : null;
  },

  async create(template: ChecklistTemplate): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO checklist_templates (id, title, type, description, items, active, created_at)
      VALUES (${template.id}, ${template.title}, ${template.type}, ${template.description || null}, ${JSON.stringify(template.items)}, ${template.active}, ${template.createdAt})
    `;
  },

  async update(
    id: string,
    data: Partial<ChecklistTemplate>
  ): Promise<boolean> {
    await initTables();
    if (data.active !== undefined) {
      const { rowCount } = await sql`
        UPDATE checklist_templates SET active = ${data.active} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    if (data.title) {
      const { rowCount } = await sql`
        UPDATE checklist_templates SET title = ${data.title} WHERE id = ${id}
      `;
      return (rowCount ?? 0) > 0;
    }
    return false;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`
      DELETE FROM checklist_templates WHERE id = ${id}
    `;
    return (rowCount ?? 0) > 0;
  },
};

// ─── Checklist Submissions ───

export const dbSubmissions = {
  async getAll(filters?: {
    type?: string;
    shift?: string;
  }): Promise<ChecklistSubmission[]> {
    await initTables();

    if (filters?.type && filters?.shift) {
      const { rows } = await sql`
        SELECT * FROM checklist_submissions WHERE template_type = ${filters.type} AND shift = ${filters.shift} ORDER BY submitted_at DESC
      `;
      return rows.map(mapSubmission);
    }
    if (filters?.type) {
      const { rows } = await sql`
        SELECT * FROM checklist_submissions WHERE template_type = ${filters.type} ORDER BY submitted_at DESC
      `;
      return rows.map(mapSubmission);
    }
    if (filters?.shift) {
      const { rows } = await sql`
        SELECT * FROM checklist_submissions WHERE shift = ${filters.shift} ORDER BY submitted_at DESC
      `;
      return rows.map(mapSubmission);
    }

    const { rows } = await sql`
      SELECT * FROM checklist_submissions ORDER BY submitted_at DESC
    `;
    return rows.map(mapSubmission);
  },

  async create(submission: ChecklistSubmission): Promise<void> {
    await initTables();
    await sql`
      INSERT INTO checklist_submissions (id, submission_id, template_id, template_title, template_type, person_name, shift, responses, notes, submitted_at)
      VALUES (${submission.id}, ${submission.submissionId}, ${submission.templateId}, ${submission.templateTitle}, ${submission.templateType}, ${submission.personName}, ${submission.shift}, ${JSON.stringify(submission.responses)}, ${submission.notes || null}, ${submission.submittedAt})
    `;
  },

  async delete(id: string): Promise<boolean> {
    await initTables();
    const { rowCount } = await sql`
      DELETE FROM checklist_submissions WHERE id = ${id}
    `;
    return (rowCount ?? 0) > 0;
  },

  async deleteCleanBefore(cutoffDate: string): Promise<number> {
    // This needs to be done in app logic since we check JSONB flags
    // We'll fetch, check flags, and delete clean ones
    await initTables();
    const { rows } = await sql`
      SELECT * FROM checklist_submissions WHERE submitted_at < ${cutoffDate}
    `;
    let removed = 0;
    for (const row of rows) {
      const sub = mapSubmission(row);
      if (!hasFlags(sub)) {
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

function hasFlags(sub: ChecklistSubmission): boolean {
  for (const r of sub.responses) {
    if (r.itemType === "checkbox" && r.checkboxValue === false) return true;
    if (r.itemType === "pass_fail" && r.passFail === "fail") return true;
    if (r.itemType === "numeric" && r.numericValue !== undefined) {
      if (r.numericMin !== undefined && r.numericValue < r.numericMin) return true;
      if (r.numericMax !== undefined && r.numericValue > r.numericMax) return true;
    }
  }
  return false;
}
