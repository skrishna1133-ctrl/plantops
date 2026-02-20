import { NextRequest, NextResponse } from "next/server";
import { dbTemplates, dbSubmissions, dbUsers } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { v4 as uuidv4 } from "uuid";
import type { ChecklistSubmission, ItemResponse } from "@/lib/schemas";

function generateSubmissionId(): string {
  const prefix = "CHK";
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${date}-${random}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "admin", "owner"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const shift = searchParams.get("shift") || undefined;

    let effectiveTenantId = auth.payload.tenantId;
    if (auth.payload.role === "super_admin") {
      const viewAs = searchParams.get("viewAs");
      if (viewAs) effectiveTenantId = viewAs;
    }

    const submissions = await dbSubmissions.getAll(effectiveTenantId, { type, shift });
    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, ["worker", "admin", "owner"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.payload.tenantId;

  try {
    const user = await dbUsers.getById(auth.payload.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { templateId, shift, responses, notes } = body;

    if (!templateId) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }
    if (!shift || !["day", "night"].includes(shift)) {
      return NextResponse.json({ error: "Shift must be day or night" }, { status: 400 });
    }
    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json({ error: "Responses are required" }, { status: 400 });
    }

    const template = await dbTemplates.getById(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const enrichedResponses = (responses as ItemResponse[]).map((r) => {
      const templateItem = template.items.find((i) => i.id === r.itemId);
      if (templateItem && templateItem.type === "numeric") {
        return {
          ...r,
          numericMin: templateItem.numericMin,
          numericMax: templateItem.numericMax,
          numericUnit: templateItem.unit,
        };
      }
      return r;
    });

    const submission: ChecklistSubmission = {
      id: uuidv4(),
      submissionId: generateSubmissionId(),
      templateId,
      templateTitle: template.title,
      templateType: template.type,
      personName: user.fullName,
      shift,
      responses: enrichedResponses,
      notes: notes || undefined,
      submittedAt: new Date().toISOString(),
    };

    await dbSubmissions.create(submission, tenantId);

    return NextResponse.json(
      { submissionId: submission.submissionId, id: submission.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
