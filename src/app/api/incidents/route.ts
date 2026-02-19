import { NextRequest, NextResponse } from "next/server";
import { incidentReportSchema } from "@/lib/schemas";
import { dbIncidents } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { v4 as uuidv4 } from "uuid";

function generateTicketId(): string {
  const prefix = "INC";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "quality_tech", "engineer", "shipping", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

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

    await dbIncidents.create(incident, tenantId);

    return NextResponse.json(
      { ticketId: incident.ticketId, id: incident.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating incident:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const sorted = await dbIncidents.getAll(tenantId);
    return NextResponse.json(sorted);
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
