"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LogField {
  id: string; label: string; unit: string | null;
  minValue: number | null; maxValue: number | null; isRequired: boolean; orderNum: number;
}
interface LogTemplate {
  id: string; title: string; machineTypeName?: string; machineTypeId: string;
  frequency: string; fields?: LogField[];
}
interface Machine { id: string; name: string; machineId: string; machineTypeId: string; }

export default function FillLogSheetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<LogTemplate | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [outOfRangeCount, setOutOfRangeCount] = useState(0);

  const fetchData = useCallback(async () => {
    const [tRes, mRes] = await Promise.all([
      fetch(`/api/maintenance/log-templates/${id}`),
      fetch("/api/maintenance/machines"),
    ]);
    if (tRes.ok) {
      const t = await tRes.json();
      setTemplate(t);
      const init: Record<string, string> = {};
      for (const f of t.fields || []) init[f.id] = "";
      setValues(init);
    }
    if (mRes.ok) setMachines(await mRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      fetchData();
    });
  }, [router, fetchData]);

  const eligibleMachines = template
    ? machines.filter(m => m.machineTypeId === template.machineTypeId)
    : machines;

  const isOutOfRange = (field: LogField, val: string): boolean => {
    if (!val) return false;
    const num = parseFloat(val);
    if (isNaN(num)) return false;
    if (field.minValue !== null && num < field.minValue) return true;
    if (field.maxValue !== null && num > field.maxValue) return true;
    return false;
  };

  const getRangeLabel = (field: LogField): string => {
    if (field.minValue !== null && field.maxValue !== null)
      return `${field.minValue} – ${field.maxValue}${field.unit ? ` ${field.unit}` : ""}`;
    if (field.minValue !== null) return `Min: ${field.minValue}${field.unit ? ` ${field.unit}` : ""}`;
    if (field.maxValue !== null) return `Max: ${field.maxValue}${field.unit ? ` ${field.unit}` : ""}`;
    return "";
  };

  const submit = async () => {
    if (!machineId) return;
    const fields = template?.fields || [];
    // Check required fields have values
    const missingRequired = fields.filter(f => f.isRequired && !values[f.id]);
    if (missingRequired.length > 0) return;

    const responses = fields.map(f => ({
      fieldId: f.id,
      value: values[f.id] || "",
      isOutOfRange: isOutOfRange(f, values[f.id] || ""),
    }));
    const oorCount = responses.filter(r => r.isOutOfRange).length;
    setOutOfRangeCount(oorCount);

    setSubmitting(true);
    const res = await fetch("/api/maintenance/log-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id, machineId, notes, responses }),
    });
    if (res.ok) setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!template) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Log sheet template not found</div>;

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle2 size={48} className={outOfRangeCount > 0 ? "text-orange-500" : "text-green-500"} />
        <h2 className="text-xl font-bold">Log Sheet Submitted</h2>
        {outOfRangeCount > 0 && (
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {outOfRangeCount} value(s) out of range. A manager must sign off on this submission.
          </p>
        )}
        {outOfRangeCount === 0 && (
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Pending manager sign-off.
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setSubmitted(false); setValues({}); setMachineId(""); setNotes(""); fetchData(); }}>
            Fill Another
          </Button>
          <Button onClick={() => router.push("/maintenance")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/maintenance/log-sheets"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
          <div>
            <h1 className="text-lg font-bold">{template.title}</h1>
            <p className="text-xs text-muted-foreground">{template.machineTypeName} • <span className="capitalize">{template.frequency.replace("_", " ")}</span></p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Machine Selection */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Select Machine</CardTitle></CardHeader>
          <CardContent>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger><SelectValue placeholder="Choose machine..." /></SelectTrigger>
              <SelectContent>
                {eligibleMachines.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name} ({m.machineId})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligibleMachines.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">No machines of type &quot;{template.machineTypeName}&quot; found.</p>
            )}
          </CardContent>
        </Card>

        {/* Log Fields */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Parameters</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(template.fields || []).map((field, idx) => {
              const val = values[field.id] || "";
              const oor = isOutOfRange(field, val);
              const rangeLabel = getRangeLabel(field);
              return (
                <div key={field.id}>
                  <Label className="text-sm font-medium">
                    {idx + 1}. {field.label}
                    {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                    {field.isRequired && <span className="text-destructive ml-1">*</span>}
                    {oor && <Badge variant="destructive" className="ml-2 text-xs">Out of Range</Badge>}
                  </Label>
                  {rangeLabel && <p className="text-xs text-muted-foreground mb-1">Range: {rangeLabel}</p>}
                  <Input
                    type="number"
                    placeholder={`Enter value${field.unit ? ` (${field.unit})` : ""}...`}
                    value={val}
                    onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                    className={`mt-1 ${oor ? "border-orange-500 focus-visible:ring-orange-500" : ""}`}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="p-4">
            <Label>Notes (optional)</Label>
            <Textarea className="mt-1.5" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations..." />
          </CardContent>
        </Card>

        {/* Out of range warning */}
        {(template.fields || []).some(f => isOutOfRange(f, values[f.id] || "")) && (
          <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-600 dark:text-orange-400">
              Some values are outside expected range. Manager sign-off will be required.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" onClick={() => router.push("/maintenance/log-sheets")}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !machineId}>
            {submitting ? "Submitting..." : "Submit Log Sheet"}
          </Button>
        </div>
      </main>
    </div>
  );
}
