/**
 * PlantOps Production, Inventory & Shipping module — database layer.
 * Uses the same raw-SQL / @vercel/postgres pattern as db-cmms.ts and db-qms.ts.
 * All tables are prefixed with `ops_` and include `tenant_id` for multi-tenancy.
 *
 * Reuses cross-module shared tables:
 *   - qms_material_types  (material types)
 *   - cmms_production_lines  (production lines)
 */

import { sql } from "@vercel/postgres";

// ─────────────────────────────────────────────
// Table initialization
// ─────────────────────────────────────────────

export async function initOpsTables(): Promise<void> {
  // ── Counters for auto-numbered IDs ──────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_counters (
      id TEXT PRIMARY KEY,
      last_number INT DEFAULT 0
    )
  `;

  // ── Customers ──────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_customers (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50),
      contact_name VARCHAR(100),
      contact_email VARCHAR(100),
      contact_phone VARCHAR(50),
      address TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_customers_tenant ON ops_customers(tenant_id)`;

  // ── Vendors (material suppliers) ─────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_vendors (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50),
      contact_name VARCHAR(100),
      contact_email VARCHAR(100),
      contact_phone VARCHAR(50),
      address TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_vendors_tenant ON ops_vendors(tenant_id)`;

  // ── Carriers ──────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_carriers (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50),
      contact_name VARCHAR(100),
      contact_phone VARCHAR(50),
      notes TEXT,
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_carriers_tenant ON ops_carriers(tenant_id)`;

  // ── Processing Types (per production line) ───────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_processing_types (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50),
      description TEXT,
      production_line_id VARCHAR(36),
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_processing_types_tenant ON ops_processing_types(tenant_id)`;

  // ── Locations (storage areas, bays, etc.) ────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_locations (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50),
      type VARCHAR(50),
      description TEXT,
      active BOOLEAN DEFAULT true,
      created_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_locations_tenant ON ops_locations(tenant_id)`;

  // ── Jobs ──────────────────────────────────────────────────────────────
  // job_type: 'toll' | 'purchase'
  // toll: customer provides material, pays for processing
  // purchase: facility buys material and processes it
  await sql`
    CREATE TABLE IF NOT EXISTS ops_jobs (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      job_number VARCHAR(30) NOT NULL UNIQUE,
      job_type VARCHAR(20) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      customer_id UUID,
      vendor_id UUID,
      customer_po_number VARCHAR(100),
      our_po_number VARCHAR(100),
      material_type_id UUID,
      description TEXT,
      notes TEXT,
      target_weight FLOAT,
      target_weight_unit VARCHAR(10) DEFAULT 'lbs',
      expected_start_date VARCHAR(50),
      expected_end_date VARCHAR(50),
      actual_start_date VARCHAR(50),
      actual_end_date VARCHAR(50),
      created_by_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_jobs_tenant ON ops_jobs(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_jobs_status ON ops_jobs(tenant_id, status)`;

  // ── Job Status History ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_job_status_history (
      id UUID PRIMARY KEY,
      job_id UUID NOT NULL REFERENCES ops_jobs(id),
      from_status VARCHAR(30),
      to_status VARCHAR(30) NOT NULL,
      notes TEXT,
      changed_by_id VARCHAR(36) NOT NULL,
      changed_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_job_status_history ON ops_job_status_history(job_id)`;

  // ── Inbound Shipments ────────────────────────────────────────────────
  // Trucks/loads arriving with material
  await sql`
    CREATE TABLE IF NOT EXISTS ops_inbound_shipments (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      shipment_number VARCHAR(30) NOT NULL UNIQUE,
      job_id UUID NOT NULL REFERENCES ops_jobs(id),
      vendor_id UUID,
      carrier_id UUID,
      carrier_name VARCHAR(200),
      driver_name VARCHAR(100),
      truck_number VARCHAR(100),
      trailer_number VARCHAR(100),
      status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
      scheduled_date VARCHAR(50),
      received_date VARCHAR(50),
      location_id UUID,
      notes TEXT,
      created_by_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_inbound_tenant ON ops_inbound_shipments(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_inbound_job ON ops_inbound_shipments(job_id)`;

  // ── Weight Entries ────────────────────────────────────────────────────
  // Individual weigh events per inbound shipment (gaylords/bags per load)
  await sql`
    CREATE TABLE IF NOT EXISTS ops_weight_entries (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      inbound_shipment_id UUID NOT NULL REFERENCES ops_inbound_shipments(id),
      entry_number INT NOT NULL,
      gross_weight FLOAT NOT NULL,
      tare_weight FLOAT,
      net_weight FLOAT,
      weight_unit VARCHAR(10) NOT NULL DEFAULT 'lbs',
      container_label VARCHAR(100),
      notes TEXT,
      entered_by_id VARCHAR(36) NOT NULL,
      entered_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_weight_entries_shipment ON ops_weight_entries(inbound_shipment_id)`;

  // ── Lots ──────────────────────────────────────────────────────────────
  // A lot = a batch of material to be processed (may span multiple inbound shipments)
  await sql`
    CREATE TABLE IF NOT EXISTS ops_lots (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      lot_number VARCHAR(30) NOT NULL UNIQUE,
      job_id UUID NOT NULL REFERENCES ops_jobs(id),
      material_type_id UUID,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      inbound_weight FLOAT,
      inbound_weight_unit VARCHAR(10) DEFAULT 'lbs',
      location_id UUID,
      notes TEXT,
      qms_lot_id UUID,
      created_by_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_lots_tenant ON ops_lots(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_lots_job ON ops_lots(job_id)`;

  // ── Lot-Inbound Shipment Link (many-to-many) ──────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_lot_inbound_links (
      lot_id UUID NOT NULL REFERENCES ops_lots(id),
      inbound_shipment_id UUID NOT NULL REFERENCES ops_inbound_shipments(id),
      PRIMARY KEY (lot_id, inbound_shipment_id)
    )
  `;

  // ── Lot Status History ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_lot_status_history (
      id UUID PRIMARY KEY,
      lot_id UUID NOT NULL REFERENCES ops_lots(id),
      from_status VARCHAR(30),
      to_status VARCHAR(30) NOT NULL,
      notes TEXT,
      changed_by_id VARCHAR(36) NOT NULL,
      changed_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_lot_status_history ON ops_lot_status_history(lot_id)`;

  // ── Production Runs ───────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_production_runs (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      run_number VARCHAR(30) NOT NULL UNIQUE,
      job_id UUID NOT NULL REFERENCES ops_jobs(id),
      production_line_id VARCHAR(36),
      processing_type_id UUID,
      operator_id VARCHAR(36),
      supervisor_id VARCHAR(36),
      status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
      scheduled_start VARCHAR(50),
      actual_start VARCHAR(50),
      actual_end VARCHAR(50),
      input_weight FLOAT,
      input_weight_unit VARCHAR(10) DEFAULT 'lbs',
      output_weight FLOAT,
      output_weight_unit VARCHAR(10) DEFAULT 'lbs',
      yield_percentage FLOAT,
      notes TEXT,
      created_by_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_runs_tenant ON ops_production_runs(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_runs_job ON ops_production_runs(job_id)`;

  // ── Run Input Lots ────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_run_input_lots (
      run_id UUID NOT NULL REFERENCES ops_production_runs(id),
      lot_id UUID NOT NULL REFERENCES ops_lots(id),
      weight_used FLOAT,
      weight_unit VARCHAR(10) DEFAULT 'lbs',
      PRIMARY KEY (run_id, lot_id)
    )
  `;

  // ── Downtime Events ───────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_downtime_events (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      run_id UUID REFERENCES ops_production_runs(id),
      production_line_id VARCHAR(36),
      reason VARCHAR(200),
      category VARCHAR(50),
      start_time VARCHAR(50) NOT NULL,
      end_time VARCHAR(50),
      duration_minutes INT,
      notes TEXT,
      reported_by_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_downtime_tenant ON ops_downtime_events(tenant_id)`;
  // Migration: add work_order_id if missing
  await sql`ALTER TABLE ops_downtime_events ADD COLUMN IF NOT EXISTS cmms_work_order_id VARCHAR(36)`.catch(() => {});
  // Migration: add delivery confirmation fields
  await sql`ALTER TABLE ops_outbound_shipments ADD COLUMN IF NOT EXISTS staged_date VARCHAR(50)`.catch(() => {});
  await sql`ALTER TABLE ops_outbound_shipments ADD COLUMN IF NOT EXISTS delivered_date VARCHAR(50)`.catch(() => {});
  await sql`ALTER TABLE ops_outbound_shipments ADD COLUMN IF NOT EXISTS delivery_notes TEXT`.catch(() => {});

  // ── Outbound Shipments ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_outbound_shipments (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      shipment_number VARCHAR(30) NOT NULL UNIQUE,
      job_id UUID NOT NULL REFERENCES ops_jobs(id),
      customer_id UUID,
      carrier_id UUID,
      carrier_name VARCHAR(200),
      driver_name VARCHAR(100),
      truck_number VARCHAR(100),
      trailer_number VARCHAR(100),
      customer_po_number VARCHAR(100),
      bol_number VARCHAR(100),
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      scheduled_date VARCHAR(50),
      shipped_date VARCHAR(50),
      total_weight FLOAT,
      total_weight_unit VARCHAR(10) DEFAULT 'lbs',
      notes TEXT,
      created_by_id VARCHAR(36) NOT NULL,
      created_at VARCHAR(50) NOT NULL,
      updated_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_outbound_tenant ON ops_outbound_shipments(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_outbound_job ON ops_outbound_shipments(job_id)`;

  // ── Outbound Lots (which lots are on which outbound shipment) ─────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_outbound_lots (
      outbound_shipment_id UUID NOT NULL REFERENCES ops_outbound_shipments(id),
      lot_id UUID NOT NULL REFERENCES ops_lots(id),
      weight FLOAT,
      weight_unit VARCHAR(10) DEFAULT 'lbs',
      PRIMARY KEY (outbound_shipment_id, lot_id)
    )
  `;

  // ── Shipment Documents ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ops_shipment_documents (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL,
      inbound_shipment_id UUID REFERENCES ops_inbound_shipments(id),
      outbound_shipment_id UUID REFERENCES ops_outbound_shipments(id),
      document_type VARCHAR(50),
      file_name VARCHAR(200),
      file_url TEXT NOT NULL,
      uploaded_by_id VARCHAR(36) NOT NULL,
      uploaded_at VARCHAR(50) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ops_docs_tenant ON ops_shipment_documents(tenant_id)`;
}

// ─────────────────────────────────────────────
// Auto-numbering helper
// ─────────────────────────────────────────────

/**
 * Atomically increment and return the next number for a given counter key.
 * Format examples:
 *   JOB-2026-0001
 *   SHP-IN-2026-03-0001
 *   LOT-2026-03-0001
 *   RUN-2026-03-0001
 *   SHP-OUT-2026-03-0001
 */
export async function nextOpsNumber(
  tenantId: string,
  type: "JOB" | "SHP-IN" | "SHP-OUT" | "LOT" | "RUN",
  includeMonth = false
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const periodKey = includeMonth ? `${year}-${month}` : `${year}`;
  const counterId = `${type}:${tenantId}:${periodKey}`;

  // Upsert counter row and atomically increment
  const result = await sql`
    INSERT INTO ops_counters(id, last_number) VALUES (${counterId}, 1)
    ON CONFLICT (id) DO UPDATE SET last_number = ops_counters.last_number + 1
    RETURNING last_number
  `;
  const seq = String(result.rows[0].last_number).padStart(4, "0");
  return `${type}-${periodKey}-${seq}`;
}

// ─────────────────────────────────────────────
// DB Namespaces
// ─────────────────────────────────────────────

export const dbOpsCustomers = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_customers WHERE tenant_id = ${tenantId} ORDER BY name
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_customers WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; name: string; code?: string;
    contactName?: string; contactEmail?: string; contactPhone?: string;
    address?: string; notes?: string; createdAt: string;
  }) {
    await sql`
      INSERT INTO ops_customers(id, tenant_id, name, code, contact_name, contact_email, contact_phone, address, notes, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.name}, ${data.code ?? null},
              ${data.contactName ?? null}, ${data.contactEmail ?? null}, ${data.contactPhone ?? null},
              ${data.address ?? null}, ${data.notes ?? null}, ${data.createdAt})
    `;
  },
  async update(id: string, tenantId: string, data: {
    name?: string; code?: string; contactName?: string; contactEmail?: string;
    contactPhone?: string; address?: string; notes?: string; active?: boolean;
  }) {
    await sql`
      UPDATE ops_customers SET
        name = COALESCE(${data.name ?? null}, name),
        code = COALESCE(${data.code ?? null}, code),
        contact_name = COALESCE(${data.contactName ?? null}, contact_name),
        contact_email = COALESCE(${data.contactEmail ?? null}, contact_email),
        contact_phone = COALESCE(${data.contactPhone ?? null}, contact_phone),
        address = COALESCE(${data.address ?? null}, address),
        notes = COALESCE(${data.notes ?? null}, notes),
        active = COALESCE(${data.active ?? null}, active)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

export const dbOpsVendors = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_vendors WHERE tenant_id = ${tenantId} ORDER BY name
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_vendors WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; name: string; code?: string;
    contactName?: string; contactEmail?: string; contactPhone?: string;
    address?: string; notes?: string; createdAt: string;
  }) {
    await sql`
      INSERT INTO ops_vendors(id, tenant_id, name, code, contact_name, contact_email, contact_phone, address, notes, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.name}, ${data.code ?? null},
              ${data.contactName ?? null}, ${data.contactEmail ?? null}, ${data.contactPhone ?? null},
              ${data.address ?? null}, ${data.notes ?? null}, ${data.createdAt})
    `;
  },
  async update(id: string, tenantId: string, data: {
    name?: string; code?: string; contactName?: string; contactEmail?: string;
    contactPhone?: string; address?: string; notes?: string; active?: boolean;
  }) {
    await sql`
      UPDATE ops_vendors SET
        name = COALESCE(${data.name ?? null}, name),
        code = COALESCE(${data.code ?? null}, code),
        contact_name = COALESCE(${data.contactName ?? null}, contact_name),
        contact_email = COALESCE(${data.contactEmail ?? null}, contact_email),
        contact_phone = COALESCE(${data.contactPhone ?? null}, contact_phone),
        address = COALESCE(${data.address ?? null}, address),
        notes = COALESCE(${data.notes ?? null}, notes),
        active = COALESCE(${data.active ?? null}, active)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

export const dbOpsCarriers = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_carriers WHERE tenant_id = ${tenantId} ORDER BY name
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_carriers WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; name: string; code?: string;
    contactName?: string; contactPhone?: string; notes?: string; createdAt: string;
  }) {
    await sql`
      INSERT INTO ops_carriers(id, tenant_id, name, code, contact_name, contact_phone, notes, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.name}, ${data.code ?? null},
              ${data.contactName ?? null}, ${data.contactPhone ?? null},
              ${data.notes ?? null}, ${data.createdAt})
    `;
  },
  async update(id: string, tenantId: string, data: {
    name?: string; code?: string; contactName?: string; contactPhone?: string;
    notes?: string; active?: boolean;
  }) {
    await sql`
      UPDATE ops_carriers SET
        name = COALESCE(${data.name ?? null}, name),
        code = COALESCE(${data.code ?? null}, code),
        contact_name = COALESCE(${data.contactName ?? null}, contact_name),
        contact_phone = COALESCE(${data.contactPhone ?? null}, contact_phone),
        notes = COALESCE(${data.notes ?? null}, notes),
        active = COALESCE(${data.active ?? null}, active)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

export const dbOpsProcessingTypes = {
  async getAll(tenantId: string, lineId?: string) {
    if (lineId) {
      const r = await sql`
        SELECT * FROM ops_processing_types
        WHERE tenant_id = ${tenantId} AND production_line_id = ${lineId}
        ORDER BY name
      `;
      return r.rows;
    }
    const r = await sql`
      SELECT * FROM ops_processing_types WHERE tenant_id = ${tenantId} ORDER BY name
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_processing_types WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; name: string; code?: string;
    description?: string; productionLineId?: string; createdAt: string;
  }) {
    await sql`
      INSERT INTO ops_processing_types(id, tenant_id, name, code, description, production_line_id, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.name}, ${data.code ?? null},
              ${data.description ?? null}, ${data.productionLineId ?? null}, ${data.createdAt})
    `;
  },
  async update(id: string, tenantId: string, data: {
    name?: string; code?: string; description?: string;
    productionLineId?: string; active?: boolean;
  }) {
    await sql`
      UPDATE ops_processing_types SET
        name = COALESCE(${data.name ?? null}, name),
        code = COALESCE(${data.code ?? null}, code),
        description = COALESCE(${data.description ?? null}, description),
        production_line_id = COALESCE(${data.productionLineId ?? null}, production_line_id),
        active = COALESCE(${data.active ?? null}, active)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

export const dbOpsLocations = {
  async getAll(tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_locations WHERE tenant_id = ${tenantId} ORDER BY name
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT * FROM ops_locations WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; name: string; code?: string;
    type?: string; description?: string; createdAt: string;
  }) {
    await sql`
      INSERT INTO ops_locations(id, tenant_id, name, code, type, description, created_at)
      VALUES (${data.id}, ${data.tenantId}, ${data.name}, ${data.code ?? null},
              ${data.type ?? null}, ${data.description ?? null}, ${data.createdAt})
    `;
  },
  async update(id: string, tenantId: string, data: {
    name?: string; code?: string; type?: string; description?: string; active?: boolean;
  }) {
    await sql`
      UPDATE ops_locations SET
        name = COALESCE(${data.name ?? null}, name),
        code = COALESCE(${data.code ?? null}, code),
        type = COALESCE(${data.type ?? null}, type),
        description = COALESCE(${data.description ?? null}, description),
        active = COALESCE(${data.active ?? null}, active)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

export const dbOpsJobs = {
  async getAll(tenantId: string, filters?: { status?: string; jobType?: string }) {
    const status = filters?.status ?? null;
    const jobType = filters?.jobType ?? null;
    const r = await sql`
      SELECT j.*,
        c.name AS customer_name,
        v.name AS vendor_name,
        mt.name AS material_type_name
      FROM ops_jobs j
      LEFT JOIN ops_customers c ON c.id = j.customer_id
      LEFT JOIN ops_vendors v ON v.id = j.vendor_id
      LEFT JOIN qms_material_types mt ON mt.id = j.material_type_id::text
      WHERE j.tenant_id = ${tenantId}
        AND (${status}::text IS NULL OR j.status = ${status})
        AND (${jobType}::text IS NULL OR j.job_type = ${jobType})
      ORDER BY j.created_at DESC
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT j.*,
        c.name AS customer_name,
        v.name AS vendor_name,
        mt.name AS material_type_name
      FROM ops_jobs j
      LEFT JOIN ops_customers c ON c.id = j.customer_id
      LEFT JOIN ops_vendors v ON v.id = j.vendor_id
      LEFT JOIN qms_material_types mt ON mt.id = j.material_type_id::text
      WHERE j.id = ${id} AND j.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; jobNumber: string; jobType: string;
    customerId?: string; vendorId?: string; customerPoNumber?: string; ourPoNumber?: string;
    materialTypeId?: string; description?: string; notes?: string;
    targetWeight?: number; targetWeightUnit?: string;
    expectedStartDate?: string; expectedEndDate?: string;
    createdById: string; createdAt: string; updatedAt: string;
  }) {
    await sql`
      INSERT INTO ops_jobs(
        id, tenant_id, job_number, job_type, status,
        customer_id, vendor_id, customer_po_number, our_po_number,
        material_type_id, description, notes,
        target_weight, target_weight_unit,
        expected_start_date, expected_end_date,
        created_by_id, created_at, updated_at
      ) VALUES (
        ${data.id}, ${data.tenantId}, ${data.jobNumber}, ${data.jobType}, 'open',
        ${data.customerId ?? null}, ${data.vendorId ?? null},
        ${data.customerPoNumber ?? null}, ${data.ourPoNumber ?? null},
        ${data.materialTypeId ?? null}, ${data.description ?? null}, ${data.notes ?? null},
        ${data.targetWeight ?? null}, ${data.targetWeightUnit ?? 'lbs'},
        ${data.expectedStartDate ?? null}, ${data.expectedEndDate ?? null},
        ${data.createdById}, ${data.createdAt}, ${data.updatedAt}
      )
    `;
  },
  async update(id: string, tenantId: string, data: {
    status?: string; customerId?: string; vendorId?: string;
    customerPoNumber?: string; ourPoNumber?: string; materialTypeId?: string;
    description?: string; notes?: string;
    targetWeight?: number; targetWeightUnit?: string;
    expectedStartDate?: string; expectedEndDate?: string;
    actualStartDate?: string; actualEndDate?: string;
    updatedAt: string;
  }) {
    await sql`
      UPDATE ops_jobs SET
        status = COALESCE(${data.status ?? null}, status),
        customer_id = COALESCE(${data.customerId ?? null}, customer_id),
        vendor_id = COALESCE(${data.vendorId ?? null}, vendor_id),
        customer_po_number = COALESCE(${data.customerPoNumber ?? null}, customer_po_number),
        our_po_number = COALESCE(${data.ourPoNumber ?? null}, our_po_number),
        material_type_id = COALESCE(${data.materialTypeId ?? null}, material_type_id),
        description = COALESCE(${data.description ?? null}, description),
        notes = COALESCE(${data.notes ?? null}, notes),
        target_weight = COALESCE(${data.targetWeight ?? null}, target_weight),
        target_weight_unit = COALESCE(${data.targetWeightUnit ?? null}, target_weight_unit),
        expected_start_date = COALESCE(${data.expectedStartDate ?? null}, expected_start_date),
        expected_end_date = COALESCE(${data.expectedEndDate ?? null}, expected_end_date),
        actual_start_date = COALESCE(${data.actualStartDate ?? null}, actual_start_date),
        actual_end_date = COALESCE(${data.actualEndDate ?? null}, actual_end_date),
        updated_at = ${data.updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
  async addStatusHistory(data: {
    id: string; jobId: string; fromStatus?: string; toStatus: string;
    notes?: string; changedById: string; changedAt: string;
  }) {
    await sql`
      INSERT INTO ops_job_status_history(id, job_id, from_status, to_status, notes, changed_by_id, changed_at)
      VALUES (${data.id}, ${data.jobId}, ${data.fromStatus ?? null}, ${data.toStatus},
              ${data.notes ?? null}, ${data.changedById}, ${data.changedAt})
    `;
  },
  async getStatusHistory(jobId: string) {
    const r = await sql`
      SELECT h.*, u.full_name AS changed_by_name
      FROM ops_job_status_history h
      LEFT JOIN users u ON u.id::text = h.changed_by_id
      WHERE h.job_id = ${jobId}
      ORDER BY h.changed_at ASC
    `;
    return r.rows;
  },
};

export const dbOpsInboundShipments = {
  async getAll(tenantId: string, jobId?: string) {
    if (jobId) {
      const r = await sql`
        SELECT s.*,
          v.name AS vendor_name,
          c.name AS carrier_name_resolved,
          l.name AS location_name,
          COALESCE(we.total_net, we.total_gross, 0) AS total_weight,
          we.weight_unit,
          we.entry_count
        FROM ops_inbound_shipments s
        LEFT JOIN ops_vendors v ON v.id = s.vendor_id
        LEFT JOIN ops_carriers c ON c.id = s.carrier_id
        LEFT JOIN ops_locations l ON l.id = s.location_id
        LEFT JOIN (
          SELECT inbound_shipment_id,
            SUM(COALESCE(net_weight, gross_weight)) AS total_net,
            SUM(gross_weight) AS total_gross,
            MAX(weight_unit) AS weight_unit,
            COUNT(*) AS entry_count
          FROM ops_weight_entries GROUP BY inbound_shipment_id
        ) we ON we.inbound_shipment_id = s.id
        WHERE s.tenant_id = ${tenantId} AND s.job_id = ${jobId}
        ORDER BY s.created_at DESC
      `;
      return r.rows;
    }
    const r = await sql`
      SELECT s.*,
        v.name AS vendor_name,
        c.name AS carrier_name_resolved,
        l.name AS location_name,
        COALESCE(we.total_net, we.total_gross, 0) AS total_weight,
        we.weight_unit,
        we.entry_count
      FROM ops_inbound_shipments s
      LEFT JOIN ops_vendors v ON v.id = s.vendor_id
      LEFT JOIN ops_carriers c ON c.id = s.carrier_id
      LEFT JOIN ops_locations l ON l.id = s.location_id
      LEFT JOIN (
        SELECT inbound_shipment_id,
          SUM(COALESCE(net_weight, gross_weight)) AS total_net,
          SUM(gross_weight) AS total_gross,
          MAX(weight_unit) AS weight_unit,
          COUNT(*) AS entry_count
        FROM ops_weight_entries GROUP BY inbound_shipment_id
      ) we ON we.inbound_shipment_id = s.id
      WHERE s.tenant_id = ${tenantId}
      ORDER BY s.created_at DESC
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT s.*,
        v.name AS vendor_name,
        c.name AS carrier_name_resolved,
        l.name AS location_name
      FROM ops_inbound_shipments s
      LEFT JOIN ops_vendors v ON v.id = s.vendor_id
      LEFT JOIN ops_carriers c ON c.id = s.carrier_id
      LEFT JOIN ops_locations l ON l.id = s.location_id
      WHERE s.id = ${id} AND s.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; shipmentNumber: string; jobId: string;
    vendorId?: string; carrierId?: string; carrierName?: string;
    driverName?: string; truckNumber?: string; trailerNumber?: string;
    scheduledDate?: string; locationId?: string; notes?: string;
    createdById: string; createdAt: string; updatedAt: string;
  }) {
    await sql`
      INSERT INTO ops_inbound_shipments(
        id, tenant_id, shipment_number, job_id, vendor_id, carrier_id, carrier_name,
        driver_name, truck_number, trailer_number, status,
        scheduled_date, location_id, notes, created_by_id, created_at, updated_at
      ) VALUES (
        ${data.id}, ${data.tenantId}, ${data.shipmentNumber}, ${data.jobId},
        ${data.vendorId ?? null}, ${data.carrierId ?? null}, ${data.carrierName ?? null},
        ${data.driverName ?? null}, ${data.truckNumber ?? null}, ${data.trailerNumber ?? null},
        'scheduled',
        ${data.scheduledDate ?? null}, ${data.locationId ?? null}, ${data.notes ?? null},
        ${data.createdById}, ${data.createdAt}, ${data.updatedAt}
      )
    `;
  },
  async update(id: string, tenantId: string, data: {
    status?: string; vendorId?: string; carrierId?: string; carrierName?: string;
    driverName?: string; truckNumber?: string; trailerNumber?: string;
    scheduledDate?: string; receivedDate?: string; locationId?: string;
    notes?: string; updatedAt: string;
  }) {
    await sql`
      UPDATE ops_inbound_shipments SET
        status = COALESCE(${data.status ?? null}, status),
        vendor_id = COALESCE(${data.vendorId ?? null}, vendor_id),
        carrier_id = COALESCE(${data.carrierId ?? null}, carrier_id),
        carrier_name = COALESCE(${data.carrierName ?? null}, carrier_name),
        driver_name = COALESCE(${data.driverName ?? null}, driver_name),
        truck_number = COALESCE(${data.truckNumber ?? null}, truck_number),
        trailer_number = COALESCE(${data.trailerNumber ?? null}, trailer_number),
        scheduled_date = COALESCE(${data.scheduledDate ?? null}, scheduled_date),
        received_date = COALESCE(${data.receivedDate ?? null}, received_date),
        location_id = COALESCE(${data.locationId ?? null}, location_id),
        notes = COALESCE(${data.notes ?? null}, notes),
        updated_at = ${data.updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
  async getWeightEntries(shipmentId: string) {
    const r = await sql`
      SELECT we.*, u.full_name AS entered_by_name
      FROM ops_weight_entries we
      LEFT JOIN users u ON u.id::text = we.entered_by_id
      WHERE we.inbound_shipment_id = ${shipmentId}
      ORDER BY we.entry_number ASC
    `;
    return r.rows;
  },
  async addWeightEntry(data: {
    id: string; tenantId: string; inboundShipmentId: string; entryNumber: number;
    grossWeight: number; tareWeight?: number; netWeight?: number;
    weightUnit: string; containerLabel?: string; notes?: string;
    enteredById: string; enteredAt: string;
  }) {
    await sql`
      INSERT INTO ops_weight_entries(
        id, tenant_id, inbound_shipment_id, entry_number,
        gross_weight, tare_weight, net_weight, weight_unit,
        container_label, notes, entered_by_id, entered_at
      ) VALUES (
        ${data.id}, ${data.tenantId}, ${data.inboundShipmentId}, ${data.entryNumber},
        ${data.grossWeight}, ${data.tareWeight ?? null}, ${data.netWeight ?? null}, ${data.weightUnit},
        ${data.containerLabel ?? null}, ${data.notes ?? null}, ${data.enteredById}, ${data.enteredAt}
      )
    `;
  },
  async deleteWeightEntry(id: string, tenantId: string) {
    await sql`DELETE FROM ops_weight_entries WHERE id = ${id} AND tenant_id = ${tenantId}`;
  },
};

export const dbOpsLots = {
  async getAll(tenantId: string, jobId?: string) {
    if (jobId) {
      const r = await sql`
        SELECT l.*, mt.name AS material_type_name, loc.name AS location_name,
          ql.status AS qms_lot_status, ql.lot_number AS qms_lot_number
        FROM ops_lots l
        LEFT JOIN qms_material_types mt ON mt.id = l.material_type_id::text::text
        LEFT JOIN ops_locations loc ON loc.id = l.location_id
        LEFT JOIN qms_lots ql ON ql.id = l.qms_lot_id::text::text
        WHERE l.tenant_id = ${tenantId} AND l.job_id = ${jobId}
        ORDER BY l.created_at DESC
      `;
      return r.rows;
    }
    const r = await sql`
      SELECT l.*, mt.name AS material_type_name, loc.name AS location_name,
        ql.status AS qms_lot_status, ql.lot_number AS qms_lot_number
      FROM ops_lots l
      LEFT JOIN qms_material_types mt ON mt.id = l.material_type_id::text
      LEFT JOIN ops_locations loc ON loc.id = l.location_id
      LEFT JOIN qms_lots ql ON ql.id = l.qms_lot_id::text
      WHERE l.tenant_id = ${tenantId}
      ORDER BY l.created_at DESC
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT l.*, mt.name AS material_type_name, loc.name AS location_name,
        ql.status AS qms_lot_status, ql.lot_number AS qms_lot_number
      FROM ops_lots l
      LEFT JOIN qms_material_types mt ON mt.id = l.material_type_id::text
      LEFT JOIN ops_locations loc ON loc.id = l.location_id
      LEFT JOIN qms_lots ql ON ql.id = l.qms_lot_id::text
      WHERE l.id = ${id} AND l.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; lotNumber: string; jobId: string;
    materialTypeId?: string; inboundWeight?: number; inboundWeightUnit?: string;
    locationId?: string; notes?: string;
    createdById: string; createdAt: string; updatedAt: string;
  }) {
    await sql`
      INSERT INTO ops_lots(
        id, tenant_id, lot_number, job_id, material_type_id, status,
        inbound_weight, inbound_weight_unit, location_id, notes,
        created_by_id, created_at, updated_at
      ) VALUES (
        ${data.id}, ${data.tenantId}, ${data.lotNumber}, ${data.jobId},
        ${data.materialTypeId ?? null}, 'pending',
        ${data.inboundWeight ?? null}, ${data.inboundWeightUnit ?? 'lbs'},
        ${data.locationId ?? null}, ${data.notes ?? null},
        ${data.createdById}, ${data.createdAt}, ${data.updatedAt}
      )
    `;
  },
  async update(id: string, tenantId: string, data: {
    status?: string; materialTypeId?: string; inboundWeight?: number;
    inboundWeightUnit?: string; locationId?: string; notes?: string;
    qmsLotId?: string; updatedAt: string;
  }) {
    await sql`
      UPDATE ops_lots SET
        status = COALESCE(${data.status ?? null}, status),
        material_type_id = COALESCE(${data.materialTypeId ?? null}, material_type_id),
        inbound_weight = COALESCE(${data.inboundWeight ?? null}, inbound_weight),
        inbound_weight_unit = COALESCE(${data.inboundWeightUnit ?? null}, inbound_weight_unit),
        location_id = COALESCE(${data.locationId ?? null}, location_id),
        notes = COALESCE(${data.notes ?? null}, notes),
        qms_lot_id = COALESCE(${data.qmsLotId ?? null}, qms_lot_id),
        updated_at = ${data.updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
  async addStatusHistory(data: {
    id: string; lotId: string; fromStatus?: string; toStatus: string;
    notes?: string; changedById: string; changedAt: string;
  }) {
    await sql`
      INSERT INTO ops_lot_status_history(id, lot_id, from_status, to_status, notes, changed_by_id, changed_at)
      VALUES (${data.id}, ${data.lotId}, ${data.fromStatus ?? null}, ${data.toStatus},
              ${data.notes ?? null}, ${data.changedById}, ${data.changedAt})
    `;
  },
};

export const dbOpsProductionRuns = {
  async getAll(tenantId: string, jobId?: string) {
    if (jobId) {
      const r = await sql`
        SELECT r.*, pt.name AS processing_type_name,
          op.full_name AS operator_name, sv.full_name AS supervisor_name
        FROM ops_production_runs r
        LEFT JOIN ops_processing_types pt ON pt.id = r.processing_type_id
        LEFT JOIN users op ON op.id::text = r.operator_id
        LEFT JOIN users sv ON sv.id::text = r.supervisor_id
        WHERE r.tenant_id = ${tenantId} AND r.job_id = ${jobId}
        ORDER BY r.created_at DESC
      `;
      return r.rows;
    }
    const r = await sql`
      SELECT r.*, pt.name AS processing_type_name,
        op.full_name AS operator_name, sv.full_name AS supervisor_name
      FROM ops_production_runs r
      LEFT JOIN ops_processing_types pt ON pt.id = r.processing_type_id
      LEFT JOIN users op ON op.id::text = r.operator_id
      LEFT JOIN users sv ON sv.id::text = r.supervisor_id
      WHERE r.tenant_id = ${tenantId}
      ORDER BY r.created_at DESC
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT r.*, pt.name AS processing_type_name,
        op.full_name AS operator_name, sv.full_name AS supervisor_name
      FROM ops_production_runs r
      LEFT JOIN ops_processing_types pt ON pt.id = r.processing_type_id
      LEFT JOIN users op ON op.id::text = r.operator_id
      LEFT JOIN users sv ON sv.id::text = r.supervisor_id
      WHERE r.id = ${id} AND r.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; runNumber: string; jobId: string;
    productionLineId?: string; processingTypeId?: string;
    operatorId?: string; supervisorId?: string;
    scheduledStart?: string; inputWeight?: number; inputWeightUnit?: string;
    notes?: string; createdById: string; createdAt: string; updatedAt: string;
  }) {
    await sql`
      INSERT INTO ops_production_runs(
        id, tenant_id, run_number, job_id, production_line_id, processing_type_id,
        operator_id, supervisor_id, status, scheduled_start,
        input_weight, input_weight_unit, notes, created_by_id, created_at, updated_at
      ) VALUES (
        ${data.id}, ${data.tenantId}, ${data.runNumber}, ${data.jobId},
        ${data.productionLineId ?? null}, ${data.processingTypeId ?? null},
        ${data.operatorId ?? null}, ${data.supervisorId ?? null},
        'scheduled', ${data.scheduledStart ?? null},
        ${data.inputWeight ?? null}, ${data.inputWeightUnit ?? 'lbs'},
        ${data.notes ?? null}, ${data.createdById}, ${data.createdAt}, ${data.updatedAt}
      )
    `;
  },
  async update(id: string, tenantId: string, data: {
    status?: string; productionLineId?: string; processingTypeId?: string;
    operatorId?: string; supervisorId?: string;
    scheduledStart?: string; actualStart?: string; actualEnd?: string;
    inputWeight?: number; inputWeightUnit?: string;
    outputWeight?: number; outputWeightUnit?: string;
    yieldPercentage?: number; notes?: string; updatedAt: string;
  }) {
    await sql`
      UPDATE ops_production_runs SET
        status = COALESCE(${data.status ?? null}, status),
        production_line_id = COALESCE(${data.productionLineId ?? null}, production_line_id),
        processing_type_id = COALESCE(${data.processingTypeId ?? null}, processing_type_id),
        operator_id = COALESCE(${data.operatorId ?? null}, operator_id),
        supervisor_id = COALESCE(${data.supervisorId ?? null}, supervisor_id),
        scheduled_start = COALESCE(${data.scheduledStart ?? null}, scheduled_start),
        actual_start = COALESCE(${data.actualStart ?? null}, actual_start),
        actual_end = COALESCE(${data.actualEnd ?? null}, actual_end),
        input_weight = COALESCE(${data.inputWeight ?? null}, input_weight),
        input_weight_unit = COALESCE(${data.inputWeightUnit ?? null}, input_weight_unit),
        output_weight = COALESCE(${data.outputWeight ?? null}, output_weight),
        output_weight_unit = COALESCE(${data.outputWeightUnit ?? null}, output_weight_unit),
        yield_percentage = COALESCE(${data.yieldPercentage ?? null}, yield_percentage),
        notes = COALESCE(${data.notes ?? null}, notes),
        updated_at = ${data.updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

export const dbOpsOutboundShipments = {
  async getAll(tenantId: string, jobId?: string) {
    if (jobId) {
      const r = await sql`
        SELECT s.*,
          c.name AS customer_name_resolved,
          ca.name AS carrier_name_resolved
        FROM ops_outbound_shipments s
        LEFT JOIN ops_customers c ON c.id = s.customer_id
        LEFT JOIN ops_carriers ca ON ca.id = s.carrier_id
        WHERE s.tenant_id = ${tenantId} AND s.job_id = ${jobId}
        ORDER BY s.created_at DESC
      `;
      return r.rows;
    }
    const r = await sql`
      SELECT s.*,
        c.name AS customer_name_resolved,
        ca.name AS carrier_name_resolved
      FROM ops_outbound_shipments s
      LEFT JOIN ops_customers c ON c.id = s.customer_id
      LEFT JOIN ops_carriers ca ON ca.id = s.carrier_id
      WHERE s.tenant_id = ${tenantId}
      ORDER BY s.created_at DESC
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT s.*,
        c.name AS customer_name_resolved,
        ca.name AS carrier_name_resolved
      FROM ops_outbound_shipments s
      LEFT JOIN ops_customers c ON c.id = s.customer_id
      LEFT JOIN ops_carriers ca ON ca.id = s.carrier_id
      WHERE s.id = ${id} AND s.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; shipmentNumber: string; jobId: string;
    customerId?: string; carrierId?: string; carrierName?: string;
    driverName?: string; truckNumber?: string; trailerNumber?: string;
    customerPoNumber?: string; bolNumber?: string;
    scheduledDate?: string; notes?: string;
    createdById: string; createdAt: string; updatedAt: string;
  }) {
    await sql`
      INSERT INTO ops_outbound_shipments(
        id, tenant_id, shipment_number, job_id,
        customer_id, carrier_id, carrier_name,
        driver_name, truck_number, trailer_number,
        customer_po_number, bol_number, status,
        scheduled_date, notes, created_by_id, created_at, updated_at
      ) VALUES (
        ${data.id}, ${data.tenantId}, ${data.shipmentNumber}, ${data.jobId},
        ${data.customerId ?? null}, ${data.carrierId ?? null}, ${data.carrierName ?? null},
        ${data.driverName ?? null}, ${data.truckNumber ?? null}, ${data.trailerNumber ?? null},
        ${data.customerPoNumber ?? null}, ${data.bolNumber ?? null}, 'pending',
        ${data.scheduledDate ?? null}, ${data.notes ?? null},
        ${data.createdById}, ${data.createdAt}, ${data.updatedAt}
      )
    `;
  },
  async update(id: string, tenantId: string, data: {
    status?: string; customerId?: string; carrierId?: string; carrierName?: string;
    driverName?: string; truckNumber?: string; trailerNumber?: string;
    customerPoNumber?: string; bolNumber?: string;
    scheduledDate?: string; shippedDate?: string; stagedDate?: string;
    deliveredDate?: string; deliveryNotes?: string;
    totalWeight?: number; totalWeightUnit?: string;
    notes?: string; updatedAt: string;
  }) {
    await sql`
      UPDATE ops_outbound_shipments SET
        status = COALESCE(${data.status ?? null}, status),
        customer_id = COALESCE(${data.customerId ?? null}, customer_id),
        carrier_id = COALESCE(${data.carrierId ?? null}, carrier_id),
        carrier_name = COALESCE(${data.carrierName ?? null}, carrier_name),
        driver_name = COALESCE(${data.driverName ?? null}, driver_name),
        truck_number = COALESCE(${data.truckNumber ?? null}, truck_number),
        trailer_number = COALESCE(${data.trailerNumber ?? null}, trailer_number),
        customer_po_number = COALESCE(${data.customerPoNumber ?? null}, customer_po_number),
        bol_number = COALESCE(${data.bolNumber ?? null}, bol_number),
        scheduled_date = COALESCE(${data.scheduledDate ?? null}, scheduled_date),
        shipped_date = COALESCE(${data.shippedDate ?? null}, shipped_date),
        staged_date = COALESCE(${data.stagedDate ?? null}, staged_date),
        delivered_date = COALESCE(${data.deliveredDate ?? null}, delivered_date),
        delivery_notes = COALESCE(${data.deliveryNotes ?? null}, delivery_notes),
        total_weight = COALESCE(${data.totalWeight ?? null}, total_weight),
        total_weight_unit = COALESCE(${data.totalWeightUnit ?? null}, total_weight_unit),
        notes = COALESCE(${data.notes ?? null}, notes),
        updated_at = ${data.updatedAt}
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
};

export const dbOpsDowntimeEvents = {
  async getAll(tenantId: string, runId?: string, jobId?: string) {
    if (runId) {
      const r = await sql`
        SELECT d.*, u.full_name AS reported_by_name
        FROM ops_downtime_events d
        LEFT JOIN users u ON u.id::text = d.reported_by_id
        WHERE d.tenant_id = ${tenantId} AND d.run_id = ${runId}
        ORDER BY d.start_time DESC
      `;
      return r.rows;
    }
    if (jobId) {
      const r = await sql`
        SELECT d.*, u.full_name AS reported_by_name, r.run_number
        FROM ops_downtime_events d
        LEFT JOIN users u ON u.id::text = d.reported_by_id
        LEFT JOIN ops_production_runs r ON r.id = d.run_id
        WHERE d.tenant_id = ${tenantId} AND r.job_id = ${jobId}
        ORDER BY d.start_time DESC
      `;
      return r.rows;
    }
    const r = await sql`
      SELECT d.*, u.full_name AS reported_by_name, r.run_number
      FROM ops_downtime_events d
      LEFT JOIN users u ON u.id::text = d.reported_by_id
      LEFT JOIN ops_production_runs r ON r.id = d.run_id
      WHERE d.tenant_id = ${tenantId}
      ORDER BY d.start_time DESC
    `;
    return r.rows;
  },
  async getById(id: string, tenantId: string) {
    const r = await sql`
      SELECT d.*, u.full_name AS reported_by_name
      FROM ops_downtime_events d
      LEFT JOIN users u ON u.id::text = d.reported_by_id
      WHERE d.id = ${id} AND d.tenant_id = ${tenantId}
    `;
    return r.rows[0] ?? null;
  },
  async create(data: {
    id: string; tenantId: string; runId?: string; productionLineId?: string;
    reason: string; category?: string;
    startTime: string; endTime?: string; durationMinutes?: number;
    notes?: string; cmmsWorkOrderId?: string;
    reportedById: string; createdAt: string;
  }) {
    await sql`
      INSERT INTO ops_downtime_events(
        id, tenant_id, run_id, production_line_id, reason, category,
        start_time, end_time, duration_minutes, notes, cmms_work_order_id,
        reported_by_id, created_at
      ) VALUES (
        ${data.id}, ${data.tenantId}, ${data.runId ?? null}, ${data.productionLineId ?? null},
        ${data.reason}, ${data.category ?? null},
        ${data.startTime}, ${data.endTime ?? null}, ${data.durationMinutes ?? null},
        ${data.notes ?? null}, ${data.cmmsWorkOrderId ?? null},
        ${data.reportedById}, ${data.createdAt}
      )
    `;
  },
  async update(id: string, tenantId: string, data: {
    reason?: string; category?: string; endTime?: string;
    durationMinutes?: number; notes?: string; cmmsWorkOrderId?: string;
  }) {
    await sql`
      UPDATE ops_downtime_events SET
        reason = COALESCE(${data.reason ?? null}, reason),
        category = COALESCE(${data.category ?? null}, category),
        end_time = COALESCE(${data.endTime ?? null}, end_time),
        duration_minutes = COALESCE(${data.durationMinutes ?? null}, duration_minutes),
        notes = COALESCE(${data.notes ?? null}, notes),
        cmms_work_order_id = COALESCE(${data.cmmsWorkOrderId ?? null}, cmms_work_order_id)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
  },
  async delete(id: string, tenantId: string) {
    await sql`DELETE FROM ops_downtime_events WHERE id = ${id} AND tenant_id = ${tenantId}`;
  },
};

