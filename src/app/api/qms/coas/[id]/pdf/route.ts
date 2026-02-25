import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dbQmsCoas } from "@/lib/db-qms";
import { initDb, dbUsers } from "@/lib/db";
import { put } from "@vercel/blob";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { CoaPdfDocument } from "@/lib/qms-coa-pdf";

const QM = ["quality_manager", "admin", "owner"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request, [...QM]);
  if (!auth.ok) return auth.response;
  await initDb();

  const { id } = await params;
  const tenantId = auth.payload.tenantId!;
  const coa = await dbQmsCoas.getById(id, tenantId);
  if (!coa) return NextResponse.json({ error: "COA not found" }, { status: 404 });

  const summary = coa.inspection_summary as {
    overallResult?: string;
    results?: Array<{
      parameterName: string; unit?: string; value: string; parameterType?: string;
      isWithinSpec?: boolean; isFlagged?: boolean;
      minValue?: number; maxValue?: number;
    }>;
  };

  const generatedBy = coa.generated_by_id ? await dbUsers.getById(coa.generated_by_id) : null;

  const pdfData = {
    coaNumber: coa.coa_number,
    lotNumber: coa.lot_number,
    customerName: coa.customer_name,
    customerPoNumber: coa.customer_po_number,
    materialType: coa.material_type,
    issuedAt: coa.issued_at,
    generatedByName: generatedBy?.fullName,
    overallResult: summary?.overallResult,
    results: summary?.results ?? [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(CoaPdfDocument, { data: pdfData }) as any);

  // Store in Vercel Blob if not already stored
  if (!coa.pdf_url) {
    const blob = await put(`qms/coas/${coa.coa_number}.pdf`, buffer, { access: "public", contentType: "application/pdf" });
    await dbQmsCoas.updatePdfUrl(id, blob.url);
    return NextResponse.redirect(blob.url);
  }

  // Return PDF directly
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${coa.coa_number}.pdf"`,
    },
  });
}
