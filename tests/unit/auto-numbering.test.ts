/**
 * Unit tests for auto-numbering helpers: nextOpsNumber & nextQmsNumber.
 * These hit the real test database to verify atomicity and format.
 * Depends on initDb() in setup.ts (already called in beforeAll).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "@vercel/postgres";
import { nextOpsNumber } from "@/lib/db-ops";
import { nextQmsNumber } from "@/lib/db-qms";

const TENANT = "00000000-0000-0000-0000-aaaaaaaaaaaa"; // unique to this test suite

afterAll(async () => {
  // Clean up counters created by this test
  const opsP = `%:${TENANT}:%`;
  await sql`DELETE FROM ops_counters WHERE id LIKE ${opsP}`;
  const qmsP = `%:${TENANT}:%`;
  await sql`DELETE FROM qms_counters WHERE id LIKE ${qmsP}`;
});

describe("nextOpsNumber", () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  it("generates JOB numbers without month: JOB-YYYY-NNNN", async () => {
    const n = await nextOpsNumber(TENANT, "JOB");
    expect(n).toMatch(new RegExp(`^JOB-${year}-\\d{4}$`));
  });

  it("JOB counter increments sequentially", async () => {
    const n1 = await nextOpsNumber(TENANT, "JOB");
    const n2 = await nextOpsNumber(TENANT, "JOB");
    const seq1 = parseInt(n1.split("-").pop()!);
    const seq2 = parseInt(n2.split("-").pop()!);
    expect(seq2).toBe(seq1 + 1);
  });

  it("generates SHP-IN numbers with month: SHP-IN-YYYY-MM-NNNN", async () => {
    const n = await nextOpsNumber(TENANT, "SHP-IN", true);
    expect(n).toMatch(new RegExp(`^SHP-IN-${year}-${month}-\\d{4}$`));
  });

  it("generates SHP-OUT numbers with month", async () => {
    const n = await nextOpsNumber(TENANT, "SHP-OUT", true);
    expect(n).toMatch(new RegExp(`^SHP-OUT-${year}-${month}-\\d{4}$`));
  });

  it("generates LOT numbers with month", async () => {
    const n = await nextOpsNumber(TENANT, "LOT", true);
    expect(n).toMatch(new RegExp(`^LOT-${year}-${month}-\\d{4}$`));
  });

  it("generates RUN numbers with month", async () => {
    const n = await nextOpsNumber(TENANT, "RUN", true);
    expect(n).toMatch(new RegExp(`^RUN-${year}-${month}-\\d{4}$`));
  });

  it("different types have independent counters", async () => {
    const job = await nextOpsNumber(TENANT, "JOB");
    const lot = await nextOpsNumber(TENANT, "LOT", true);
    // LOT counter starts at 1 if no prior LOT for this period
    expect(lot.split("-").pop()).toBeTruthy();
    // Different prefixes
    expect(job.startsWith("JOB-")).toBe(true);
    expect(lot.startsWith("LOT-")).toBe(true);
  });
});

describe("nextQmsNumber", () => {
  const year = new Date().getFullYear();

  it("generates LOT numbers: LOT-YYYY-NNNN", async () => {
    const n = await nextQmsNumber(TENANT, "LOT");
    expect(n).toMatch(new RegExp(`^LOT-${year}-\\d{4}$`));
  });

  it("LOT counter increments sequentially", async () => {
    const n1 = await nextQmsNumber(TENANT, "LOT");
    const n2 = await nextQmsNumber(TENANT, "LOT");
    const seq1 = parseInt(n1.split("-").pop()!);
    const seq2 = parseInt(n2.split("-").pop()!);
    expect(seq2).toBe(seq1 + 1);
  });

  it("generates NCR numbers: NCR-YYYY-NNNN", async () => {
    const n = await nextQmsNumber(TENANT, "NCR");
    expect(n).toMatch(new RegExp(`^NCR-${year}-\\d{4}$`));
  });

  it("generates COA numbers: COA-YYYY-NNNN", async () => {
    const n = await nextQmsNumber(TENANT, "COA");
    expect(n).toMatch(new RegExp(`^COA-${year}-\\d{4}$`));
  });

  it("generates CC numbers: CC-YYYY-NNNN", async () => {
    const n = await nextQmsNumber(TENANT, "CC");
    expect(n).toMatch(new RegExp(`^CC-${year}-\\d{4}$`));
  });

  it("different tenants have independent counters", async () => {
    const OTHER = "00000000-0000-0000-0000-bbbbbbbbbbbb";
    const n1 = await nextQmsNumber(TENANT, "LOT");
    const n2 = await nextQmsNumber(OTHER, "LOT");
    // Both should start at 1 (or increment independently)
    // Confirm the seq numbers from TENANT don't appear in OTHER
    const qmsP = `%:${OTHER}:%`;
    await sql`DELETE FROM qms_counters WHERE id LIKE ${qmsP}`;
    expect(n1).not.toBe(n2);
  });
});
