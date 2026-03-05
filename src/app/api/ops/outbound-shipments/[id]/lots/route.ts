import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { initDb } from "@/lib/db";
import { sql } from "@vercel/postgres";

const SHIPPING = ["owner", "admin", "engineer", "shipping"] as const;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...SHIPPING]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id: outboundShipmentId } = await params;
  const body = await request.json();
  const { lotId, weight, weightUnit } = body;

  if (!lotId) return NextResponse.json({ error: "lotId is required" }, { status: 400 });

  await sql`
    INSERT INTO ops_outbound_lots(outbound_shipment_id, lot_id, weight, weight_unit)
    VALUES (${outboundShipmentId}, ${lotId}, ${weight ?? null}, ${weightUnit ?? "lbs"})
    ON CONFLICT (outbound_shipment_id, lot_id) DO UPDATE
      SET weight = EXCLUDED.weight, weight_unit = EXCLUDED.weight_unit
  `;

  // Recalculate total weight on the shipment
  const totals = await sql`
    SELECT SUM(weight) AS total_weight, MAX(weight_unit) AS weight_unit
    FROM ops_outbound_lots WHERE outbound_shipment_id = ${outboundShipmentId}
  `;
  const total = totals.rows[0];
  if (total?.total_weight != null) {
    await sql`
      UPDATE ops_outbound_shipments
      SET total_weight = ${total.total_weight}, total_weight_unit = ${total.weight_unit ?? "lbs"},
          updated_at = ${new Date().toISOString()}
      WHERE id = ${outboundShipmentId}
    `;
  }

  // Update lot status to shipped
  await sql`UPDATE ops_lots SET status = 'shipped', updated_at = ${new Date().toISOString()} WHERE id = ${lotId}`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...SHIPPING]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id: outboundShipmentId } = await params;
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lotId");
  if (!lotId) return NextResponse.json({ error: "lotId query param required" }, { status: 400 });

  await sql`DELETE FROM ops_outbound_lots WHERE outbound_shipment_id = ${outboundShipmentId} AND lot_id = ${lotId}`;

  // Revert lot status to approved
  await sql`UPDATE ops_lots SET status = 'approved', updated_at = ${new Date().toISOString()} WHERE id = ${lotId}`;

  return NextResponse.json({ ok: true });
}
