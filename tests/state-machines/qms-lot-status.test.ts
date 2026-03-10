/**
 * State machine tests for QMS Lot status transitions.
 *
 * Transition map (from route):
 *   pending_qc      → on_hold
 *   qc_in_progress  → approved, rejected, on_hold
 *   on_hold         → approved, rejected, qc_in_progress
 *   approved        → shipped
 *
 * Each test uses a fresh lot so state is predictable.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "@vercel/postgres";
import { IDS, seedTestData, cleanTestData } from "../helpers/seed-ids";
import { reqAs, expectStatus } from "../helpers/request";

const { PATCH: PATCH_STATUS } = await import("@/app/api/qms/lots/[id]/status/route");
const { POST: CREATE_LOT }    = await import("@/app/api/qms/lots/route");

const T = IDS.TEST_TENANT;

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

/** Create a fresh lot at a given status for isolated state tests. */
async function createLotWithStatus(status: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO qms_lots (id, tenant_id, lot_number, status, created_by_id, created_at, updated_at)
    VALUES (${id}, ${T}, ${'TST-SM-' + id.slice(0, 8)}, ${status}, ${IDS.USER_QMANAGER}, ${now}, ${now})
  `;
  return id;
}

async function transition(lotId: string, toStatus: string) {
  const req = await reqAs("quality_manager", `/api/qms/lots/${lotId}/status`, {
    method: "PATCH",
    body: { status: toStatus },
  });
  return PATCH_STATUS(req, { params: Promise.resolve({ id: lotId }) });
}

// ── Valid transitions ────────────────────────────────────────────────────────

describe("valid transitions", () => {
  it("pending_qc → on_hold", async () => {
    const id = await createLotWithStatus("pending_qc");
    const res = await transition(id, "on_hold");
    const body = await expectStatus<{ status: string }>(res, 200);
    expect(body.status).toBe("on_hold");
  });

  it("qc_in_progress → approved", async () => {
    const id = await createLotWithStatus("qc_in_progress");
    const res = await transition(id, "approved");
    await expectStatus(res, 200);
  });

  it("qc_in_progress → rejected", async () => {
    const id = await createLotWithStatus("qc_in_progress");
    const res = await transition(id, "rejected");
    await expectStatus(res, 200);
  });

  it("qc_in_progress → on_hold", async () => {
    const id = await createLotWithStatus("qc_in_progress");
    const res = await transition(id, "on_hold");
    await expectStatus(res, 200);
  });

  it("on_hold → qc_in_progress", async () => {
    const id = await createLotWithStatus("on_hold");
    const res = await transition(id, "qc_in_progress");
    await expectStatus(res, 200);
  });

  it("on_hold → approved", async () => {
    const id = await createLotWithStatus("on_hold");
    const res = await transition(id, "approved");
    await expectStatus(res, 200);
  });

  it("approved → shipped", async () => {
    const id = await createLotWithStatus("approved");
    const res = await transition(id, "shipped");
    await expectStatus(res, 200);
  });
});

// ── Invalid transitions ──────────────────────────────────────────────────────

describe("invalid (forbidden) transitions", () => {
  it("pending_qc → approved is not allowed", async () => {
    const id = await createLotWithStatus("pending_qc");
    const res = await transition(id, "approved");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Cannot transition/);
  });

  it("pending_qc → shipped is not allowed", async () => {
    const id = await createLotWithStatus("pending_qc");
    const res = await transition(id, "shipped");
    expect(res.status).toBe(400);
  });

  it("approved → qc_in_progress is not allowed", async () => {
    const id = await createLotWithStatus("approved");
    const res = await transition(id, "qc_in_progress");
    expect(res.status).toBe(400);
  });

  it("rejected → any transition is not allowed", async () => {
    const id = await createLotWithStatus("rejected");
    for (const s of ["approved", "qc_in_progress", "on_hold", "shipped"]) {
      const res = await transition(id, s);
      expect(res.status, `rejected → ${s}`).toBe(400);
    }
  });

  it("shipped → any transition is not allowed", async () => {
    const id = await createLotWithStatus("shipped");
    for (const s of ["approved", "qc_in_progress", "on_hold"]) {
      const res = await transition(id, s);
      expect(res.status, `shipped → ${s}`).toBe(400);
    }
  });
});

// ── Role enforcement on transitions ─────────────────────────────────────────

describe("role enforcement on status transitions", () => {
  it("quality_tech cannot change status (only quality_manager/admin/owner)", async () => {
    const id = await createLotWithStatus("qc_in_progress");
    const req = await reqAs("quality_tech", `/api/qms/lots/${id}/status`, {
      method: "PATCH",
      body: { status: "approved" },
    });
    const res = await PATCH_STATUS(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(403);
  });

  it("admin can change status", async () => {
    const id = await createLotWithStatus("qc_in_progress");
    const req = await reqAs("admin", `/api/qms/lots/${id}/status`, {
      method: "PATCH",
      body: { status: "approved" },
    });
    const res = await PATCH_STATUS(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
  });
});
