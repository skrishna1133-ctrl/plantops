import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pass = "";
  for (let i = 0; i < 8; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, []);
  if (!auth.ok) return auth.response;

  // Only super_admin can reset any user's password
  if (auth.payload.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const user = await dbUsers.getById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await dbUsers.update(userId, { passwordHash }, null);

    return NextResponse.json({ tempPassword });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
