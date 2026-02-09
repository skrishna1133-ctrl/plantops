import { NextRequest, NextResponse } from "next/server";
import { checklistSubmissions } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = checklistSubmissions.findIndex((s) => s.id === id);

  if (index === -1) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  checklistSubmissions.splice(index, 1);
  return NextResponse.json({ success: true });
}
