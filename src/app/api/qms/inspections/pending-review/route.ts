import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsInspections } from "@/lib/db-qms";
import { initDb } from "@/lib/db";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();
  const data = await dbQmsInspections.getPendingReview(auth.payload.tenantId!);
  return NextResponse.json(data);
}
