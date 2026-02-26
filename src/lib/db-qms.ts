import { sql } from "@vercel/postgres";

// ─── Table Initialization ────────────────────────────────────────────────────

export async function initQmsTables() {
  // Auto-number counters
  await sql`CREATE TABLE IF NOT EXISTS qms_counters (
    id TEXT PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
  )`;

  // Material Types
  await sql`CREATE TABLE IF NOT EXISTS qms_material_types (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    created_at VARCHAR(50) NOT NULL
  )`;
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_material_types_code ON qms_material_types(tenant_id, code)`; } catch { /* exists */ }

  // Parameters
  await sql`CREATE TABLE IF NOT EXISTS qms_parameters (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    parameter_type VARCHAR(30) NOT NULL,
    unit VARCHAR(50),
    description TEXT,
    created_at VARCHAR(50) NOT NULL
  )`;
  await sql`ALTER TABLE qms_parameters ADD COLUMN IF NOT EXISTS formula TEXT`;

  // Inspection Templates
  await sql`CREATE TABLE IF NOT EXISTS qms_templates (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    material_type_id VARCHAR(36),
    name VARCHAR(200) NOT NULL,
    revision_number INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,
    created_by_id VARCHAR(36),
    created_at VARCHAR(50) NOT NULL
  )`;

  // Template Items
  await sql`CREATE TABLE IF NOT EXISTS qms_template_items (
    id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL,
    parameter_id VARCHAR(36) NOT NULL,
    order_num INTEGER NOT NULL DEFAULT 0,
    min_value FLOAT,
    max_value FLOAT,
    target_value FLOAT,
    is_required BOOLEAN NOT NULL DEFAULT true,
    instructions TEXT
  )`;
  await sql`ALTER TABLE qms_template_items ADD COLUMN IF NOT EXISTS reading_count INT DEFAULT 1`;

  // Lots
  await sql`CREATE TABLE IF NOT EXISTS qms_lots (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    lot_number VARCHAR(50) NOT NULL,
    customer_po_number VARCHAR(100),
    material_type_id VARCHAR(36),
    production_line_id VARCHAR(36),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_qc',
    input_weight_kg FLOAT,
    output_weight_kg FLOAT,
    yield_percentage FLOAT,
    notes TEXT,
    shipment_id VARCHAR(36),
    created_by_id VARCHAR(36),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
  )`;
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_lots_number ON qms_lots(lot_number)`; } catch { /* exists */ }

  // Inspections
  await sql`CREATE TABLE IF NOT EXISTS qms_inspections (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    lot_id VARCHAR(36) NOT NULL,
    template_id VARCHAR(36) NOT NULL,
    inspected_by_id VARCHAR(36) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    overall_result VARCHAR(20),
    notes TEXT,
    reviewed_by_id VARCHAR(36),
    reviewed_at VARCHAR(50),
    review_notes TEXT,
    submitted_at VARCHAR(50),
    created_at VARCHAR(50) NOT NULL
  )`;

  // Inspection Results
  await sql`CREATE TABLE IF NOT EXISTS qms_inspection_results (
    id VARCHAR(36) PRIMARY KEY,
    inspection_id VARCHAR(36) NOT NULL,
    parameter_id VARCHAR(36) NOT NULL,
    value TEXT,
    numeric_value FLOAT,
    is_within_spec BOOLEAN,
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    notes TEXT
  )`;

  // Inspection Photos
  await sql`CREATE TABLE IF NOT EXISTS qms_inspection_photos (
    id VARCHAR(36) PRIMARY KEY,
    inspection_id VARCHAR(36) NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    uploaded_at VARCHAR(50) NOT NULL
  )`;

  // NCRs
  await sql`CREATE TABLE IF NOT EXISTS qms_ncrs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    ncr_number VARCHAR(50) NOT NULL,
    lot_id VARCHAR(36),
    inspection_id VARCHAR(36),
    complaint_id VARCHAR(36),
    source VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    title VARCHAR(300) NOT NULL,
    description TEXT,
    affected_material_type VARCHAR(200),
    affected_quantity_kg FLOAT,
    disposition_action VARCHAR(50),
    disposition_notes TEXT,
    root_cause TEXT,
    root_cause_category VARCHAR(100),
    corrective_action TEXT,
    preventive_action TEXT,
    verification_notes TEXT,
    assigned_to_id VARCHAR(36),
    created_by_id VARCHAR(36),
    closed_by_id VARCHAR(36),
    closed_at VARCHAR(50),
    due_date VARCHAR(50),
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
  )`;
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_ncrs_number ON qms_ncrs(ncr_number)`; } catch { /* exists */ }

  // NCR Activities
  await sql`CREATE TABLE IF NOT EXISTS qms_ncr_activities (
    id VARCHAR(36) PRIMARY KEY,
    ncr_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36),
    action TEXT NOT NULL,
    notes TEXT,
    created_at VARCHAR(50) NOT NULL
  )`;

  // Complaints
  await sql`CREATE TABLE IF NOT EXISTS qms_complaints (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    complaint_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_po_number VARCHAR(100),
    lot_id VARCHAR(36),
    material_type_id VARCHAR(36),
    description TEXT NOT NULL,
    claimed_issue TEXT,
    received_date VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    ncr_id VARCHAR(36),
    resolution TEXT,
    resolved_at VARCHAR(50),
    created_by_id VARCHAR(36),
    created_at VARCHAR(50) NOT NULL
  )`;
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_complaints_number ON qms_complaints(complaint_number)`; } catch { /* exists */ }

  // COAs
  await sql`CREATE TABLE IF NOT EXISTS qms_coas (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    coa_number VARCHAR(50) NOT NULL,
    lot_id VARCHAR(36) NOT NULL,
    shipment_id VARCHAR(36),
    customer_name VARCHAR(200),
    customer_po_number VARCHAR(100),
    material_type VARCHAR(200),
    inspection_summary JSONB,
    generated_by_id VARCHAR(36),
    issued_at VARCHAR(50) NOT NULL,
    pdf_url TEXT
  )`;
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_coas_number ON qms_coas(coa_number)`; } catch { /* exists */ }
  try { await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_qms_coas_lot ON qms_coas(lot_id)`; } catch { /* exists */ }

  // Customer Specs
  await sql`CREATE TABLE IF NOT EXISTS qms_customer_specs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    material_type_id VARCHAR(36),
    parameter_id VARCHAR(36),
    min_value FLOAT,
    max_value FLOAT,
    notes TEXT,
    requires_coa BOOLEAN NOT NULL DEFAULT false,
    created_at VARCHAR(50) NOT NULL
  )`;
}