export const dbOpsShipmentDocuments = {
  async getAll(tenantId: string, outboundShipmentId?: string, inboundShipmentId?: string) {
    if (outboundShipmentId) {
      const r = await sql`
        SELECT d.*, u.full_name AS uploaded_by_name
        FROM ops_shipment_documents d
        LEFT JOIN users u ON u.id::text = d.uploaded_by_id
        WHERE d.tenant_id = ${tenantId} AND d.outbound_shipment_id = ${outboundShipmentId}
        ORDER BY d.uploaded_at DESC
      `;
      return r.rows;
    }
    if (inboundShipmentId) {
      const r = await sql`
        SELECT d.*, u.full_name AS uploaded_by_name
        FROM ops_shipment_documents d
        LEFT JOIN users u ON u.id::text = d.uploaded_by_id
        WHERE d.tenant_id = ${tenantId} AND d.inbound_shipment_id = ${inboundShipmentId}
        ORDER BY d.uploaded_at DESC
      `;
      return r.rows;
    }
    const r = await sql`
      SELECT d.*, u.full_name AS uploaded_by_name
      FROM ops_shipment_documents d
      LEFT JOIN users u ON u.id::text = d.uploaded_by_id
      WHERE d.tenant_id = ${tenantId}
      ORDER BY d.uploaded_at DESC
    `;
    return r.rows;
  },
  async create(data: {
    id: string; tenantId: string;
    outboundShipmentId?: string; inboundShipmentId?: string;
    documentType?: string; fileName: string; fileUrl: string;
    uploadedById: string; uploadedAt: string;
  }) {
    await sql`
      INSERT INTO ops_shipment_documents(
        id, tenant_id, outbound_shipment_id, inbound_shipment_id,
        document_type, file_name, file_url, uploaded_by_id, uploaded_at
      ) VALUES (
        ${data.id}, ${data.tenantId},
        ${data.outboundShipmentId ?? null}, ${data.inboundShipmentId ?? null},
        ${data.documentType ?? null}, ${data.fileName}, ${data.fileUrl},
        ${data.uploadedById}, ${data.uploadedAt}
      )
    `;
  },
  async delete(id: string, tenantId: string) {
    await sql`DELETE FROM ops_shipment_documents WHERE id = ${id} AND tenant_id = ${tenantId}`;
  },
};
