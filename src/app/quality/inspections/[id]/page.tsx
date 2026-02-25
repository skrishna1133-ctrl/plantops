"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Camera, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface TemplateItem {
  parameter_id: string;
  parameter_name: string;
  parameter_type: string;
  unit?: string;
  min_value?: number;
  max_value?: number;
  is_required: boolean;
  instructions?: string;
}

interface ResultEntry {
  parameterId: string;
  value: string;
  notes?: string;
}

export default function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [inspection, setInspection] = useState<Record<string, unknown> | null>(null);
  const [template, setTemplate] = useState<Record<string, unknown> | null>(null);
  const [results, setResults] = useState<Record<string, ResultEntry>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [submitResult, setSubmitResult] = useState<{ overallResult: string; flaggedCount: number } | null>(null);

  useEffect(() => {
    params.then(p => {
      setId(p.id);
      return Promise.all([
        fetch("/api/auth").then(r => r.json()),
        fetch(`/api/qms/inspections/${p.id}`).then(r => r.json()),
      ]);
    }).then(async ([auth, insp]) => {
      if (!auth.authenticated) { router.push("/login"); return; }
      setRole(auth.role);
      if (insp.error) { router.push("/quality/lots"); return; }
      setInspection(insp);

      // Load template
      if (insp.template_id) {
        const tmpl = await fetch(`/api/qms/templates/${insp.template_id}`).then(r => r.json());
        setTemplate(tmpl);
      }

      // Pre-fill results
      const existingResults: Record<string, ResultEntry> = {};
      for (const r of (insp.results || []) as Array<{ parameter_id: string; value: string; notes?: string }>) {
        existingResults[r.parameter_id] = { parameterId: r.parameter_id, value: r.value || "", notes: r.notes };
      }
      setResults(existingResults);
    }).finally(() => setLoading(false));
  }, []);

  const isManager = ["quality_manager", "admin", "owner"].includes(role);
  const isDraft = inspection?.status === "draft";
  const isSubmitted = inspection?.status === "submitted";

  const setResultValue = (parameterId: string, value: string) => {
    setResults(prev => ({ ...prev, [parameterId]: { ...prev[parameterId], parameterId, value } }));
  };

  const isOutOfSpec = (item: TemplateItem, value: string): boolean => {
    if (!value) return false;
    if (item.parameter_type === "pass_fail") return value.toUpperCase() === "FAIL";
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (item.min_value != null && num < item.min_value) return true;
    if (item.max_value != null && num > item.max_value) return true;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const resultList = Object.values(results).map(r => ({
      parameterId: r.parameterId,
      value: r.value,
      notes: r.notes,
    }));
    const res = await fetch(`/api/qms/inspections/${id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: resultList }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubmitResult(data);
      const updated = await fetch(`/api/qms/inspections/${id}`).then(r => r.json());
      setInspection(updated);
    }
    setSubmitting(false);
  };

  const handleReview = async () => {
    const endpoint = `/api/qms/inspections/${id}/${reviewAction}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNotes }),
    });
    if (res.ok) {
      const data = await res.json();
      setReviewDialogOpen(false);
      router.push(`/quality/lots/${inspection?.lot_id}`);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!inspection) return null;

  const items = ((template as { items?: TemplateItem[] } | null)?.items || []) as TemplateItem[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/quality/lots/${inspection.lot_id as string}`}>
            <Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-bold">Inspection</h1>
            <p className="text-xs text-muted-foreground font-mono">{inspection.lot_number as string}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{inspection.status as string}</Badge>
            {!!inspection.overall_result && (
              <Badge className={`text-xs ${inspection.overall_result === "PASS" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {inspection.overall_result as string}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Submit result banner */}
        {submitResult && (
          <Card className={`border-2 ${submitResult.overallResult === "PASS" ? "border-green-500/50 bg-green-500/5" : "border-red-500/50 bg-red-500/5"}`}>
            <CardContent className="p-4 flex items-center gap-3">
              {submitResult.overallResult === "PASS"
                ? <CheckCircle2 size={24} className="text-green-500" />
                : <XCircle size={24} className="text-red-500" />
              }
              <div>
                <p className="font-semibold">{submitResult.overallResult === "PASS" ? "Inspection PASSED" : "Inspection FAILED"}</p>
                {submitResult.flaggedCount > 0 && (
                  <p className="text-sm text-muted-foreground">{submitResult.flaggedCount} parameter{submitResult.flaggedCount !== 1 ? "s" : ""} out of spec</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">Submitted for quality manager review.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manager review actions */}
        {isManager && isSubmitted && !submitResult && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Awaiting your review</p>
                <p className="text-xs text-muted-foreground">Submitted by {inspection.inspected_by_name as string}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setReviewAction("approve"); setReviewDialogOpen(true); }} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 size={14} className="mr-1" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { setReviewAction("reject"); setReviewDialogOpen(true); }}>
                  <XCircle size={14} className="mr-1" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parameter Results */}
        {isDraft ? (
          <div className="space-y-4">
            <h2 className="font-semibold">Fill Results</h2>
            {items.map((item) => {
              const current = results[item.parameter_id]?.value || "";
              const oos = isOutOfSpec(item, current);
              return (
                <Card key={item.parameter_id} className={oos ? "border-red-500/50" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Label className="text-sm font-medium">
                          {item.parameter_name}
                          {item.is_required && <span className="text-red-400 ml-1">*</span>}
                        </Label>
                        {item.instructions && <p className="text-xs text-muted-foreground mt-0.5">{item.instructions}</p>}
                        {(item.min_value != null || item.max_value != null) && (
                          <p className="text-xs text-blue-400 mt-0.5">
                            Spec: {item.min_value != null ? `≥${item.min_value}` : ""} {item.max_value != null ? `≤${item.max_value}` : ""} {item.unit || ""}
                          </p>
                        )}
                      </div>
                      {oos && <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    </div>

                    {item.parameter_type === "pass_fail" ? (
                      <div className="flex gap-2">
                        {["PASS", "FAIL"].map(v => (
                          <button
                            key={v}
                            onClick={() => setResultValue(item.parameter_id, v)}
                            className={`flex-1 py-2 rounded-md text-sm font-medium border transition-colors ${
                              current === v
                                ? v === "PASS" ? "bg-green-600 text-white border-green-600" : "bg-red-600 text-white border-red-600"
                                : "border-input hover:bg-muted/50"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Input
                        type={item.parameter_type === "numeric" || item.parameter_type === "percentage" ? "number" : "text"}
                        value={current}
                        onChange={e => setResultValue(item.parameter_id, e.target.value)}
                        placeholder={item.unit ? `Value in ${item.unit}` : "Enter value"}
                        className={oos ? "border-red-500" : ""}
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Submit Inspection
            </Button>
          </div>
        ) : (
          /* Read-only results view */
          <div className="space-y-3">
            <h2 className="font-semibold">Results</h2>
            {((inspection.results || []) as Array<{ parameter_name: string; unit?: string; value: string; is_flagged: boolean; is_within_spec?: boolean; parameter_id: string }>).map((r) => (
              <Card key={r.parameter_id} className={r.is_flagged ? "border-red-500/30" : ""}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{r.parameter_name}</p>
                    <p className="text-base font-mono">{r.value} {r.unit || ""}</p>
                  </div>
                  <Badge className={`text-xs ${r.is_flagged ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                    {r.is_flagged ? "OUT OF SPEC" : "OK"}
                  </Badge>
                </CardContent>
              </Card>
            ))}

            {!!inspection.review_notes && (
              <Card className="border-border/50">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">Review Notes</p>
                  <p className="text-sm">{inspection.review_notes as string}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{reviewAction === "approve" ? "Approve Inspection" : "Reject Inspection"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Review Notes (optional)</Label>
            <Textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder="Add notes for the quality tech..."
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleReview}
              className={reviewAction === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {reviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
