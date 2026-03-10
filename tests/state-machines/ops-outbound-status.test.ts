/**
 * State machine tests for OPS Outbound Shipment status transitions.
 *
 * Transition flow: pending → staged → shipped → delivered
 * Auto-timestamps are set on each transition.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "@vercel/postgres";
import { IDS, seedTestData, cleanTestData } from "../helpers/seed-ids";
import { reqAs, expectStatus } from "../helpers/request";

const { PATCH } = await import("@/app/api/ops/outbound-shipments/[id]/route");

const T = IDS.TEST_TENANT;

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

/** Create a fresh outbound shipment at a given status. */
async function createOutbound(status: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO ops_outbound_shipments
      (id, tenant_id, shipment_number, job_id, status, created_by_id, created_at, updated_at)
    VALUES
      (${id}, ${T}, ${'SHP-SM-' + id.slice(0, 8)}, ${IDS.OPS_JOB}, ${status}, ${IDS.USER_SHIPPING}, ${now}, ${now})
  `;
  return id;
}

async function patchStatus(id: string, status: string) {
  const req = await reqAs("shipping", `/api/ops/outbound-shipments/${id}`, {
    method: "PATCH",
    body: { status },
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

describe("valid status transitions", () => {
  it("pending → staged sets staged_date automatically", async () => {
    const id = await createOutbound("pending");
    const res = await patchStatus(id, "staged");
    expect(res.status).toBe(200);
    // Verify staged_date was set
    const row = await sql`SELECT staged_date FROM ops_outbound_shipments WHERE id = ${id}`;
    expect(row.rows[0].staged_date).toBeTruthy();
  });

  it("staged → shipped sets shipped_date automatically", async () => {
    const id = await createOutbound("staged");
    const res = await patchStatus(id, "shipped");
    expect(res.status).toBe(200);
    const row = await sql`SELECT shipped_date FROM ops_outbound_shipments WHERE id = ${id}`;
    expect(row.rows[0].shipped_date).toBeTruthy();
  });

  it("shipped → delivered sets delivered_date automatically", async () => {
    const id = await createOutbound("shipped");
    const res = await patchStatus(id, "delivered");
    expect(res.status).toBe(200);
    const row = await sql`SELECT delivered_date FROM ops_outbound_shipments WHERE id = ${id}`;
    expect(row.rows[0].delivered_date).toBeTruthy();
  });

  it("staged_date is NOT overwritten on a second staged transition", async () => {
    const id = await createOutbound("pending");
    // First transition — sets staged_date
    await patchStatus(id, "staged");
    const { rows: [{ staged_date: first }] } = await sql`SELECT staged_date FROM ops_outbound_shipments WHERE id = ${id}`;

    // Patch again with staged (idempotent)
    await patchStatus(id, "staged");
    const { rows: [{ staged_date: second }] } = await sql`SELECT staged_date FROM ops_outbound_shipments WHERE id = ${id}`;
    expect(first).toBe(second); // unchanged
  });
});

describe("role enforcement", () => {
  it("worker cannot update outbound shipment status", async () => {
    const id = await createOutbound("pending");
    const req = await reqAs("worker", `/api/ops/outbound-shipments/${id}`, {
      method: "PATCH",
      body: { status: "staged" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(403);
  });

  it("admin can update outbound shipment status", async () => {
    const id = await createOutbound("pending");
    const req = await reqAs("admin", `/api/ops/outbound-shipments/${id}`, {
      method: "PATCH",
      body: { status: "staged" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
  });
});
