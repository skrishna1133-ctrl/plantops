"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function NewNcrContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillLotId = searchParams.get("lotId");

  const [role, setRole] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    source: "operator_report",
    severity: "minor",
    description: "",
    lotId: prefillLotId || "",
    affectedMaterialType: "",
    affectedQuantityKg: "",
    dueDate: "",
  });

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(data => {
      if (!data.authenticated) { router.push("/login"); return; }
      setRole(data.role);
      // Workers can only do operator_report
      if (data.role === "worker") {
        setForm(f => ({ ...f, source: "operator_report" }));
      }
    });
  }, []);

  const isManager = ["quality_manager", "admin", "owner"].includes(role);

  const handleSubmit = async () => {
    if (!form.title) return;
    setSubmitting(true);
    const res = await fetch("/api/qms/ncrs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        source: form.source,
        severity: form.severity,
        description: form.description || undefined,
        lotId: form.lotId || undefined,
        affectedMaterialType: form.affectedMaterialType || undefined,
        affectedQuantityKg: form.affectedQuantityKg ? parseFloat(form.affectedQuantityKg) : undefined,
        dueDate: form.dueDate || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(isManager ? `/quality/ncr/${data.id}` : "/quality");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/quality/ncr"><Button variant="ghost" size="sm"><ArrowLeft size={16} /></Button></Link>
          <h1 className="font-bold">Report Quality Issue</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label>Issue Title <span className="text-red-400">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Brief description of the quality issue"
                className="mt-1"
              />
            </div>

            {isManager && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source</Label>
                  <select
                    value={form.source}
                    onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1"
                  >
                    <option value="internal_inspection">Internal Inspection</option>
                    <option value="customer_complaint">Customer Complaint</option>
                    <option value="operator_report">Operator Report</option>
                    <option value="audit">Audit</option>
                  </select>
                </div>
                <div>
                  <Label>Severity</Label>
                  <select
                    value={form.severity}
                    onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                    className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1"
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
            )}

            {!isManager && (
              <div>
                <Label>Severity</Label>
                <select
                  value={form.severity}
                  onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
                  className="w-full border border-input bg-background text-sm rounded-md px-3 py-2 mt-1"
                >
                  <option value="minor">Minor — small defect, doesn&apos;t stop production</option>
                  <option value="major">Major — affects product quality significantly</option>
                  <option value="critical">Critical — safety or major quality failure</option>
                </select>
              </div>
            )}

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What did you observe? Where? When?"
                rows={4}
                className="mt-1"
              />
            </div>

            {isManager && (
              <>
                <div>
                  <Label>Affected Material Type</Label>
                  <Input value={form.affectedMaterialType} onChange={e => setForm(f => ({ ...f, affectedMaterialType: e.target.value }))} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Affected Quantity (kg)</Label>
                    <Input type="number" value={form.affectedQuantityKg} onChange={e => setForm(f => ({ ...f, affectedQuantityKg: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="mt-1" />
                  </div>
                </div>
              </>
            )}

            <Button className="w-full" onClick={handleSubmit} disabled={!form.title || submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Submit Report
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function NewNcrPage() {
  return <Suspense fallback={null}><NewNcrContent /></Suspense>;
}
