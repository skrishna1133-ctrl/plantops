/**
 * Auth helpers — create signed session cookies for any role.
 * Uses the real createSessionToken from src/lib/auth.ts
 * so tests exercise the actual auth pathway.
 */
import { createSessionToken } from "@/lib/auth";
import type { UserRole } from "@/lib/schemas";

// Valid hex UUIDs — PostgreSQL UUID type requires hex-only characters.
export const TEST_TENANT_ID  = "00000000-0000-0000-0000-000000000001";
export const OTHER_TENANT_ID = "00000000-0000-0000-0000-000000000002";

/** Map from role name → seeded user ID (matches scripts/seed-test.ts) */
export const TEST_USER_IDS: Record<string, string> = {
  worker:              "00000000-0000-0000-0000-000000000011",
  quality_tech:        "00000000-0000-0000-0000-000000000012",
  quality_manager:     "00000000-0000-0000-0000-000000000013",
  engineer:            "00000000-0000-0000-0000-000000000014",
  shipping:            "00000000-0000-0000-0000-000000000015",
  receiving:           "00000000-0000-0000-0000-000000000016",
  maintenance_tech:    "00000000-0000-0000-0000-000000000017",
  maintenance_manager: "00000000-0000-0000-0000-000000000018",
  admin:               "00000000-0000-0000-0000-000000000019",
  owner:               "00000000-0000-0000-0000-00000000001a",
  super_admin:         "00000000-0000-0000-0000-00000000001b",
  inactive:            "00000000-0000-0000-0000-00000000001c",
};

/** Other-tenant admin user ID (for isolation tests). */
export const OTHER_TENANT_USER_ID = "00000000-0000-0000-0000-000000000099";

/**
 * Returns a signed session cookie string for the given role.
 * tenantId is null for super_admin, TEST_TENANT_ID for all others.
 */
export async function cookieFor(role: UserRole | "inactive"): Promise<string> {
  const userId = TEST_USER_IDS[role];
  const tenantId = role === "super_admin" ? null : TEST_TENANT_ID;
  const token = await createSessionToken({
    userId,
    role: role as UserRole,
    tenantId,
  });
  return `plantops_session=${token}`;
}

/** Cookie for a user in the OTHER tenant (for isolation tests). */
export async function cookieForOtherTenant(role: UserRole = "admin"): Promise<string> {
  const token = await createSessionToken({
    userId: OTHER_TENANT_USER_ID,
    role,
    tenantId: OTHER_TENANT_ID,
  });
  return `plantops_session=${token}`;
}
