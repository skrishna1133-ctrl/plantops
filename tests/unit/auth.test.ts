/**
 * Unit tests for src/lib/auth.ts
 * Tests session token creation/verification and password hashing.
 * No database calls — pure crypto.
 */
import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a normal tenant payload", async () => {
    const payload = { userId: "user-1", role: "admin" as const, tenantId: "tenant-1" };
    const token = await createSessionToken(payload);
    const result = await verifySessionToken(token);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-1");
    expect(result!.role).toBe("admin");
    expect(result!.tenantId).toBe("tenant-1");
  });

  it("round-trips a super_admin payload (null tenantId)", async () => {
    const payload = { userId: "sa-1", role: "super_admin" as const, tenantId: null };
    const token = await createSessionToken(payload);
    const result = await verifySessionToken(token);
    expect(result).not.toBeNull();
    expect(result!.tenantId).toBeNull();
    expect(result!.role).toBe("super_admin");
  });

  it("returns null for a tampered token", async () => {
    const token = await createSessionToken({ userId: "u1", role: "worker" as const, tenantId: "t1" });
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("returns null for garbage input", async () => {
    expect(await verifySessionToken("not.a.token")).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("abc")).toBeNull();
  });

  it("returns null for token with no signature part", async () => {
    expect(await verifySessionToken("dGVzdA==")).toBeNull(); // no "." separator
  });
});

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correctPassword");
    expect(await verifyPassword("correctPassword", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correctPassword");
    expect(await verifyPassword("wrongPassword", hash)).toBe(false);
  });

  it("produces different hashes for the same password (salt randomness)", async () => {
    const h1 = await hashPassword("samePassword");
    const h2 = await hashPassword("samePassword");
    expect(h1).not.toBe(h2); // different salts
    // But both should verify
    expect(await verifyPassword("samePassword", h1)).toBe(true);
    expect(await verifyPassword("samePassword", h2)).toBe(true);
  });

  it("hash has salt:hash format", async () => {
    const hash = await hashPassword("test");
    expect(hash).toContain(":");
    const parts = hash.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(32); // 16 bytes hex
    expect(parts[1]).toHaveLength(64); // 32 bytes hex
  });
});
