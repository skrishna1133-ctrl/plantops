import { NextRequest, NextResponse } from "next/server";
import { incidentReportSchema } from "@/lib/schemas";
import { v4 as uuidv4 } from "uuid";

function generateTicketId(): string {
  const prefix = "INC";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

// In-memory store for development (will be replaced with Vercel Postgres)
const incidents: Array<Record<string, unknown>> = [];

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

    // Validate input
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
      // For now, we'll store a placeholder. In production, upload to Vercel Blob or S3.
      photoUrl = `photo_${Date.now()}_${photo.name}`;
    }

    const incident = {
      id: uuidv4(),
      ticketId: generateTicketId(),
      ...parsed.data,
      photoUrl,
      status: "open" as const,
      createdAt: new Date().toISOString(),
    };

    // Store in memory for now (replace with DB insert later)
    incidents.push(incident);
    console.log("New incident reported:", incident);

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

export async function GET() {
  return NextResponse.json(incidents);
}