// ─── Auto-Numbering ──────────────────────────────────────────────────────────

export async function nextQmsNumber(
  tenantId: string,
  type: "LOT" | "NCR" | "COA" | "CC"
): Promise<string> {
  const year = new Date().getFullYear();
  const key = `${type}:${tenantId}:${year}`;

  // Upsert counter and increment atomically
  const result = await sql`
    INSERT INTO qms_counters (id, last_number)
    VALUES (${key}, 1)
    ON CONFLICT (id) DO UPDATE
      SET last_number = qms_counters.last_number + 1
    RETURNING last_number
  `;

  const num = result.rows[0].last_number;
  const padded = String(num).padStart(4, "0");
  return `${type}-${year}-${padded}`;
}

// ─── Material Types ──────────────────────────────────────────────────────────

export const dbQmsMaterialTypes = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT * FROM qms_material_types
      WHERE tenant_id = ${tenantId}
      ORDER BY name ASC
    `;
    return r.rows;
  },

  async create(data: {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    description?: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_material_types (id, tenant_id, name, code, description, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.name}, ${data.code}, ${data.description ?? null}, ${data.createdAt})
    `;
  },
};

// ─── Parameters ─────────────────────────────────────────────────────────────

export const dbQmsParameters = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT * FROM qms_parameters
      WHERE tenant_id = ${tenantId}
      ORDER BY name ASC
    `;
    return r.rows;
  },

  async create(data: {
    id: string;
    tenantId: string;
    name: string;
    code: string;
    parameterType: string;
    unit?: string;
    description?: string;
    formula?: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_parameters (id, tenant_id, name, code, parameter_type, unit, description, formula, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.name}, ${data.code}, ${data.parameterType}, ${data.unit ?? null}, ${data.description ?? null}, ${data.formula ?? null}, ${data.createdAt})
    `;
  },

  async update(id: string, tenantId: string, data: { name: string; unit?: string; description?: string; formula?: string | null }) {
    await sql`
      UPDATE qms_parameters
      SET
        name = ${data.name},
        unit = ${data.unit ?? null},
        description = ${data.description ?? null},
        formula = ${data.formula ?? null}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async deleteByIds(ids: string[], tenantId: string): Promise<void> {
    for (const id of ids) {
      await sql`DELETE FROM qms_template_items WHERE parameter_id = ${id}`;
      await sql`DELETE FROM qms_parameters WHERE id = ${id} AND tenant_id = ${tenantId}`;
    }
  },
};

// ─── Templates ───────────────────────────────────────────────────────────────

export const dbQmsTemplates = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT t.*, mt.name AS material_type_name
      FROM qms_templates t
      LEFT JOIN qms_material_types mt ON mt.id = t.material_type_id
      WHERE t.tenant_id = ${tenantId} AND t.is_current = true
      ORDER BY t.name ASC
    `;
    return r.rows;
  },

  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT t.*, mt.name AS material_type_name
      FROM qms_templates t
      LEFT JOIN qms_material_types mt ON mt.id = t.material_type_id
      WHERE t.id = ${id} AND t.tenant_id = ${tenantId}
    `;
    if (!r.rows[0]) return null;
    const template = r.rows[0];

    const items = await sql`
      SELECT ti.*, p.name AS parameter_name, p.code AS parameter_code,
             p.parameter_type, p.unit, p.formula
      FROM qms_template_items ti
      JOIN qms_parameters p ON p.id = ti.parameter_id
      WHERE ti.template_id = ${id}
      ORDER BY ti.order_num ASC
    `;
    template.items = items.rows;
    return template;
  },

  async create(data: {
    id: string;
    tenantId: string;
    materialTypeId?: string;
    name: string;
    revisionNumber: number;
    createdById?: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_templates (id, tenant_id, material_type_id, name, revision_number, is_current, created_by_id, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.materialTypeId ?? null}, ${data.name}, ${data.revisionNumber}, true, ${data.createdById ?? null}, ${data.createdAt})
    `;
  },

  async addItem(data: {
    id: string;
    templateId: string;
    parameterId: string;
    orderNum: number;
    minValue?: number;
    maxValue?: number;
    targetValue?: number;
    isRequired: boolean;
    instructions?: string;
    readingCount?: number;
  }) {
    await sql`
      INSERT INTO qms_template_items (id, template_id, parameter_id, order_num, min_value, max_value, target_value, is_required, instructions, reading_count)
      VALUES (${data.id}, ${data.templateId}, ${data.parameterId}, ${data.orderNum}, ${data.minValue ?? null}, ${data.maxValue ?? null}, ${data.targetValue ?? null}, ${data.isRequired}, ${data.instructions ?? null}, ${data.readingCount ?? 1})
    `;
  },

  async revise(oldId: string, newId: string, tenantId: string, newRevision: number, createdById: string, createdAt: string) {
    // Mark old as not current
    await sql`UPDATE qms_templates SET is_current = false WHERE id = ${oldId} AND tenant_id = ${tenantId}`;
    // Get old template info
    const old = await sql`SELECT * FROM qms_templates WHERE id = ${oldId}`;
    if (!old.rows[0]) return null;
    // Create new revision
    await sql`
      INSERT INTO qms_templates (id, tenant_id, material_type_id, name, revision_number, is_current, created_by_id, created_at)
      VALUES (${newId}, ${tenantId}, ${old.rows[0].material_type_id}, ${old.rows[0].name}, ${newRevision}, true, ${createdById}, ${createdAt})
    `;
    return newId;
  },
};

