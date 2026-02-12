import { NextRequest, NextResponse } from "next/server";
import { incidentReportSchema } from "@/lib/schemas";
import { dbIncidents } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { verifySessionToken } from "@/lib/auth";

function generateTicketId(): string {
  const prefix = "INC";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const data = {
      reporterName: formData.get("reporterName") as string,
      plant: formData.get("plant") as string,
      category: formData.get("category") as string,
      description: formData.get("description") as string,
      criticality: formData.get("criticality") as string,
      incidentDate: formData.get("incidentDate") as string,
    };

    const parsed = incidentReportSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const photo = formData.get("photo") as File | null;
    let photoUrl: string | undefined;

    if (photo && photo.size > 0) {
      const bytes = await photo.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      photoUrl = `data:${photo.type};base64,${base64}`;
    }

    const incident = {
      id: uuidv4(),
      ticketId: generateTicketId(),
      ...parsed.data,
      photoUrl,
      status: "open" as const,
      createdAt: new Date().toISOString(),
    };

    await dbIncidents.create(incident);

    return NextResponse.json(
      { ticketId: incident.ticketId, id: incident.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating incident:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const sessionCookie = request.cookies.get("plantops_session");
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - only admin or owner can view all incidents
    if (!["admin", "owner"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sorted = await dbIncidents.getAll();
    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
