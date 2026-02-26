"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Camera, CheckCircle2, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { computeStatistic, statisticLabel } from "@/lib/qms-statistics";
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
  formula?: string;
  parameter_code?: string;
  reading_count?: number;
  statistic?: string;
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
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [multiReadings, setMultiReadings] = useState<Record<string, string[]>>({});

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

  const getMultiStat = (parameterId: string, count: number, statistic: string): number | null => {
    const readings = multiReadings[parameterId] || [];
    const nums = readings.slice(0, count).map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    return computeStatistic(nums, statistic);
  };

  const isOutOfSpec = (item: TemplateItem, value: string): boolean => {
    if ((item.reading_count ?? 1) > 1) {
      const stat = getMultiStat(item.parameter_id, item.reading_count!, item.statistic ?? "average");
      if (stat === null) return false;
      if (item.min_value != null && stat < item.min_value) return true;
      if (item.max_value != null && stat > item.max_value) return true;
      return false;
    }
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
    // Build resultList — multi-reading params get serialized as JSON array
    const resultList = items.map(item => {
      const r = results[item.parameter_id];
      if ((item.reading_count ?? 1) > 1) {
        const nums = (multiReadings[item.parameter_id] || [])
          .slice(0, item.reading_count)
          .map(v => parseFloat(v))
          .filter(n => !isNaN(n));
        return { parameterId: item.parameter_id, value: JSON.stringify(nums), notes: r?.notes };
      }
      if (!r) return null;
      return { parameterId: r.parameterId, value: r.value, notes: r.notes };
    }).filter(Boolean) as Array<{ parameterId: string; value: string; notes?: string }>;

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, parameterId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(parameterId);
    const paramName = items.find(i => i.parameter_id === parameterId)?.parameter_name || "";
    const form = new FormData();
    form.append("photo", file);
    form.append("caption", paramName);
    const res = await fetch(`/api/qms/inspections/${id}/photos`, { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      setResultValue(parameterId, data.url);
    }
    setUploadingPhoto(null);
    e.target.value = "";
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
                    ) : item.parameter_type === "photo" ? (
                      <div className="space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          id={`photo-${item.parameter_id}`}
                          className="hidden"
                          onChange={e => handlePhotoUpload(e, item.parameter_id)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById(`photo-${item.parameter_id}`)?.click()}
                          disabled={uploadingPhoto === item.parameter_id}
                        >
                          {uploadingPhoto === item.parameter_id
                            ? <><Loader2 size={14} className="animate-spin mr-1" /> Uploading...</>
                            : <><Camera size={14} className="mr-1" /> {current ? "Change Photo" : "Take / Upload Photo"}</>
                          }
                        </Button>
                        {current && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={current} alt="Inspection photo" className="rounded-md max-h-48 object-contain border border-border" />
                        )}
                      </div>
                    ) : item.parameter_type === "calculated" ? (
                      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        Auto-calculated on submit
                        {item.formula && <span className="ml-2 font-mono text-xs text-blue-400">({item.formula})</span>}
                      </div>
                    ) : (item.reading_count ?? 1) > 1 ? (
                      <div className="space-y-2">
                        {Array.from({ length: item.reading_count! }, (_, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-20 shrink-0">Reading {idx + 1}</span>
                            <Input
                              type="number"
                              value={multiReadings[item.parameter_id]?.[idx] || ""}
                              onChange={e => {
                                const val = e.target.value;
                                setMultiReadings(prev => {
                                  const arr = [...(prev[item.parameter_id] || Array(item.reading_count!).fill(""))];
                                  arr[idx] = val;
                                  return { ...prev, [item.parameter_id]: arr };
                                });
                              }}
                              placeholder={item.unit ? `Value in ${item.unit}` : "Value"}
                              className="flex-1"
                            />
                          </div>
                        ))}
                        {(() => {
                          const stat = getMultiStat(item.parameter_id, item.reading_count!, item.statistic ?? "average");
                          if (stat === null) return null;
                          const outOfSpec = (item.min_value != null && stat < item.min_value) || (item.max_value != null && stat > item.max_value);
                          return (
                            <div className={`text-sm font-mono px-3 py-1.5 rounded-md ${outOfSpec ? "text-red-400 bg-red-500/10" : "text-green-400 bg-green-500/10"}`}>
                              {statisticLabel(item.statistic ?? "average")}: {stat.toFixed(4).replace(/\.?0+$/, "")} {item.unit || ""}
                              {outOfSpec && <span className="ml-2 text-xs font-sans">Out of spec</span>}
                            </div>
                          );
                        })()}
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
            {((inspection.results || []) as Array<{ parameter_name: string; unit?: string; value: string; is_flagged: boolean; is_within_spec?: boolean; parameter_id: string; parameter_type?: string }>).map((r) => {
              // Detect multi-reading (JSON array of numbers)
              let readingsArr: number[] | null = null;
              try {
                const parsed = JSON.parse(r.value);
                if (Array.isArray(parsed) && parsed.every((v: unknown) => typeof v === "number")) readingsArr = parsed;
              } catch { /* not JSON */ }
              const readingsStat = readingsArr ? computeStatistic(readingsArr, (r as { statistic?: string }).statistic ?? "average") : null;
              const readingsStatLabel = statisticLabel((r as { statistic?: string }).statistic ?? "average");

              return (
                <Card key={r.parameter_id} className={r.is_flagged ? "border-red-500/30" : ""}>
                  <CardContent className="p-3">
                    {r.parameter_type === "photo" ? (
                      <div>
                        <p className="text-sm font-medium mb-2">{r.parameter_name}</p>
                        {r.value
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={r.value} alt={r.parameter_name} className="rounded-md max-h-48 object-contain border border-border" />
                          : <p className="text-xs text-muted-foreground">No photo captured</p>
                        }
                      </div>
                    ) : readingsArr ? (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{r.parameter_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {readingsArr.map((v, i) => `R${i + 1}: ${v}`).join(" · ")}
                          </p>
                          <p className="text-base font-mono mt-0.5">{readingsStatLabel}: {readingsStat!.toFixed(4).replace(/\.?0+$/, "")} {r.unit || ""}</p>
                        </div>
                        <Badge className={`text-xs shrink-0 ${r.is_flagged ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                          {r.is_flagged ? "OUT OF SPEC" : "OK"}
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{r.parameter_name}</p>
                          <p className="text-base font-mono">{r.value} {r.unit || ""}</p>
                        </div>
                        <Badge className={`text-xs ${r.is_flagged ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                          {r.is_flagged ? "OUT OF SPEC" : "OK"}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

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
