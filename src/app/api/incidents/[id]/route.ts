import { NextRequest, NextResponse } from "next/server";
import { incidents } from "@/lib/store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!["open", "in_progress", "resolved"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: open, in_progress, or resolved" },
        { status: 400 }
      );
    }

    const incident = incidents.find((inc) => inc.id === id);
    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    incident.status = status;

    return NextResponse.json(incident);
  } catch (error) {
    console.error("Error updating incident:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const index = incidents.findIndex((inc) => inc.id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Incident not found" },
        { status: 404 }
      );
    }

    incidents.splice(index, 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting incident:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
