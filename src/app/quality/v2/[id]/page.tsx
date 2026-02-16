"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import type {
  QualityDocumentV2,
  QualityTemplate,
  QualityFieldValue,
  QualityDocRowV2,
  QualityTemplateField,
} from "@/lib/schemas";

const stageLabels: Record<string, string> = {
  worker: "Worker",
  quality_tech: "Quality Tech",
};

export default function FillQualityV2Page() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<QualityDocumentV2 | null>(null);
  const [template, setTemplate] = useState<QualityTemplate | null>(null);
  const [headerValues, setHeaderValues] = useState<QualityFieldValue[]>([]);
  const [rows, setRows] = useState<QualityDocRowV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth").then((r) => r.json()),
      fetch(`/api/quality/v2/${docId}`).then((r) => r.json()),
    ])
      .then(([authData, docData]) => {
        if (!authData.authenticated) {
          router.push("/login?from=/quality");
          return;
        }
        setUserRole(authData.role);

        if (docData.error) {
          setError(docData.error);
          return;
        }

        setDoc(docData.doc);
        setTemplate(docData.template);
        setHeaderValues(docData.doc.headerValues || []);
        setRows(docData.doc.rows || []);
      })
      .catch(() => {
        router.push("/login?from=/quality");
      })
      .finally(() => setLoading(false));
  }, [docId, router]);

  // Determine which stage the current user can fill
  const canFillStage = useCallback(
    (stage: string): boolean => {
      if (["admin", "owner"].includes(userRole)) return true;
      if (stage === "worker" && userRole === "worker" && doc?.status === "draft") return true;
      if (stage === "quality_tech" && userRole === "quality_tech" && doc?.status === "worker_filled") return true;
      return false;
    },
    [userRole, doc?.status]
  );

  const updateHeaderValue = (fieldId: string, value: string, fieldType: string) => {
    setHeaderValues((prev) =>
      prev.map((v) => {
        if (v.fieldId !== fieldId) return v;
        const updated = { ...v };
        if (fieldType === "numeric") {
          updated.numericValue = value ? Number(value) : undefined;
        } else if (fieldType === "text") {
          updated.textValue = value || undefined;
        } else if (fieldType === "checkbox") {
          updated.booleanValue = value === "true";
        } else if (fieldType === "pass_fail") {
          updated.textValue = value || undefined;
        }
        return updated;
      })
    );
  };

  const updateRowValue = (rowIndex: number, fieldId: string, value: string, fieldType: string) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== rowIndex) return row;
        return {
          ...row,
          values: row.values.map((v) => {
            if (v.fieldId !== fieldId) return v;
            const updated = { ...v };
            if (fieldType === "numeric") {
              updated.numericValue = value ? Number(value) : undefined;
            } else if (fieldType === "text") {
              updated.textValue = value || undefined;
            } else if (fieldType === "checkbox") {
              updated.booleanValue = value === "true";
            } else if (fieldType === "pass_fail") {
              updated.textValue = value || undefined;
            }
            return updated;
          }),
        };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/quality/v2/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headerValues, rows }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (newStatus: string) => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quality/v2/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headerValues, rows, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const renderFieldInput = (
    field: QualityTemplateField,
    value: QualityFieldValue,
    onChange: (val: string) => void,
    disabled: boolean
  ) => {
    if (field.type === "calculated") {
      return (
        <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-md min-h-[40px]">
          <Calculator size={14} className="text-muted-foreground" />
          <span className="font-mono text-sm">
            {value.calculatedValue !== undefined ? value.calculatedValue.toFixed(field.decimalPlaces ?? 2) : "—"}
          </span>
          {field.unit && <span className="text-xs text-muted-foreground">{field.unit}</span>}
        </div>
      );
    }

    if (field.type === "numeric") {
      return (
        <Input
          type="number"
          step={field.decimalPlaces ? `0.${"0".repeat(field.decimalPlaces - 1)}1` : "0.01"}
          value={value.numericValue ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.unit ? `0 ${field.unit}` : "0"}
          disabled={disabled}
        />
      );
    }

    if (field.type === "text") {
      return (
        <Input
          value={value.textValue ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.description || ""}
          disabled={disabled}
        />
      );
    }

    if (field.type === "checkbox") {
      return (
        <div className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={value.booleanValue ?? false}
            onChange={(e) => onChange(String(e.target.checked))}
            disabled={disabled}
            className="rounded"
          />
          <span className="text-sm">{value.booleanValue ? "Yes" : "No"}</span>
        </div>
      );
    }

    if (field.type === "pass_fail") {
      return (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={value.textValue === "pass" ? "default" : "outline"}
            onClick={() => onChange("pass")}
            disabled={disabled}
            className={value.textValue === "pass" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            Pass
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value.textValue === "fail" ? "default" : "outline"}
            onClick={() => onChange("fail")}
            disabled={disabled}
            className={value.textValue === "fail" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            Fail
          </Button>
        </div>
      );
    }

    if (field.type === "photo") {
      return (
        <p className="text-xs text-muted-foreground py-2">Photo upload coming soon</p>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!doc || !template) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{error || "Document not found"}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="p-8 space-y-4">
            <CheckCircle2 className="mx-auto text-green-500" size={56} />
            <h2 className="text-xl font-bold">Submitted!</h2>
            <p className="text-sm text-muted-foreground">
              Quality document has been updated successfully.
            </p>
            <Button onClick={() => router.push("/quality")} className="w-full">
              Back to Quality
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine what action the user can take
  const canWorkerSubmit = doc.status === "draft" && (userRole === "worker" || ["admin", "owner"].includes(userRole));
  const canQualityTechComplete = doc.status === "worker_filled" && (userRole === "quality_tech" || ["admin", "owner"].includes(userRole));
  const isReadOnly = doc.status === "complete";

  // Separate fields by stage for display
  const workerHeaderFields = template.headerFields.filter((f) => f.stage === "worker");
  const qualityTechHeaderFields = template.headerFields.filter((f) => f.stage === "quality_tech");
  const workerRowFields = template.rowFields.filter((f) => f.stage === "worker");
  const qualityTechRowFields = template.rowFields.filter((f) => f.stage === "quality_tech");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={userRole === "quality_tech" ? "/lab" : "/quality"}>
              <Button variant="ghost" size="icon">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                {doc.templateTitle}
              </h1>
              <p className="text-xs text-muted-foreground">
                {doc.docId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={
                doc.status === "draft"
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : doc.status === "worker_filled"
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                  : "bg-green-500/20 text-green-400 border-green-500/30"
              }
            >
              {doc.status === "draft" ? "Draft" : doc.status === "worker_filled" ? "Worker Filled" : "Complete"}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header Fields */}
        {template.headerFields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Document Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Worker header fields */}
              {workerHeaderFields.length > 0 && (
                <div className="space-y-3">
                  {workerHeaderFields.map((field) => {
                    const value = headerValues.find((v) => v.fieldId === field.id);
                    if (!value) return null;
                    const disabled = !canFillStage("worker") || isReadOnly;
                    return (
                      <div key={field.id} className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          {field.label}
                          {field.required && <span className="text-red-400">*</span>}
                          {field.unit && <span className="text-muted-foreground">({field.unit})</span>}
                        </Label>
                        {renderFieldInput(
                          field,
                          value,
                          (val) => updateHeaderValue(field.id, val, field.type),
                          disabled
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quality tech header fields */}
              {qualityTechHeaderFields.length > 0 && (
                <>
                  {workerHeaderFields.length > 0 && <Separator />}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                      Quality Tech Fields
                    </p>
                    {qualityTechHeaderFields.map((field) => {
                      const value = headerValues.find((v) => v.fieldId === field.id);
                      if (!value) return null;
                      const disabled = !canFillStage("quality_tech") || isReadOnly;
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            {field.label}
                            {field.required && <span className="text-red-400">*</span>}
                            {field.unit && <span className="text-muted-foreground">({field.unit})</span>}
                          </Label>
                          {renderFieldInput(
                            field,
                            value,
                            (val) => updateHeaderValue(field.id, val, field.type),
                            disabled
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Row Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Rows ({rows.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row, rowIndex) => (
              <div key={row.serialNumber} className="p-4 border rounded-lg space-y-3">
                <span className="font-semibold text-sm">
                  Row #{row.serialNumber}
                </span>

                {/* Worker row fields */}
                {workerRowFields.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {workerRowFields.map((field) => {
                      const value = row.values.find((v) => v.fieldId === field.id);
                      if (!value) return null;
                      const disabled = !canFillStage("worker") || isReadOnly;
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            {field.label}
                            {field.required && <span className="text-red-400">*</span>}
                            {field.unit && <span className="text-muted-foreground">({field.unit})</span>}
                          </Label>
                          {renderFieldInput(
                            field,
                            value,
                            (val) => updateRowValue(rowIndex, field.id, val, field.type),
                            disabled
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quality tech row fields */}
                {qualityTechRowFields.length > 0 && (
                  <>
                    {workerRowFields.length > 0 && <Separator />}
                    <div className="grid grid-cols-2 gap-3">
                      {qualityTechRowFields.map((field) => {
                        const value = row.values.find((v) => v.fieldId === field.id);
                        if (!value) return null;
                        const disabled = !canFillStage("quality_tech") || isReadOnly;
                        return (
                          <div key={field.id} className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              {field.label}
                              {field.required && <span className="text-red-400">*</span>}
                              {field.unit && <span className="text-muted-foreground">({field.unit})</span>}
                              {field.type !== "calculated" && (
                                <Badge variant="outline" className="text-[8px] ml-1 bg-purple-500/10 text-purple-400 border-purple-500/30">
                                  QT
                                </Badge>
                              )}
                            </Label>
                            {renderFieldInput(
                              field,
                              value,
                              (val) => updateRowValue(rowIndex, field.id, val, field.type),
                              disabled
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="space-y-3">
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSave}
                disabled={saving || submitting}
              >
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                Save Draft
              </Button>

              {canWorkerSubmit && (
                <Button
                  className="flex-1"
                  onClick={() => handleSubmit("worker_filled")}
                  disabled={submitting || saving}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Submit
                </Button>
              )}

              {canQualityTechComplete && (
                <Button
                  className="flex-1"
                  onClick={() => handleSubmit("complete")}
                  disabled={submitting || saving}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Complete
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
