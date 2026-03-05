import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbOpsProductionRuns } from "@/lib/db-ops";
import { initDb } from "@/lib/db";
import { logActivity } from "@/lib/db-activity";
import { sql } from "@vercel/postgres";

const MANAGER = ["owner", "admin", "engineer"] as const;
const ALL_OPS = ["owner", "admin", "engineer", "shipping", "receiving", "quality_manager", "quality_tech", "worker"] as const;

const VALID_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...ALL_OPS]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const run = await dbOpsProductionRuns.getById(id, auth.payload.tenantId!);
  if (!run) return NextResponse.json({ error: "Production run not found" }, { status: 404 });

  // Get input lots
  const inputLots = await sql`
    SELECT ril.*, l.lot_number, l.status AS lot_status, mt.name AS material_type_name
    FROM ops_run_input_lots ril
    JOIN ops_lots l ON l.id = ril.lot_id
    LEFT JOIN qms_material_types mt ON mt.id = l.material_type_id
    WHERE ril.run_id = ${id}
  `;

  return NextResponse.json({ ...run, inputLots: inputLots.rows });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const body = await request.json();

  const run = await dbOpsProductionRuns.getById(id, auth.payload.tenantId!);
  if (!run) return NextResponse.json({ error: "Production run not found" }, { status: 404 });

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Auto-set timestamps based on status transitions
  const updates: Parameters<typeof dbOpsProductionRuns.update>[2] = { ...body, updatedAt: now };
  if (body.status === "in_progress" && !run.actual_start) updates.actualStart = now;
  if (body.status === "completed" && !run.actual_end) updates.actualEnd = now;

  // Auto-calculate yield if both weights provided
  const outputWeight = body.outputWeight ?? run.output_weight;
  const inputWeight = body.inputWeight ?? run.input_weight;
  if (outputWeight != null && inputWeight != null && inputWeight > 0) {
    updates.yieldPercentage = (outputWeight / inputWeight) * 100;
  }

  await dbOpsProductionRuns.update(id, auth.payload.tenantId!, updates);

  // Link input lots if provided
  if (Array.isArray(body.inputLotIds)) {
    // Remove existing, re-insert
    await sql`DELETE FROM ops_run_input_lots WHERE run_id = ${id}`;
    for (const lotId of body.inputLotIds) {
      await sql`
        INSERT INTO ops_run_input_lots(run_id, lot_id)
        VALUES (${id}, ${lotId})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  logActivity({ tenantId: auth.payload.tenantId!, userId: auth.payload.userId, role: auth.payload.role,
    action: "updated", entityType: "ops_production_run", entityId: id, entityName: run.run_number }).catch(() => {});
  return NextResponse.json({ ok: true, yieldPercentage: updates.yieldPercentage });
}
