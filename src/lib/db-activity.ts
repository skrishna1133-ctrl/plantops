import { sql } from "@vercel/postgres";

let activityTableInitialized = false;

export async function initActivityTable(): Promise<void> {
  if (activityTableInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      user_id UUID NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      details JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant
    ON activity_logs(tenant_id, created_at DESC)
  `;
  activityTableInitialized = true;
}

export interface ActivityLogEntry {
  id: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  userId: string;
}

export async function logActivity(params: {
  tenantId: string | null;
  userId: string;
  role: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  if (!params.tenantId) return; // skip super_admin cross-tenant actions
  await initActivityTable();
  await sql`
    INSERT INTO activity_logs (tenant_id, user_id, role, action, entity_type, entity_id, entity_name, details)
    VALUES (
      ${params.tenantId}::uuid,
      ${params.userId}::uuid,
      ${params.role},
      ${params.action},
      ${params.entityType},
      ${params.entityId ?? null},
      ${params.entityName ?? null},
      ${params.details ? JSON.stringify(params.details) : null}
    )
  `;
}

export async function getActivityLog(
  tenantId: string,
  filters?: { entityType?: string; userId?: string }
): Promise<ActivityLogEntry[]> {
  await initActivityTable();

  // Purge records older than 7 days for this tenant
  await sql`
    DELETE FROM activity_logs
    WHERE tenant_id = ${tenantId}::uuid
      AND created_at < NOW() - INTERVAL '7 days'
  `;

  const entityType = filters?.entityType ?? null;
  const userId = filters?.userId ?? null;

  const { rows } = await sql`
    SELECT
      al.id,
      al.user_id,
      al.role,
      al.action,
      al.entity_type,
      al.entity_id,
      al.entity_name,
      al.details,
      al.created_at,
      u.full_name as user_name
    FROM activity_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.tenant_id = ${tenantId}::uuid
      AND (${entityType}::text IS NULL OR al.entity_type = ${entityType})
      AND (${userId}::text IS NULL OR al.user_id::text = ${userId})
    ORDER BY al.created_at DESC
    LIMIT 300
  `;

  return rows.map(r => ({
    id: r.id as string,
    userId: r.user_id as string,
    role: r.role as string,
    action: r.action as string,
    entityType: r.entity_type as string,
    entityId: (r.entity_id as string) || null,
    entityName: (r.entity_name as string) || null,
    details: r.details as Record<string, unknown> | null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at as string),
    userName: (r.user_name as string) || null,
  }));
}
