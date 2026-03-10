/**
 * Test data seed script.
 * Run:   npx tsx scripts/seed-test.ts
 * Reset: npx tsx scripts/seed-test.ts --reset  (clean only, no reseed)
 *
 * All IDs are fixed UUIDs so tests can reference them by name.
 * Idempotent: always cleans test tenants before inserting.
 */

// ── Load .env.test before any DB imports ────────────────────────────────────
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.test") });

// Polyfill Web Crypto for Node < 19
if (typeof globalThis.crypto === "undefined") {
  const { webcrypto } = await import("node:crypto");
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}

// ── Imports (after env is loaded) ────────────────────────────────────────────
import { sql } from "@vercel/postgres";
import { hashPassword } from "../src/lib/auth";
import { initDb } from "../src/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Fixed IDs — import these in tests via ../tests/helpers/seed-ids.ts
// ─────────────────────────────────────────────────────────────────────────────

export const IDS = {
  // Tenants
  TEST_TENANT:  "00000000-0000-0000-0000-000000000001",
  OTHER_TENANT: "00000000-0000-0000-0000-000000000002",

  // Users (TEST_TENANT)
  USER_WORKER:        "00000000-0000-0000-0000-000000000011",
  USER_QTECH:         "00000000-0000-0000-0000-000000000012",
  USER_QMANAGER:      "00000000-0000-0000-0000-000000000013",
  USER_ENGINEER:      "00000000-0000-0000-0000-000000000014",
  USER_SHIPPING:      "00000000-0000-0000-0000-000000000015",
  USER_RECEIVING:     "00000000-0000-0000-0000-000000000016",
  USER_MTECH:         "00000000-0000-0000-0000-000000000017",
  USER_MMANAGER:      "00000000-0000-0000-0000-000000000018",
  USER_ADMIN:         "00000000-0000-0000-0000-000000000019",
  USER_OWNER:         "00000000-0000-0000-0000-00000000001a",
  USER_SUPERADMIN:    "00000000-0000-0000-0000-00000000001b",
  USER_INACTIVE:      "00000000-0000-0000-0000-00000000001c",
  // User (OTHER_TENANT)
  USER_OTHER_ADMIN:   "00000000-0000-0000-0000-000000000099",

  // QMS
  QMS_MATERIAL_TYPE:   "10000000-0000-0000-0000-000000000001",
  QMS_PARAM_DENSITY:   "10000000-0000-0000-0000-000000000002",
  QMS_PARAM_METAL:     "10000000-0000-0000-0000-000000000003",
  QMS_TEMPLATE:        "10000000-0000-0000-0000-000000000004",
  QMS_TMPL_ITEM_1:     "10000000-0000-0000-0000-000000000005",
  QMS_TMPL_ITEM_2:     "10000000-0000-0000-0000-000000000006",
  QMS_CUSTOMER_SPEC:   "10000000-0000-0000-0000-000000000007",
  QMS_LOT_PENDING:     "10000000-0000-0000-0000-000000000010",
  QMS_LOT_IN_PROGRESS: "10000000-0000-0000-0000-000000000011",
  QMS_LOT_APPROVED:    "10000000-0000-0000-0000-000000000012",
  QMS_INSPECTION:      "10000000-0000-0000-0000-000000000020",
  QMS_INSP_RESULT_1:   "10000000-0000-0000-0000-000000000021",
  QMS_INSP_RESULT_2:   "10000000-0000-0000-0000-000000000022",
  QMS_NCR:             "10000000-0000-0000-0000-000000000030",
  QMS_COMPLAINT:       "10000000-0000-0000-0000-000000000040",

  // CMMS
  CMMS_MACHINE_TYPE:   "20000000-0000-0000-0000-000000000001",
  CMMS_LINE:           "20000000-0000-0000-0000-000000000002",
  CMMS_MACHINE:        "20000000-0000-0000-0000-000000000003",
  CMMS_WORK_ORDER:     "20000000-0000-0000-0000-000000000004",
  CMMS_BREAKDOWN:      "20000000-0000-0000-0000-000000000005",

  // OPS
  OPS_CUSTOMER:        "30000000-0000-0000-0000-000000000001",
  OPS_VENDOR:          "30000000-0000-0000-0000-000000000002",
  OPS_CARRIER:         "30000000-0000-0000-0000-000000000003",
  OPS_PROC_TYPE:       "30000000-0000-0000-0000-000000000004",
  OPS_LOCATION:        "30000000-0000-0000-0000-000000000005",
  OPS_JOB:             "30000000-0000-0000-0000-000000000010",
  OPS_INBOUND:         "30000000-0000-0000-0000-000000000020",
  OPS_WEIGHT_ENTRY:    "30000000-0000-0000-0000-000000000021",
  OPS_LOT:             "30000000-0000-0000-0000-000000000030",
  OPS_RUN:             "30000000-0000-0000-0000-000000000040",
  OPS_OUTBOUND:        "30000000-0000-0000-0000-000000000050",
} as const;

