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

interface ChecklistItem {
  id: string; label: string; itemType: "checkbox" | "numeric" | "pass_fail" | "text_note";
  expectedValue: string | null; isRequired: boolean; orderNum: number;
}
interface ChecklistTemplate {
  id: string; title: string; machineTypeName?: string; machineTypeId: string;
  frequency: string; items?: ChecklistItem[];
}
interface Machine { id: string; name: string; machineId: string; machineTypeId: string; }

interface Response { itemId: string; value: string; isFlagged: boolean; }

export default function FillChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState("");
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasFlags, setHasFlags] = useState(false);

  const fetchData = useCallback(async () => {
    const [tRes, mRes] = await Promise.all([
      fetch(`/api/maintenance/checklist-templates/${id}`),
      fetch("/api/maintenance/machines"),
    ]);
    if (tRes.ok) {
      const t = await tRes.json();
      setTemplate(t);
      // Initialize responses
      const init: Record<string, Response> = {};
      for (const item of t.items || []) {
        init[item.id] = { itemId: item.id, value: item.itemType === "checkbox" ? "false" : "", isFlagged: false };
      }
      setResponses(init);
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

  // Filter machines by machine type when template loads
  const eligibleMachines = template
    ? machines.filter(m => m.machineTypeId === template.machineTypeId)
    : machines;

  const updateResponse = (itemId: string, value: string, isFlagged: boolean) => {
    setResponses(prev => ({ ...prev, [itemId]: { itemId, value, isFlagged } }));
  };

  const autoFlag = (item: ChecklistItem, value: string): boolean => {
    if (item.itemType === "pass_fail" && value === "fail") return true;
    if (item.itemType === "numeric" && item.expectedValue && value) {
      const expected = parseFloat(item.expectedValue);
      const actual = parseFloat(value);
      if (!isNaN(expected) && !isNaN(actual)) return actual !== expected;
    }
    return false;
  };

  const handleValueChange = (item: ChecklistItem, value: string) => {
    const flagged = autoFlag(item, value);
    updateResponse(item.id, value, flagged);
  };

  const submit = async () => {
    if (!machineId) return;
    const items = template?.items || [];
    // Check required items
    const missing = items.filter(it => it.isRequired && !responses[it.id]?.value &&
      !(it.itemType === "checkbox" && responses[it.id]?.value === "false"));
    if (missing.length > 0) return;

    setSubmitting(true);
    const responseList = Object.values(responses);
    const flags = responseList.filter(r => r.isFlagged);
    setHasFlags(flags.length > 0);

    const res = await fetch("/api/maintenance/checklist-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: id,
        machineId,
        notes,
        responses: responseList,
      }),
    });
    if (res.ok) setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!template) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Checklist template not found</div>;

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <CheckCircle2 size={48} className={hasFlags ? "text-orange-500" : "text-green-500"} />
        <h2 className="text-xl font-bold">{hasFlags ? "Submitted with Flags" : "Checklist Submitted"}</h2>
        {hasFlags && (
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Some items were flagged. The maintenance manager has been notified.
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setSubmitted(false); setResponses({}); setMachineId(""); setNotes(""); fetchData(); }}>
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
          <Link href="/maintenance/checklists"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
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
              <SelectTrigger>
                <SelectValue placeholder="Choose machine..." />
              </SelectTrigger>
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

        {/* Checklist Items */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Checklist Items</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(template.items || []).map((item, idx) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground mt-1 w-4 shrink-0">{idx + 1}.</span>
                  <div className="flex-1">
                    <Label className="text-sm font-medium">
                      {item.label}
                      {item.isRequired && <span className="text-destructive ml-1">*</span>}
                      {responses[item.id]?.isFlagged && (
                        <Badge variant="destructive" className="ml-2 text-xs">Flagged</Badge>
                      )}
                    </Label>
                    {item.expectedValue && item.itemType === "numeric" && (
                      <p className="text-xs text-muted-foreground">Expected: {item.expectedValue}</p>
                    )}
                    <div className="mt-1.5">
                      {item.itemType === "checkbox" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={responses[item.id]?.value === "true"}
                            onChange={e => handleValueChange(item, e.target.checked ? "true" : "false")}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="text-sm text-muted-foreground">
                            {responses[item.id]?.value === "true" ? "Checked" : "Not checked"}
                          </span>
                        </div>
                      )}
                      {item.itemType === "numeric" && (
                        <Input
                          type="number"
                          placeholder="Enter value..."
                          value={responses[item.id]?.value || ""}
                          onChange={e => handleValueChange(item, e.target.value)}
                          className={responses[item.id]?.isFlagged ? "border-orange-500" : ""}
                        />
                      )}
                      {item.itemType === "pass_fail" && (
                        <div className="flex gap-2">
                          {["pass", "fail"].map(v => (
                            <Button
                              key={v}
                              type="button"
                              size="sm"
                              variant={responses[item.id]?.value === v
                                ? (v === "pass" ? "default" : "destructive")
                                : "outline"}
                              onClick={() => handleValueChange(item, v)}
                              className="capitalize"
                            >
                              {v}
                            </Button>
                          ))}
                        </div>
                      )}
                      {item.itemType === "text_note" && (
                        <Input
                          placeholder="Enter note..."
                          value={responses[item.id]?.value || ""}
                          onChange={e => handleValueChange(item, e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="p-4">
            <Label>Additional Notes (optional)</Label>
            <Textarea className="mt-1.5" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any observations or comments..." />
          </CardContent>
        </Card>

        {/* Flag warning */}
        {Object.values(responses).some(r => r.isFlagged) && (
          <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-600 dark:text-orange-400">
              {Object.values(responses).filter(r => r.isFlagged).length} item(s) flagged — the maintenance manager will be notified.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" onClick={() => router.push("/maintenance/checklists")}>Cancel</Button>
          <Button onClick={submit} disabled={submitting || !machineId}>
            {submitting ? "Submitting..." : "Submit Checklist"}
          </Button>
        </div>
      </main>
    </div>
  );
}
