"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Download, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CoaResult {
  parameterName: string;
  unit?: string;
  value: string;
  numericValue?: number;
  isWithinSpec?: boolean;
  isFlagged?: boolean;
  minValue?: number;
  maxValue?: number;
}

interface CoaDetail {
  id: string;
  coa_number: string;
  lot_number: string;
  customer_name?: string;
  customer_po_number?: string;
  material_type?: string;
  issued_at: string;
  generated_by_name?: string;
  pdf_url?: string;
  inspection_summary?: {
    overallResult?: string;
    results?: CoaResult[];
  };
}

export default function CoaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [coa, setCoa] = useState<CoaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(p => {
      return Promise.all([
        fetch("/api/auth").then(r => r.json()),
        fetch(`/api/qms/coas/${p.id}`).then(r => r.json()),
      ]);
    }).then(([auth, d]) => {
      if (!auth.authenticated) { router.push("/login"); return; }
      setCoa(d);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!coa) return null;

  const results = coa.inspection_summary?.results || [];
  const overallResult = coa.inspection_summary?.overallResult;

  const specRange = (r: CoaResult) => {
    if (r.minValue != null && r.maxValue != null) return `${r.minValue} – ${r.maxValue}`;
    if (r.minValue != null) return `≥ ${r.minValue}`;
    if (r.maxValue != null) return `≤ ${r.maxValue}`;
    return "—";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality/coa"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <div className="flex-1">
            <h1 className="font-mono font-bold">{coa.coa_number}</h1>
            <p className="text-xs text-muted-foreground">Lot {coa.lot_number}</p>
          </div>
          <a href={`/api/qms/coas/${coa.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <Download size={14} className="mr-1" /> Download PDF
            </Button>
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Lot Info */}
        <Card>
          <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Lot Number: </span><span className="font-mono font-semibold">{coa.lot_number}</span></div>
            <div><span className="text-muted-foreground">Material: </span>{coa.material_type || "—"}</div>
            <div><span className="text-muted-foreground">Customer: </span>{coa.customer_name || "—"}</div>
            <div><span className="text-muted-foreground">Customer PO: </span>{coa.customer_po_number || "—"}</div>
            <div><span className="text-muted-foreground">Issued: </span>{new Date(coa.issued_at).toLocaleDateString()}</div>
            <div><span className="text-muted-foreground">By: </span>{coa.generated_by_name || "—"}</div>
          </CardContent>
        </Card>

        {/* Determination */}
        {overallResult && (
          <Card className={overallResult === "PASS" ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"}>
            <CardContent className="p-4 flex items-center gap-3">
              {overallResult === "PASS"
                ? <CheckCircle2 size={24} className="text-green-500" />
                : <XCircle size={24} className="text-red-500" />
              }
              <div>
                <p className="font-semibold">DETERMINATION: {overallResult === "PASS" ? "APPROVED" : "NON-CONFORMING"}</p>
                <p className="text-xs text-muted-foreground">
                  {overallResult === "PASS" ? "Meets all specifications" : "Does not meet all specifications"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results Table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Test Results</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Parameter</th>
                    <th className="text-left px-4 py-2 font-medium">Unit</th>
                    <th className="text-right px-4 py-2 font-medium">Result</th>
                    <th className="text-right px-4 py-2 font-medium">Specification</th>
                    <th className="text-center px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className={`border-b border-border/50 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <td className="px-4 py-2 font-medium">{r.parameterName}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.unit || "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.value}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{specRange(r)}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={`text-xs ${r.isFlagged ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                          {r.isFlagged ? "FAIL" : "PASS"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-muted-foreground">No results recorded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
