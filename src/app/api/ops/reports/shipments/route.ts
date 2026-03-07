import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { initDb } from "@/lib/db";
import { sql } from "@vercel/postgres";

const MANAGER = ["owner", "admin", "engineer"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER]);
  if (!auth.ok) return auth.response;
  await initDb();

  const tid = auth.payload.tenantId!;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "90");
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [inbound, outbound, byVendor, byCustomer] = await Promise.all([
    // Recent inbound shipments with weight totals
    sql`
      SELECT s.*,
        v.name AS vendor_name,
        car.name AS carrier_name_resolved,
        COALESCE(we.total_net, we.total_gross, 0)::float AS total_weight,
        we.weight_unit,
        COALESCE(we.entry_count, 0)::int AS entry_count
      FROM ops_inbound_shipments s
      LEFT JOIN ops_vendors v ON v.id = s.vendor_id
      LEFT JOIN ops_carriers car ON car.id = s.carrier_id
      LEFT JOIN (
        SELECT inbound_shipment_id,
          SUM(COALESCE(net_weight, gross_weight)) AS total_net,
          SUM(gross_weight) AS total_gross,
          MAX(weight_unit) AS weight_unit,
          COUNT(*) AS entry_count
        FROM ops_weight_entries GROUP BY inbound_shipment_id
      ) we ON we.inbound_shipment_id = s.id
      WHERE s.tenant_id = ${tid} AND s.created_at >= ${since}
      ORDER BY s.created_at DESC LIMIT 50
    `,
    // Recent outbound shipments
    sql`
      SELECT s.*,
        c.name AS customer_name_resolved,
        car.name AS carrier_name_resolved,
        COUNT(ol.lot_id)::int AS lot_count
      FROM ops_outbound_shipments s
      LEFT JOIN ops_customers c ON c.id = s.customer_id
      LEFT JOIN ops_carriers car ON car.id = s.carrier_id
      LEFT JOIN ops_outbound_lots ol ON ol.outbound_shipment_id = s.id
      WHERE s.tenant_id = ${tid} AND s.created_at >= ${since}
      GROUP BY s.id, c.name, car.name
      ORDER BY s.created_at DESC LIMIT 50
    `,
    // Top vendors by inbound weight
    sql`
      SELECT v.name AS vendor_name,
        COUNT(s.id)::int AS shipment_count,
        COALESCE(SUM(we.total_net), 0)::float AS total_weight
      FROM ops_inbound_shipments s
      JOIN ops_vendors v ON v.id = s.vendor_id
      LEFT JOIN (
        SELECT inbound_shipment_id, SUM(COALESCE(net_weight, gross_weight)) AS total_net
        FROM ops_weight_entries GROUP BY inbound_shipment_id
      ) we ON we.inbound_shipment_id = s.id
      WHERE s.tenant_id = ${tid} AND s.created_at >= ${since}
      GROUP BY v.name ORDER BY total_weight DESC LIMIT 10
    `,
    // Top customers by outbound weight
    sql`
      SELECT c.name AS customer_name,
        COUNT(s.id)::int AS shipment_count,
        COALESCE(SUM(s.total_weight), 0)::float AS total_weight
      FROM ops_outbound_shipments s
      JOIN ops_customers c ON c.id = s.customer_id
      WHERE s.tenant_id = ${tid} AND s.created_at >= ${since} AND s.status = 'shipped'
      GROUP BY c.name ORDER BY total_weight DESC LIMIT 10
    `,
  ]);

  return NextResponse.json({
    inbound: inbound.rows,
    outbound: outbound.rows,
    byVendor: byVendor.rows,
    byCustomer: byCustomer.rows,
  });
}
