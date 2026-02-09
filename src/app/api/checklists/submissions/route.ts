import { NextRequest, NextResponse } from "next/server";
import { checklistTemplates, checklistSubmissions } from "@/lib/store";
import { v4 as uuidv4 } from "uuid";
import type { ChecklistSubmission } from "@/lib/schemas";

function generateSubmissionId(): string {
  const prefix = "CHK";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const shift = searchParams.get("shift");

  let filtered = [...checklistSubmissions];
  if (type) filtered = filtered.filter((s) => s.templateType === type);
  if (shift) filtered = filtered.filter((s) => s.shift === shift);

  return NextResponse.json(filtered.reverse());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, personName, shift, responses, notes } = body;

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }
    if (!personName || personName.length < 2) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }
    if (!shift || !["day", "night"].includes(shift)) {
      return NextResponse.json({ error: "Shift must be day or night" }, { status: 400 });
    }
    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json({ error: "Responses are required" }, { status: 400 });
    }

    const template = checklistTemplates.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const submission: ChecklistSubmission = {
      id: uuidv4(),
      submissionId: generateSubmissionId(),
      templateId,
      templateTitle: template.title,
      templateType: template.type,
      personName,
      shift,
      responses,
      notes: notes || undefined,
      submittedAt: new Date().toISOString(),
    };

    checklistSubmissions.push(submission);

    return NextResponse.json(
      { submissionId: submission.submissionId, id: submission.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
