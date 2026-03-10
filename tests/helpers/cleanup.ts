/**
 * Test data cleanup — deletes all rows for the test tenants in
 * dependency order (children before parents) so FK constraints pass.
 * Never drops tables.
 */
import { sql } from "@vercel/postgres";
import { TEST_TENANT_ID, OTHER_TENANT_ID } from "./auth";

const TENANTS = [TEST_TENANT_ID, OTHER_TENANT_ID];

export async function cleanTestTenants() {
  for (const t of TENANTS) {
    // ── OPS (children before parents) ────────────────────────────────────
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
    // Counter pattern: "TYPE:tenantId:period"
    const opsPattern = `%:${t}:%`;
    await sql`DELETE FROM ops_counters WHERE id LIKE ${opsPattern}`;

    // ── QMS (children before parents) ────────────────────────────────────
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
    const qmsPattern = `%:${t}:%`;
    await sql`DELETE FROM qms_counters WHERE id LIKE ${qmsPattern}`;

    // ── CMMS (children before parents) ───────────────────────────────────
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

    // ── Core ─────────────────────────────────────────────────────────────
    await sql`DELETE FROM activity_logs              WHERE tenant_id = ${t}`;
    await sql`DELETE FROM incidents                  WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM checklist_submissions      WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM checklist_templates        WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM quality_documents          WHERE tenant_id = ${t}`.catch(() => {});
    await sql`DELETE FROM users                      WHERE tenant_id = ${t}`;
  }

  // Remove test tenants last
  for (const t of TENANTS) {
    await sql`DELETE FROM tenants WHERE id = ${t}`;
  }
}
