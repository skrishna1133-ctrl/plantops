/**
 * Integration tests for QMS Lots API.
 * Covers CRUD, status transitions, and role-based access.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { IDS, seedTestData, cleanTestData } from "../../helpers/seed-ids";
import { reqAs, expectStatus } from "../../helpers/request";

const { GET, POST } = await import("@/app/api/qms/lots/route");
const { GET: GET_ID, PATCH } = await import("@/app/api/qms/lots/[id]/route");

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

describe("GET /api/qms/lots", () => {
  it("returns the seeded lots for quality_tech", async () => {
    const req = await reqAs("quality_tech", "/api/qms/lots");
    const res = await GET(req);
    const body = await expectStatus<{ id: string }[]>(res, 200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(3); // 3 seeded lots
    const ids = body.map(l => l.id);
    expect(ids).toContain(IDS.QMS_LOT_PENDING);
    expect(ids).toContain(IDS.QMS_LOT_IN_PROGRESS);
    expect(ids).toContain(IDS.QMS_LOT_APPROVED);
  });

  it("filters by status", async () => {
    const req = await reqAs("quality_tech", "/api/qms/lots", {
      searchParams: { status: "pending_qc" },
    });
    const res = await GET(req);
    const body = await expectStatus<{ id: string; status: string }[]>(res, 200);
    expect(body.every(l => l.status === "pending_qc")).toBe(true);
    const ids = body.map(l => l.id);
    expect(ids).toContain(IDS.QMS_LOT_PENDING);
    expect(ids).not.toContain(IDS.QMS_LOT_APPROVED);
  });

  it("returns 401 for unauthenticated request", async () => {
    const req = await reqAs(null, "/api/qms/lots");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for worker role (no QMS access)", async () => {
    const req = await reqAs("worker", "/api/qms/lots");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/qms/lots", () => {
  it("creates a lot as quality_tech and returns id + lotNumber", async () => {
    const req = await reqAs("quality_tech", "/api/qms/lots", {
      method: "POST",
      body: {
        materialTypeId: IDS.QMS_MATERIAL_TYPE,
        inputWeightKg: 200,
        notes: "Integration test lot",
      },
    });
    const res = await POST(req);
    const body = await expectStatus<{ id: string; lotNumber: string }>(res, 201);
    expect(body.id).toBeTruthy();
    expect(body.lotNumber).toMatch(/^LOT-\d{4}-\d{4}$/);
  });

  it("creates a lot as quality_manager", async () => {
    const req = await reqAs("quality_manager", "/api/qms/lots", {
      method: "POST",
      body: { materialTypeId: IDS.QMS_MATERIAL_TYPE },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 403 for shipping role", async () => {
    const req = await reqAs("shipping", "/api/qms/lots", {
      method: "POST",
      body: { materialTypeId: IDS.QMS_MATERIAL_TYPE },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/qms/lots/[id]", () => {
  it("returns lot details", async () => {
    const req = await reqAs("quality_tech", `/api/qms/lots/${IDS.QMS_LOT_APPROVED}`);
    const res = await GET_ID(req, { params: Promise.resolve({ id: IDS.QMS_LOT_APPROVED }) });
    const body = await expectStatus<{ id: string; status: string; lotNumber: string }>(res, 200);
    expect(body.id).toBe(IDS.QMS_LOT_APPROVED);
    expect(body.status).toBe("approved");
    expect(body.lotNumber).toBe("QMS-LOT-9003");
  });

  it("returns 404 for non-existent lot", async () => {
    const fakeId = "00000000-0000-0000-0000-eeeeeeeeeeee";
    const req = await reqAs("quality_tech", `/api/qms/lots/${fakeId}`);
    const res = await GET_ID(req, { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/qms/lots/[id]", () => {
  it("updates lot notes as quality_tech", async () => {
    const req = await reqAs("quality_tech", `/api/qms/lots/${IDS.QMS_LOT_PENDING}`, {
      method: "PATCH",
      body: { notes: "Updated notes from test" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: IDS.QMS_LOT_PENDING }) });
    const body = await expectStatus<{ notes: string }>(res, 200);
    expect(body.notes).toBe("Updated notes from test");
  });

  it("returns 403 for worker role", async () => {
    const req = await reqAs("worker", `/api/qms/lots/${IDS.QMS_LOT_PENDING}`, {
      method: "PATCH",
      body: { notes: "should fail" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: IDS.QMS_LOT_PENDING }) });
    expect(res.status).toBe(403);
  });
});
