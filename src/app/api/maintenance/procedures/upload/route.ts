import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@/lib/api-auth";
import crypto from "crypto";

const MANAGER_ROLES = ["maintenance_manager", "engineer", "admin", "owner"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, [...MANAGER_ROLES]);
  if (!auth.ok) return auth.response;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });

  const blob = await put(
    `procedures/${crypto.randomUUID()}_${file.name}`,
    file,
    { access: "public" }
  );

  return NextResponse.json({ url: blob.url, filename: file.name });
}
