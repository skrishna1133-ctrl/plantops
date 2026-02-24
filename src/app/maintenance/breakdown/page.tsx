"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Machine { id: string; machineId: string; name: string; machineTypeName?: string; }

export default function BreakdownPage() {
  const router = useRouter();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [form, setForm] = useState({ machineId: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      fetch("/api/maintenance/machines").then(r => r.ok ? r.json() : []).then(setMachines).finally(() => setLoading(false));
    });
  }, [router]);

  const submit = async () => {
    if (!form.machineId || !form.description.trim()) return;
    setSaving(true);
    const res = await fetch("/api/maintenance/breakdown-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSubmitted(true);
      setForm({ machineId: "", description: "" });
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/maintenance"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
          <h1 className="text-lg font-bold">Report Breakdown</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {submitted ? (
          <Card className="border-green-500/30">
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle2 size={48} className="text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Report Submitted</h2>
              <p className="text-muted-foreground">Your breakdown report has been submitted. The maintenance team has been notified.</p>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" onClick={() => setSubmitted(false)}>Submit Another</Button>
                <Link href="/maintenance"><Button>Back to Dashboard</Button></Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle size={24} className="text-red-500" />
                <div>
                  <h2 className="font-semibold">Equipment Breakdown Report</h2>
                  <p className="text-sm text-muted-foreground">Describe the issue and the maintenance team will be notified immediately.</p>
                </div>
              </div>

              <div>
                <Label>Machine / Equipment <span className="text-red-500">*</span></Label>
                <Select value={form.machineId} onValueChange={v => setForm(f => ({ ...f, machineId: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select machine..." /></SelectTrigger>
                  <SelectContent>
                    {machines.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-mono text-xs mr-2 text-muted-foreground">{m.machineId}</span>{m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Describe the Issue <span className="text-red-500">*</span></Label>
                <Textarea
                  className="mt-1.5"
                  rows={5}
                  placeholder="Describe what happened, any unusual sounds, smells, or behaviors..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.description.length}/500 characters</p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={submit}
                disabled={saving || !form.machineId || !form.description.trim()}
              >
                <AlertTriangle size={16} className="mr-2" />
                {saving ? "Submitting..." : "Submit Breakdown Report"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