// ─── Lots ────────────────────────────────────────────────────────────────────

export const dbQmsLots = {
  async getAll(tenantId: string, filters?: { status?: string; materialTypeId?: string }) {
    const r = await sql`
      SELECT l.*, mt.name AS material_type_name,
             u.full_name AS created_by_name
      FROM qms_lots l
      LEFT JOIN qms_material_types mt ON mt.id = l.material_type_id
      LEFT JOIN users u ON u.id = l.created_by_id
      WHERE l.tenant_id = ${tenantId}
        AND (${filters?.status ?? null}::TEXT IS NULL OR l.status = ${filters?.status ?? null})
        AND (${filters?.materialTypeId ?? null}::TEXT IS NULL OR l.material_type_id = ${filters?.materialTypeId ?? null})
      ORDER BY l.created_at DESC
    `;
    return r.rows;
  },

  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT l.*, mt.name AS material_type_name,
             u.full_name AS created_by_name
      FROM qms_lots l
      LEFT JOIN qms_material_types mt ON mt.id = l.material_type_id
      LEFT JOIN users u ON u.id = l.created_by_id
      WHERE l.id = ${id} AND l.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },

  async create(data: {
    id: string;
    tenantId: string;
    lotNumber: string;
    customerPoNumber?: string;
    materialTypeId?: string;
    productionLineId?: string;
    inputWeightKg?: number;
    notes?: string;
    createdById: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_lots (id, tenant_id, lot_number, customer_po_number, material_type_id, production_line_id, status, input_weight_kg, notes, created_by_id, created_at, updated_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.lotNumber}, ${data.customerPoNumber ?? null}, ${data.materialTypeId ?? null}, ${data.productionLineId ?? null}, 'pending_qc', ${data.inputWeightKg ?? null}, ${data.notes ?? null}, ${data.createdById}, ${data.createdAt}, ${data.createdAt})
    `;
  },

  async update(id: string, tenantId: string, data: {
    customerPoNumber?: string;
    materialTypeId?: string;
    inputWeightKg?: number;
    outputWeightKg?: number;
    notes?: string;
    updatedAt: string;
  }) {
    let yieldPct: number | null = null;
    if (data.outputWeightKg != null && data.inputWeightKg != null && data.inputWeightKg > 0) {
      yieldPct = (data.outputWeightKg / data.inputWeightKg) * 100;
    } else if (data.outputWeightKg != null) {
      // Fetch existing input weight
      const existing = await sql`SELECT input_weight_kg FROM qms_lots WHERE id = ${id}`;
      const inputKg = existing.rows[0]?.input_weight_kg;
      if (inputKg && inputKg > 0) {
        yieldPct = (data.outputWeightKg / inputKg) * 100;
      }
    }

    await sql`
      UPDATE qms_lots SET
        customer_po_number = COALESCE(${data.customerPoNumber ?? null}, customer_po_number),
        material_type_id = COALESCE(${data.materialTypeId ?? null}, material_type_id),
        input_weight_kg = COALESCE(${data.inputWeightKg ?? null}, input_weight_kg),
        output_weight_kg = COALESCE(${data.outputWeightKg ?? null}, output_weight_kg),
        yield_percentage = COALESCE(${yieldPct}, yield_percentage),
        notes = COALESCE(${data.notes ?? null}, notes),
        updated_at = ${data.updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async updateStatus(id: string, tenantId: string, status: string, updatedAt: string) {
    await sql`
      UPDATE qms_lots SET status = ${status}, updated_at = ${updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async linkShipment(id: string, tenantId: string, shipmentId: string, updatedAt: string) {
    await sql`
      UPDATE qms_lots SET shipment_id = ${shipmentId}, status = 'shipped', updated_at = ${updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

// ─── Inspections ─────────────────────────────────────────────────────────────

export const dbQmsInspections = {
  async getAll(tenantId: string, filters?: { lotId?: string; status?: string; inspectedById?: string }) {
    const r = await sql`
      SELECT i.*, l.lot_number,
             u.full_name AS inspected_by_name,
             rv.full_name AS reviewed_by_name
      FROM qms_inspections i
      LEFT JOIN qms_lots l ON l.id = i.lot_id
      LEFT JOIN users u ON u.id = i.inspected_by_id
      LEFT JOIN users rv ON rv.id = i.reviewed_by_id
      WHERE i.tenant_id = ${tenantId}
        AND (${filters?.lotId ?? null}::TEXT IS NULL OR i.lot_id = ${filters?.lotId ?? null})
        AND (${filters?.status ?? null}::TEXT IS NULL OR i.status = ${filters?.status ?? null})
        AND (${filters?.inspectedById ?? null}::TEXT IS NULL OR i.inspected_by_id = ${filters?.inspectedById ?? null})
      ORDER BY i.created_at DESC
    `;
    return r.rows;
  },

  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT i.*, l.lot_number, l.customer_po_number,
             u.full_name AS inspected_by_name,
             rv.full_name AS reviewed_by_name
      FROM qms_inspections i
      LEFT JOIN qms_lots l ON l.id = i.lot_id
      LEFT JOIN users u ON u.id = i.inspected_by_id
      LEFT JOIN users rv ON rv.id = i.reviewed_by_id
      WHERE i.id = ${id} AND i.tenant_id = ${tenantId}
    `;
    if (!r.rows[0]) return null;
    const insp = r.rows[0];

    const results = await sql`
      SELECT ir.*, p.name AS parameter_name, p.code AS parameter_code, p.parameter_type, p.unit, p.formula
      FROM qms_inspection_results ir
      JOIN qms_parameters p ON p.id = ir.parameter_id
      WHERE ir.inspection_id = ${id}
    `;
    insp.results = results.rows;

    const photos = await sql`
      SELECT * FROM qms_inspection_photos WHERE inspection_id = ${id} ORDER BY uploaded_at ASC
    `;
    insp.photos = photos.rows;

    return insp;
  },

  async create(data: {
    id: string;
    tenantId: string;
    lotId: string;
    templateId: string;
    inspectedById: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_inspections (id, tenant_id, lot_id, template_id, inspected_by_id, status, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.lotId}, ${data.templateId}, ${data.inspectedById}, 'draft', ${data.createdAt})
    `;
  },

  async upsertResult(data: {
    id: string;
    inspectionId: string;
    parameterId: string;
    value: string;
    numericValue?: number;
    notes?: string;
  }) {
    await sql`
      INSERT INTO qms_inspection_results (id, inspection_id, parameter_id, value, numeric_value, notes)
      VALUES (${data.id}, ${data.inspectionId}, ${data.parameterId}, ${data.value}, ${data.numericValue ?? null}, ${data.notes ?? null})
      ON CONFLICT (id) DO UPDATE
        SET value = EXCLUDED.value,
            numeric_value = EXCLUDED.numeric_value,
            notes = EXCLUDED.notes
    `;
  },

  async submit(id: string, tenantId: string, results: Array<{
    id: string;
    parameterId: string;
    value: string;
    numericValue?: number;
    isWithinSpec?: boolean;
    isFlagged: boolean;
    notes?: string;
  }>, overallResult: string, submittedAt: string) {
    // Delete existing results and insert new ones
    await sql`DELETE FROM qms_inspection_results WHERE inspection_id = ${id}`;
    for (const r of results) {
      await sql`
        INSERT INTO qms_inspection_results (id, inspection_id, parameter_id, value, numeric_value, is_within_spec, is_flagged, notes)
        VALUES (${r.id}, ${id}, ${r.parameterId}, ${r.value}, ${r.numericValue ?? null}, ${r.isWithinSpec ?? null}, ${r.isFlagged}, ${r.notes ?? null})
      `;
    }
    await sql`
      UPDATE qms_inspections
      SET status = 'submitted', overall_result = ${overallResult}, submitted_at = ${submittedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async approve(id: string, tenantId: string, reviewedById: string, reviewNotes: string | undefined, reviewedAt: string) {
    await sql`
      UPDATE qms_inspections
      SET status = 'approved', reviewed_by_id = ${reviewedById}, reviewed_at = ${reviewedAt}, review_notes = ${reviewNotes ?? null}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async reject(id: string, tenantId: string, reviewedById: string, reviewNotes: string | undefined, reviewedAt: string) {
    await sql`
      UPDATE qms_inspections
      SET status = 'rejected', reviewed_by_id = ${reviewedById}, reviewed_at = ${reviewedAt}, review_notes = ${reviewNotes ?? null}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async addPhoto(data: {
    id: string;
    inspectionId: string;
    url: string;
    caption?: string;
    uploadedAt: string;
  }) {
    await sql`
      INSERT INTO qms_inspection_photos (id, inspection_id, url, caption, uploaded_at)
      VALUES (${data.id}, ${data.inspectionId}, ${data.url}, ${data.caption ?? null}, ${data.uploadedAt})
    `;
  },

  async getPendingReview(tenantId: string) {
    const r = await sql`
      SELECT i.*, l.lot_number, u.full_name AS inspected_by_name
      FROM qms_inspections i
      LEFT JOIN qms_lots l ON l.id = i.lot_id
      LEFT JOIN users u ON u.id = i.inspected_by_id
      WHERE i.tenant_id = ${tenantId} AND i.status = 'submitted'
      ORDER BY i.submitted_at ASC
    `;
    return r.rows;
  },
};

// ─── NCRs ────────────────────────────────────────────────────────────────────

export const dbQmsNcrs = {
  async getAll(tenantId: string, filters?: { status?: string; assignedToId?: string; severity?: string }) {
    const r = await sql`
      SELECT n.*, l.lot_number,
             u.full_name AS assigned_to_name,
             cb.full_name AS created_by_name
      FROM qms_ncrs n
      LEFT JOIN qms_lots l ON l.id = n.lot_id
      LEFT JOIN users u ON u.id = n.assigned_to_id
      LEFT JOIN users cb ON cb.id = n.created_by_id
      WHERE n.tenant_id = ${tenantId}
        AND (${filters?.status ?? null}::TEXT IS NULL OR n.status = ${filters?.status ?? null})
        AND (${filters?.assignedToId ?? null}::TEXT IS NULL OR n.assigned_to_id = ${filters?.assignedToId ?? null})
        AND (${filters?.severity ?? null}::TEXT IS NULL OR n.severity = ${filters?.severity ?? null})
      ORDER BY n.created_at DESC
    `;
    return r.rows;
  },

  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT n.*, l.lot_number,
             u.full_name AS assigned_to_name,
             cb.full_name AS created_by_name,
             cl.full_name AS closed_by_name
      FROM qms_ncrs n
      LEFT JOIN qms_lots l ON l.id = n.lot_id
      LEFT JOIN users u ON u.id = n.assigned_to_id
      LEFT JOIN users cb ON cb.id = n.created_by_id
      LEFT JOIN users cl ON cl.id = n.closed_by_id
      WHERE n.id = ${id} AND n.tenant_id = ${tenantId}
    `;
    if (!r.rows[0]) return null;
    const ncr = r.rows[0];
    const acts = await sql`
      SELECT a.*, u.full_name AS user_name
      FROM qms_ncr_activities a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.ncr_id = ${id}
      ORDER BY a.created_at ASC
    `;
    ncr.activities = acts.rows;
    return ncr;
  },

  async create(data: {
    id: string;
    tenantId: string;
    ncrNumber: string;
    lotId?: string;
    inspectionId?: string;
    complaintId?: string;
    source: string;
    severity: string;
    title: string;
    description?: string;
    affectedMaterialType?: string;
    affectedQuantityKg?: number;
    assignedToId?: string;
    createdById: string;
    dueDate?: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_ncrs (id, tenant_id, ncr_number, lot_id, inspection_id, complaint_id, source, severity, status, title, description, affected_material_type, affected_quantity_kg, assigned_to_id, created_by_id, due_date, created_at, updated_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.ncrNumber}, ${data.lotId ?? null}, ${data.inspectionId ?? null}, ${data.complaintId ?? null}, ${data.source}, ${data.severity}, 'open', ${data.title}, ${data.description ?? null}, ${data.affectedMaterialType ?? null}, ${data.affectedQuantityKg ?? null}, ${data.assignedToId ?? null}, ${data.createdById}, ${data.dueDate ?? null}, ${data.createdAt}, ${data.createdAt})
    `;
  },

  async update(id: string, tenantId: string, data: {
    status?: string;
    assignedToId?: string;
    dispositionAction?: string;
    dispositionNotes?: string;
    rootCause?: string;
    rootCauseCategory?: string;
    correctiveAction?: string;
    preventiveAction?: string;
    verificationNotes?: string;
    dueDate?: string;
    updatedAt: string;
  }) {
    await sql`
      UPDATE qms_ncrs SET
        status = COALESCE(${data.status ?? null}, status),
        assigned_to_id = COALESCE(${data.assignedToId ?? null}, assigned_to_id),
        disposition_action = COALESCE(${data.dispositionAction ?? null}, disposition_action),
        disposition_notes = COALESCE(${data.dispositionNotes ?? null}, disposition_notes),
        root_cause = COALESCE(${data.rootCause ?? null}, root_cause),
        root_cause_category = COALESCE(${data.rootCauseCategory ?? null}, root_cause_category),
        corrective_action = COALESCE(${data.correctiveAction ?? null}, corrective_action),
        preventive_action = COALESCE(${data.preventiveAction ?? null}, preventive_action),
        verification_notes = COALESCE(${data.verificationNotes ?? null}, verification_notes),
        due_date = COALESCE(${data.dueDate ?? null}, due_date),
        updated_at = ${data.updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async close(id: string, tenantId: string, closedById: string, closedAt: string) {
    await sql`
      UPDATE qms_ncrs SET status = 'closed', closed_by_id = ${closedById}, closed_at = ${closedAt}, updated_at = ${closedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },

  async addActivity(data: {
    id: string;
    ncrId: string;
    userId?: string;
    action: string;
    notes?: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_ncr_activities (id, ncr_id, user_id, action, notes, created_at)
      VALUES (${data.id}, ${data.ncrId}, ${data.userId ?? null}, ${data.action}, ${data.notes ?? null}, ${data.createdAt})
    `;
  },

  async countOpenBySeverity(tenantId: string) {
    const r = await sql`
      SELECT severity, COUNT(*) AS count
      FROM qms_ncrs
      WHERE tenant_id = ${tenantId} AND status NOT IN ('closed', 'cancelled')
      GROUP BY severity
    `;
    return r.rows;
  },
};

// ─── Complaints ───────────────────────────────────────────────────────────────

export const dbQmsComplaints = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT c.*, u.full_name AS created_by_name
      FROM qms_complaints c
      LEFT JOIN users u ON u.id = c.created_by_id
      WHERE c.tenant_id = ${tenantId}
      ORDER BY c.created_at DESC
    `;
    return r.rows;
  },

  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT c.*, u.full_name AS created_by_name
      FROM qms_complaints c
      LEFT JOIN users u ON u.id = c.created_by_id
      WHERE c.id = ${id} AND c.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },

  async create(data: {
    id: string;
    tenantId: string;
    complaintNumber: string;
    customerName: string;
    customerPoNumber?: string;
    lotId?: string;
    materialTypeId?: string;
    description: string;
    claimedIssue?: string;
    receivedDate: string;
    createdById: string;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_complaints (id, tenant_id, complaint_number, customer_name, customer_po_number, lot_id, material_type_id, description, claimed_issue, received_date, status, created_by_id, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.complaintNumber}, ${data.customerName}, ${data.customerPoNumber ?? null}, ${data.lotId ?? null}, ${data.materialTypeId ?? null}, ${data.description}, ${data.claimedIssue ?? null}, ${data.receivedDate}, 'open', ${data.createdById}, ${data.createdAt})
    `;
  },

  async update(id: string, tenantId: string, data: {
    status?: string;
    ncr_id?: string;
    resolution?: string;
    resolvedAt?: string;
  }) {
    await sql`
      UPDATE qms_complaints SET
        status = COALESCE(${data.status ?? null}, status),
        ncr_id = COALESCE(${data.ncr_id ?? null}, ncr_id),
        resolution = COALESCE(${data.resolution ?? null}, resolution),
        resolved_at = COALESCE(${data.resolvedAt ?? null}, resolved_at)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

// ─── COAs ────────────────────────────────────────────────────────────────────

export const dbQmsCoas = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT c.*, l.lot_number, u.full_name AS generated_by_name
      FROM qms_coas c
      LEFT JOIN qms_lots l ON l.id = c.lot_id
      LEFT JOIN users u ON u.id = c.generated_by_id
      WHERE c.tenant_id = ${tenantId}
      ORDER BY c.issued_at DESC
    `;
    return r.rows;
  },

  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT c.*, l.lot_number, u.full_name AS generated_by_name
      FROM qms_coas c
      LEFT JOIN qms_lots l ON l.id = c.lot_id
      LEFT JOIN users u ON u.id = c.generated_by_id
      WHERE c.id = ${id} AND c.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },

  async getByLotId(lotId: string, tenantId: string) {
    const r = await sql`
      SELECT * FROM qms_coas WHERE lot_id = ${lotId} AND tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },

  async create(data: {
    id: string;
    tenantId: string;
    coaNumber: string;
    lotId: string;
    shipmentId?: string;
    customerName?: string;
    customerPoNumber?: string;
    materialType?: string;
    inspectionSummary: object;
    generatedById: string;
    issuedAt: string;
    pdfUrl?: string;
  }) {
    await sql`
      INSERT INTO qms_coas (id, tenant_id, coa_number, lot_id, shipment_id, customer_name, customer_po_number, material_type, inspection_summary, generated_by_id, issued_at, pdf_url)
      VALUES (${data.id}, ${data.tenantId}, ${data.coaNumber}, ${data.lotId}, ${data.shipmentId ?? null}, ${data.customerName ?? null}, ${data.customerPoNumber ?? null}, ${data.materialType ?? null}, ${JSON.stringify(data.inspectionSummary)}, ${data.generatedById}, ${data.issuedAt}, ${data.pdfUrl ?? null})
    `;
  },

  async updatePdfUrl(id: string, pdfUrl: string) {
    await sql`UPDATE qms_coas SET pdf_url = ${pdfUrl} WHERE id = ${id}`;
  },
};

// ─── Customer Specs ───────────────────────────────────────────────────────────

export const dbQmsCustomerSpecs = {
  async getAll(tenantId: string, customerName?: string) {
    const r = await sql`
      SELECT cs.*, mt.name AS material_type_name, p.name AS parameter_name, p.unit
      FROM qms_customer_specs cs
      LEFT JOIN qms_material_types mt ON mt.id = cs.material_type_id
      LEFT JOIN qms_parameters p ON p.id = cs.parameter_id
      WHERE cs.tenant_id = ${tenantId}
        AND (${customerName ?? null}::TEXT IS NULL OR cs.customer_name = ${customerName ?? null})
      ORDER BY cs.customer_name ASC, mt.name ASC
    `;
    return r.rows;
  },

  async create(data: {
    id: string;
    tenantId: string;
    customerName: string;
    materialTypeId?: string;
    parameterId?: string;
    minValue?: number;
    maxValue?: number;
    notes?: string;
    requiresCoa: boolean;
    createdAt: string;
  }) {
    await sql`
      INSERT INTO qms_customer_specs (id, tenant_id, customer_name, material_type_id, parameter_id, min_value, max_value, notes, requires_coa, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.customerName}, ${data.materialTypeId ?? null}, ${data.parameterId ?? null}, ${data.minValue ?? null}, ${data.maxValue ?? null}, ${data.notes ?? null}, ${data.requiresCoa}, ${data.createdAt})
    `;
  },

  async update(id: string, tenantId: string, data: {
    minValue?: number;
    maxValue?: number;
    notes?: string;
    requiresCoa?: boolean;
  }) {
    await sql`
      UPDATE qms_customer_specs SET
        min_value = COALESCE(${data.minValue ?? null}, min_value),
        max_value = COALESCE(${data.maxValue ?? null}, max_value),
        notes = COALESCE(${data.notes ?? null}, notes),
        requires_coa = COALESCE(${data.requiresCoa ?? null}, requires_coa)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};