const now = new Date().toISOString();
const TEST  = IDS.TEST_TENANT;
const OTHER = IDS.OTHER_TENANT;

// ─────────────────────────────────────────────────────────────────────────────
// Clean
// ─────────────────────────────────────────────────────────────────────────────

async function clean() {
  for (const t of [TEST, OTHER]) {
    // OPS
    await sql`DELETE FROM ops_shipment_documents     WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_outbound_lots          WHERE outbound_shipment_id IN (SELECT id FROM ops_outbound_shipments WHERE tenant_id = ${t})`;
    await sql`DELETE FROM ops_outbound_shipments     WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_downtime_events        WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_run_input_lots         WHERE run_id IN (SELECT id FROM ops_production_runs WHERE tenant_id = ${t})`;
    await sql`DELETE FROM ops_production_runs        WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_lot_inbound_links      WHERE lot_id IN (SELECT id FROM ops_lots WHERE tenant_id = ${t})`;
    await sql`DELETE FROM ops_lot_status_history     WHERE lot_id IN (SELECT id FROM ops_lots WHERE tenant_id = ${t})`;
    await sql`DELETE FROM ops_lots                   WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_weight_entries         WHERE inbound_shipment_id IN (SELECT id FROM ops_inbound_shipments WHERE tenant_id = ${t})`;
    await sql`DELETE FROM ops_inbound_shipments      WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_job_status_history     WHERE job_id IN (SELECT id FROM ops_jobs WHERE tenant_id = ${t})`;
    await sql`DELETE FROM ops_jobs                   WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_processing_types       WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_locations              WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_carriers               WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_vendors                WHERE tenant_id = ${t}`;
    await sql`DELETE FROM ops_customers              WHERE tenant_id = ${t}`;
    const opsP = `%:${t}:%`;
    await sql`DELETE FROM ops_counters WHERE id LIKE ${opsP}`;
    // QMS
    await sql`DELETE FROM qms_coas                   WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_ncr_activities         WHERE ncr_id IN (SELECT id FROM qms_ncrs WHERE tenant_id = ${t})`;
    await sql`DELETE FROM qms_ncrs                   WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_complaints             WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_inspection_photos      WHERE inspection_id IN (SELECT id FROM qms_inspections WHERE tenant_id = ${t})`;
    await sql`DELETE FROM qms_inspection_results     WHERE inspection_id IN (SELECT id FROM qms_inspections WHERE tenant_id = ${t})`;
    await sql`DELETE FROM qms_inspections            WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_lots                   WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_template_items         WHERE template_id IN (SELECT id FROM qms_templates WHERE tenant_id = ${t})`;
    await sql`DELETE FROM qms_templates              WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_customer_specs         WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_parameters             WHERE tenant_id = ${t}`;
    await sql`DELETE FROM qms_material_types         WHERE tenant_id = ${t}`;
    const qmsP = `%:${t}:%`;
    await sql`DELETE FROM qms_counters WHERE id LIKE ${qmsP}`;
    // CMMS
    await sql`DELETE FROM cmms_notifications         WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_procedure_revisions   WHERE procedure_sheet_id IN (SELECT id FROM cmms_procedure_sheets WHERE tenant_id = ${t})`;
    await sql`DELETE FROM cmms_procedure_sheets      WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_breakdown_reports     WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_log_sheet_responses   WHERE submission_id IN (SELECT id FROM cmms_log_sheet_submissions WHERE tenant_id = ${t})`;
    await sql`DELETE FROM cmms_log_sheet_submissions WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_log_sheet_fields      WHERE template_id IN (SELECT id FROM cmms_log_sheet_templates WHERE tenant_id = ${t})`;
    await sql`DELETE FROM cmms_log_sheet_templates   WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_checklist_responses   WHERE submission_id IN (SELECT id FROM cmms_checklist_submissions WHERE tenant_id = ${t})`;
    await sql`DELETE FROM cmms_checklist_submissions WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_checklist_items       WHERE template_id IN (SELECT id FROM cmms_checklist_templates WHERE tenant_id = ${t})`;
    await sql`DELETE FROM cmms_checklist_templates   WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_maintenance_schedules WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_work_orders           WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_line_assignment_logs  WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_machine_technicians   WHERE machine_id IN (SELECT id FROM cmms_machines WHERE tenant_id = ${t})`;
    await sql`DELETE FROM cmms_machines              WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_production_lines      WHERE tenant_id = ${t}`;
    await sql`DELETE FROM cmms_machine_types         WHERE tenant_id = ${t}`;
    // Core
    await sql`DELETE FROM activity_logs              WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM incidents                  WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM checklist_submissions      WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM checklist_templates        WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM quality_documents          WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM users                      WHERE tenant_id = ${t}`;
  }
  // super_admin user has tenant_id = null — delete by ID
  await sql`DELETE FROM users WHERE id = ${IDS.USER_SUPERADMIN}`;
  // Remove test tenants
  for (const t of [TEST, OTHER]) {
    await sql`DELETE FROM tenants WHERE id = ${t}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  const pw = await hashPassword("password123");

  // ── Tenants ──────────────────────────────────────────────────────────────
  await sql`
    INSERT INTO tenants (id, name, code, active, created_at)
    VALUES (${TEST}, 'Test Company', 'TC', true, ${now})
  `;
  await sql`
    INSERT INTO tenants (id, name, code, active, created_at)
    VALUES (${OTHER}, 'Other Company', 'OC', true, ${now})
  `;

  // ── Users ─────────────────────────────────────────────────────────────────
  const users: Array<{ id: string; username: string; fullName: string; role: string; tenantId: string | null; active: boolean }> = [
    { id: IDS.USER_WORKER,    username: "test.worker",     fullName: "Test Worker",            role: "worker",               tenantId: TEST,  active: true },
    { id: IDS.USER_QTECH,     username: "test.qtech",      fullName: "Test Quality Tech",       role: "quality_tech",         tenantId: TEST,  active: true },
    { id: IDS.USER_QMANAGER,  username: "test.qmanager",   fullName: "Test Quality Manager",    role: "quality_manager",      tenantId: TEST,  active: true },
    { id: IDS.USER_ENGINEER,  username: "test.engineer",   fullName: "Test Engineer",           role: "engineer",             tenantId: TEST,  active: true },
    { id: IDS.USER_SHIPPING,  username: "test.shipping",   fullName: "Test Shipping",           role: "shipping",             tenantId: TEST,  active: true },
    { id: IDS.USER_RECEIVING, username: "test.receiving",  fullName: "Test Receiving",          role: "receiving",            tenantId: TEST,  active: true },
    { id: IDS.USER_MTECH,     username: "test.mtech",      fullName: "Test Maintenance Tech",   role: "maintenance_tech",     tenantId: TEST,  active: true },
    { id: IDS.USER_MMANAGER,  username: "test.mmanager",   fullName: "Test Maintenance Manager",role: "maintenance_manager",  tenantId: TEST,  active: true },
    { id: IDS.USER_ADMIN,     username: "test.admin",      fullName: "Test Admin",              role: "admin",                tenantId: TEST,  active: true },
    { id: IDS.USER_OWNER,     username: "test.owner",      fullName: "Test Owner",              role: "owner",                tenantId: TEST,  active: true },
    { id: IDS.USER_SUPERADMIN,username: "test.superadmin", fullName: "Test Super Admin",        role: "super_admin",          tenantId: null,  active: true },
    { id: IDS.USER_INACTIVE,  username: "test.inactive",   fullName: "Test Inactive User",      role: "worker",               tenantId: TEST,  active: false },
    { id: IDS.USER_OTHER_ADMIN, username: "other.admin",   fullName: "Other Tenant Admin",      role: "admin",                tenantId: OTHER, active: true },
  ];

  for (const u of users) {
    await sql`
      INSERT INTO users (id, username, password_hash, full_name, role, active, tenant_id, created_at, updated_at)
      VALUES (${u.id}, ${u.username}, ${pw}, ${u.fullName}, ${u.role}, ${u.active}, ${u.tenantId}, ${now}, ${now})
    `;
  }

  // ── QMS ──────────────────────────────────────────────────────────────────

  // Material type
  await sql`
    INSERT INTO qms_material_types (id, tenant_id, name, code, description, created_at)
    VALUES (${IDS.QMS_MATERIAL_TYPE}, ${TEST}, 'Polypropylene', 'PP', 'General-purpose polypropylene resin', ${now})
  `;

  // Parameters
  await sql`
    INSERT INTO qms_parameters (id, tenant_id, name, code, parameter_type, unit, description, created_at)
    VALUES (${IDS.QMS_PARAM_DENSITY}, ${TEST}, 'Bulk Density', 'bulk_density', 'numeric', 'g/cc', 'Bulk density measurement', ${now})
  `;
  await sql`
    INSERT INTO qms_parameters (id, tenant_id, name, code, parameter_type, unit, description, created_at)
    VALUES (${IDS.QMS_PARAM_METAL}, ${TEST}, 'Metal Contamination', 'metal_contam', 'percentage', '%', 'Metal contamination level', ${now})
  `;

  // Inspection template
  await sql`
    INSERT INTO qms_templates (id, tenant_id, material_type_id, name, revision_number, is_current, created_by_id, created_at)
    VALUES (${IDS.QMS_TEMPLATE}, ${TEST}, ${IDS.QMS_MATERIAL_TYPE}, 'PP Incoming Inspection', 1, true, ${IDS.USER_QMANAGER}, ${now})
  `;
  await sql`
    INSERT INTO qms_template_items (id, template_id, parameter_id, order_num, min_value, max_value, target_value, is_required, reading_count, statistic)
    VALUES (${IDS.QMS_TMPL_ITEM_1}, ${IDS.QMS_TEMPLATE}, ${IDS.QMS_PARAM_DENSITY}, 1, 0.3, 0.6, 0.45, true, 3, 'average')
  `;
  await sql`
    INSERT INTO qms_template_items (id, template_id, parameter_id, order_num, min_value, max_value, target_value, is_required, reading_count, statistic)
    VALUES (${IDS.QMS_TMPL_ITEM_2}, ${IDS.QMS_TEMPLATE}, ${IDS.QMS_PARAM_METAL}, 2, null, 0.5, 0.0, true, 1, 'average')
  `;

  // Customer spec
  await sql`
    INSERT INTO qms_customer_specs (id, tenant_id, customer_name, material_type_id, parameter_id, min_value, max_value, requires_coa, created_at)
    VALUES (${IDS.QMS_CUSTOMER_SPEC}, ${TEST}, 'Acme Corp', ${IDS.QMS_MATERIAL_TYPE}, ${IDS.QMS_PARAM_DENSITY}, 0.35, 0.55, true, ${now})
  `;

  // Lots at different statuses
  await sql`
    INSERT INTO qms_lots (id, tenant_id, lot_number, material_type_id, status, input_weight_kg, created_by_id, created_at, updated_at)
    VALUES (${IDS.QMS_LOT_PENDING}, ${TEST}, 'QMS-LOT-9001', ${IDS.QMS_MATERIAL_TYPE}, 'pending_qc', 500.0, ${IDS.USER_QTECH}, ${now}, ${now})
  `;
  await sql`
    INSERT INTO qms_lots (id, tenant_id, lot_number, material_type_id, status, input_weight_kg, created_by_id, created_at, updated_at)
    VALUES (${IDS.QMS_LOT_IN_PROGRESS}, ${TEST}, 'QMS-LOT-9002', ${IDS.QMS_MATERIAL_TYPE}, 'qc_in_progress', 500.0, ${IDS.USER_QTECH}, ${now}, ${now})
  `;
  await sql`
    INSERT INTO qms_lots (id, tenant_id, lot_number, material_type_id, status, input_weight_kg, output_weight_kg, yield_percentage, created_by_id, created_at, updated_at)
    VALUES (${IDS.QMS_LOT_APPROVED}, ${TEST}, 'QMS-LOT-9003', ${IDS.QMS_MATERIAL_TYPE}, 'approved', 500.0, 480.0, 96.0, ${IDS.USER_QTECH}, ${now}, ${now})
  `;

  // Inspection (submitted, with results)
  await sql`
    INSERT INTO qms_inspections (id, tenant_id, lot_id, template_id, inspected_by_id, status, overall_result, submitted_at, created_at)
    VALUES (${IDS.QMS_INSPECTION}, ${TEST}, ${IDS.QMS_LOT_IN_PROGRESS}, ${IDS.QMS_TEMPLATE}, ${IDS.USER_QTECH}, 'submitted', 'PASS', ${now}, ${now})
  `;
  await sql`
    INSERT INTO qms_inspection_results (id, inspection_id, parameter_id, value, numeric_value, is_within_spec, is_flagged)
    VALUES (${IDS.QMS_INSP_RESULT_1}, ${IDS.QMS_INSPECTION}, ${IDS.QMS_PARAM_DENSITY}, '0.45', 0.45, true, false)
  `;
  await sql`
    INSERT INTO qms_inspection_results (id, inspection_id, parameter_id, value, numeric_value, is_within_spec, is_flagged)
    VALUES (${IDS.QMS_INSP_RESULT_2}, ${IDS.QMS_INSPECTION}, ${IDS.QMS_PARAM_METAL}, '0.1', 0.1, true, false)
  `;

  // NCR (open)
  await sql`
    INSERT INTO qms_ncrs (id, tenant_id, ncr_number, lot_id, inspection_id, source, severity, status, title, description, created_by_id, created_at, updated_at)
    VALUES (${IDS.QMS_NCR}, ${TEST}, 'NCR-2026-9001', ${IDS.QMS_LOT_IN_PROGRESS}, ${IDS.QMS_INSPECTION}, 'internal_inspection', 'minor', 'open', 'Density slightly below spec', 'Test NCR for integration tests', ${IDS.USER_QMANAGER}, ${now}, ${now})
  `;

  // Complaint (open)
  await sql`
    INSERT INTO qms_complaints (id, tenant_id, complaint_number, customer_name, material_type_id, description, received_date, status, created_by_id, created_at)
    VALUES (${IDS.QMS_COMPLAINT}, ${TEST}, 'CC-2026-9001', 'Acme Corp', ${IDS.QMS_MATERIAL_TYPE}, 'Test customer complaint for integration tests', ${now}, 'open', ${IDS.USER_QMANAGER}, ${now})
  `;

  // ── CMMS ─────────────────────────────────────────────────────────────────

  // Machine type
  await sql`
    INSERT INTO cmms_machine_types (id, tenant_id, name, created_at)
    VALUES (${IDS.CMMS_MACHINE_TYPE}, ${TEST}, 'Granulator', ${now})
  `;

  // Production line (shared with OPS)
  await sql`
    INSERT INTO cmms_production_lines (id, tenant_id, line_id, name, is_active, created_at)
    VALUES (${IDS.CMMS_LINE}, ${TEST}, 'L1', 'Line 1', true, ${now})
  `;

  // Machine
  await sql`
    INSERT INTO cmms_machines (id, tenant_id, machine_id, name, machine_type_id, default_line_id, current_line_id, status, runtime_hours, runtime_cycles, created_at)
    VALUES (${IDS.CMMS_MACHINE}, ${TEST}, 'G001', 'Granulator A', ${IDS.CMMS_MACHINE_TYPE}, ${IDS.CMMS_LINE}, ${IDS.CMMS_LINE}, 'running', 150.5, 1200, ${now})
  `;

  // Breakdown report
  await sql`
    INSERT INTO cmms_breakdown_reports (id, tenant_id, machine_id, reported_by_id, description, created_at)
    VALUES (${IDS.CMMS_BREAKDOWN}, ${TEST}, ${IDS.CMMS_MACHINE}, ${IDS.USER_MTECH}, 'Test breakdown: unusual vibration detected', ${now})
  `;

  // Work order (open, corrective)
  await sql`
    INSERT INTO cmms_work_orders (id, tenant_id, work_order_number, type, status, machine_id, assigned_to_id, breakdown_report_id, description, created_at, created_by_id)
    VALUES (${IDS.CMMS_WORK_ORDER}, ${TEST}, 'WO-9001', 'corrective', 'open', ${IDS.CMMS_MACHINE}, ${IDS.USER_MTECH}, ${IDS.CMMS_BREAKDOWN}, 'Investigate and resolve vibration issue', ${now}, ${IDS.USER_MMANAGER})
  `;

  // ── OPS ──────────────────────────────────────────────────────────────────

  // Master data
  await sql`
    INSERT INTO ops_customers (id, tenant_id, name, code, contact_name, contact_email, active, created_at)
    VALUES (${IDS.OPS_CUSTOMER}, ${TEST}, 'Test Customer Inc', 'TCI', 'Jane Doe', 'jane@testcustomer.com', true, ${now})
  `;
  await sql`
    INSERT INTO ops_vendors (id, tenant_id, name, code, contact_name, active, created_at)
    VALUES (${IDS.OPS_VENDOR}, ${TEST}, 'Test Supplier LLC', 'TSL', 'John Smith', true, ${now})
  `;
  await sql`
    INSERT INTO ops_carriers (id, tenant_id, name, code, active, created_at)
    VALUES (${IDS.OPS_CARRIER}, ${TEST}, 'Test Carrier Co', 'TCC', true, ${now})
  `;
  await sql`
    INSERT INTO ops_processing_types (id, tenant_id, name, code, production_line_id, active, created_at)
    VALUES (${IDS.OPS_PROC_TYPE}, ${TEST}, 'Granulation', 'GRN', ${IDS.CMMS_LINE}, true, ${now})
  `;
  await sql`
    INSERT INTO ops_locations (id, tenant_id, name, code, type, active, created_at)
    VALUES (${IDS.OPS_LOCATION}, ${TEST}, 'Bay A', 'BAY-A', 'storage', true, ${now})
  `;

  // Job
  await sql`
    INSERT INTO ops_jobs (id, tenant_id, job_number, job_type, status, customer_id, material_type_id, description, created_by_id, created_at, updated_at)
    VALUES (${IDS.OPS_JOB}, ${TEST}, 'JOB-2026-9001', 'toll', 'open', ${IDS.OPS_CUSTOMER}, ${IDS.QMS_MATERIAL_TYPE}, 'Test toll processing job', ${IDS.USER_ADMIN}, ${now}, ${now})
  `;

  // Inbound shipment (received)
  await sql`
    INSERT INTO ops_inbound_shipments (id, tenant_id, shipment_number, job_id, vendor_id, carrier_id, carrier_name, driver_name, truck_number, status, received_date, location_id, created_by_id, created_at, updated_at)
    VALUES (${IDS.OPS_INBOUND}, ${TEST}, 'SHP-IN-2026-03-9001', ${IDS.OPS_JOB}, ${IDS.OPS_VENDOR}, ${IDS.OPS_CARRIER}, 'Test Carrier Co', 'Bob Driver', 'TRK-001', 'received', ${now}, ${IDS.OPS_LOCATION}, ${IDS.USER_RECEIVING}, ${now}, ${now})
  `;

  // Weight entry
  await sql`
    INSERT INTO ops_weight_entries (id, tenant_id, inbound_shipment_id, entry_number, gross_weight, tare_weight, net_weight, weight_unit, container_label, entered_by_id, entered_at)
    VALUES (${IDS.OPS_WEIGHT_ENTRY}, ${TEST}, ${IDS.OPS_INBOUND}, 1, 1000.0, 100.0, 900.0, 'lbs', 'GAYLORD-001', ${IDS.USER_RECEIVING}, ${now})
  `;

  // Lot
  await sql`
    INSERT INTO ops_lots (id, tenant_id, lot_number, job_id, material_type_id, status, inbound_weight, inbound_weight_unit, location_id, created_by_id, created_at, updated_at)
    VALUES (${IDS.OPS_LOT}, ${TEST}, 'OPS-LOT-2026-03-9001', ${IDS.OPS_JOB}, ${IDS.QMS_MATERIAL_TYPE}, 'processing', 900.0, 'lbs', ${IDS.OPS_LOCATION}, ${IDS.USER_ADMIN}, ${now}, ${now})
  `;
  // Link lot to inbound shipment
  await sql`
    INSERT INTO ops_lot_inbound_links (lot_id, inbound_shipment_id)
    VALUES (${IDS.OPS_LOT}, ${IDS.OPS_INBOUND})
  `;

  // Production run (completed)
  await sql`
    INSERT INTO ops_production_runs (id, tenant_id, run_number, job_id, production_line_id, processing_type_id, operator_id, status, actual_start, actual_end, input_weight, input_weight_unit, output_weight, output_weight_unit, yield_percentage, created_by_id, created_at, updated_at)
    VALUES (${IDS.OPS_RUN}, ${TEST}, 'RUN-2026-03-9001', ${IDS.OPS_JOB}, ${IDS.CMMS_LINE}, ${IDS.OPS_PROC_TYPE}, ${IDS.USER_WORKER}, 'completed', ${now}, ${now}, 900.0, 'lbs', 855.0, 'lbs', 95.0, ${IDS.USER_ADMIN}, ${now}, ${now})
  `;
  // Link run to lot
  await sql`
    INSERT INTO ops_run_input_lots (run_id, lot_id, weight_used, weight_unit)
    VALUES (${IDS.OPS_RUN}, ${IDS.OPS_LOT}, 900.0, 'lbs')
  `;

  // Outbound shipment (pending)
  await sql`
    INSERT INTO ops_outbound_shipments (id, tenant_id, shipment_number, job_id, customer_id, carrier_id, carrier_name, customer_po_number, status, total_weight, total_weight_unit, created_by_id, created_at, updated_at)
    VALUES (${IDS.OPS_OUTBOUND}, ${TEST}, 'SHP-OUT-2026-03-9001', ${IDS.OPS_JOB}, ${IDS.OPS_CUSTOMER}, ${IDS.OPS_CARRIER}, 'Test Carrier Co', 'PO-TEST-001', 'pending', 855.0, 'lbs', ${IDS.USER_SHIPPING}, ${now}, ${now})
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const resetOnly = process.argv.includes("--reset");

  console.log("Initializing database tables...");
  await initDb();

  console.log("Cleaning test tenants...");
  await clean();

  if (resetOnly) {
    console.log("Reset complete (clean only, no reseed).");
  } else {
    console.log("Seeding test data...");
    await seed();
    console.log("Done. Test data is ready.");
  }

  process.exit(0);
}

// Export for use in integration tests (imported as a module, not as a CLI script)
export { clean as cleanTestData, seed as seedTestData };

// Only auto-run when executed directly (npx tsx scripts/seed-test.ts)
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/seed-test.ts");
if (isDirectRun) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
