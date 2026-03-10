/**
 * Integration tests for Maintenance Work Orders API.
 * Route: /api/maintenance/work-orders
 */
import { describe, it, expect, beforeAll } from "vitest";
import { IDS, seedTestData, cleanTestData } from "../../helpers/seed-ids";
import { reqAs, expectStatus } from "../../helpers/request";

const { GET, POST } = await import("@/app/api/maintenance/work-orders/route");
const { GET: GET_ID, PATCH } = await import("@/app/api/maintenance/work-orders/[id]/route");

beforeAll(async () => {
  await cleanTestData();
  await seedTestData();
}, 60_000);

describe("GET /api/maintenance/work-orders", () => {
  it("returns seeded work order for maintenance_manager", async () => {
    const req = await reqAs("maintenance_manager", "/api/maintenance/work-orders");
    const res = await GET(req);
    const body = await expectStatus<{ id: string; work_order_number?: string }[]>(res, 200);
    expect(Array.isArray(body)).toBe(true);
    const ids = body.map(w => w.id);
    expect(ids).toContain(IDS.CMMS_WORK_ORDER);
  });

  it("maintenance_tech only sees their own work orders", async () => {
    const req = await reqAs("maintenance_tech", "/api/maintenance/work-orders");
    const res = await GET(req);
    const body = await expectStatus<{ id: string; assignedToId?: string }[]>(res, 200);
    // The seeded WO is assigned to USER_MTECH
    const own = body.filter(w => w.assignedToId === IDS.USER_MTECH);
    expect(body.every(w => w.assignedToId === IDS.USER_MTECH)).toBe(true);
  });

  it("filters by status", async () => {
    const req = await reqAs("maintenance_manager", "/api/maintenance/work-orders", {
      searchParams: { status: "open" },
    });
    const res = await GET(req);
    const body = await expectStatus<{ status: string }[]>(res, 200);
    expect(body.every(w => w.status === "open")).toBe(true);
  });

  it("returns 403 for quality_tech (not a maintenance role)", async () => {
    const req = await reqAs("quality_tech", "/api/maintenance/work-orders");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated request", async () => {
    const req = await reqAs(null, "/api/maintenance/work-orders");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/maintenance/work-orders", () => {
  it("creates a work order as maintenance_manager", async () => {
    const req = await reqAs("maintenance_manager", "/api/maintenance/work-orders", {
      method: "POST",
      body: {
        machineId: IDS.CMMS_MACHINE,
        type: "corrective",
        description: "Test WO created in integration test",
        assignedToId: IDS.USER_MTECH,
      },
    });
    const res = await POST(req);
    const body = await expectStatus<{ id: string; workOrderNumber: string }>(res, 201);
    expect(body.id).toBeTruthy();
    expect(body.workOrderNumber).toBeTruthy();
  });

  it("returns 400 for missing required fields", async () => {
    const req = await reqAs("maintenance_manager", "/api/maintenance/work-orders", {
      method: "POST",
      body: { machineId: IDS.CMMS_MACHINE }, // missing description + type
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 for maintenance_tech (cannot create WOs)", async () => {
    const req = await reqAs("maintenance_tech", "/api/maintenance/work-orders", {
      method: "POST",
      body: {
        machineId: IDS.CMMS_MACHINE,
        type: "corrective",
        description: "Should fail",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/maintenance/work-orders/[id]", () => {
  it("returns work order details", async () => {
    const req = await reqAs("maintenance_manager", `/api/maintenance/work-orders/${IDS.CMMS_WORK_ORDER}`);
    const res = await GET_ID(req, { params: Promise.resolve({ id: IDS.CMMS_WORK_ORDER }) });
    const body = await expectStatus<{ id: string; type: string; status: string }>(res, 200);
    expect(body.id).toBe(IDS.CMMS_WORK_ORDER);
    expect(body.type).toBe("corrective");
    expect(body.status).toBe("open");
  });

  it("returns 404 for non-existent work order", async () => {
    const fakeId = "00000000-0000-0000-0000-eeeeeeeeeeee";
    const req = await reqAs("maintenance_manager", `/api/maintenance/work-orders/${fakeId}`);
    const res = await GET_ID(req, { params: Promise.resolve({ id: fakeId }) });
    expect(res.status).toBe(404);
  });
});
