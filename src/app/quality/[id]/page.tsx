"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { QualityDocument, QualityDocRow } from "@/lib/schemas";
import { ThemeToggle } from "@/components/theme-toggle";

export default function FillQualityPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<QualityDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [personName, setPersonName] = useState("");
  const [rows, setRows] = useState<QualityDocRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/quality/${docId}`)
      .then((res) => res.json())
      .then((data: QualityDocument) => {
        setDoc(data);
        setRows([...data.rows]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [docId]);

  const updateRow = (serialNumber: number, field: "grossWeight" | "bulkDensityGcc", value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.serialNumber !== serialNumber) return r;
        const numVal = value ? Number(value) : undefined;
        const updated = { ...r };

        if (field === "grossWeight") {
          updated.grossWeight = numVal;
          updated.netWeight = numVal !== undefined && doc ? numVal - doc.tareWeight : undefined;
        }
        if (field === "bulkDensityGcc") {
          updated.bulkDensityGcc = numVal;
          updated.bulkDensityLbcc = numVal !== undefined ? (numVal * 62.4279606) / 1000 : undefined;
        }

        return updated;
      })
    );
  };

  const handleSubmit = async () => {
    setError("");
    if (!personName || personName.length < 2) {
      setError("Please enter your name (at least 2 characters)");
      return;
    }

    const incomplete = rows.some((r) => r.grossWeight === undefined || r.bulkDensityGcc === undefined);
    if (incomplete) {
      setError("Please fill in gross weight and bulk density for all rows");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/quality/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          personName,
          status: "worker_filled",
        }),
      });

      if (!res.ok) {
        setError("Failed to submit");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Document not found</p>
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
              Quality data for PO {doc.poNumber} has been submitted.
            </p>
            <Button onClick={() => router.push("/quality")} className="w-full">
              Back to Quality
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (doc.status !== "draft") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="p-8 space-y-4">
            <p className="text-muted-foreground">This document has already been filled.</p>
            <Button onClick={() => router.push("/quality")} variant="outline" className="w-full">
              Back to Quality
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const docTitle = `Metal Contamination and Bulk Density Data for ${doc.materialCode} on ${new Date(doc.createdAt).toLocaleDateString()}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/quality">
              <Button variant="ghost" size="icon">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                PO: {doc.poNumber}
              </h1>
              <p className="text-xs text-muted-foreground">
                {doc.materialCode} — {doc.customerName}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{docTitle}</CardTitle>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Customer PO: {doc.customerPo}</span>
              <span>Tare: {doc.tareWeight} lbs</span>
              <Badge variant="outline" className="text-[10px]">{doc.rowCount} drums</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="personName">Your Name</Label>
              <Input
                id="personName"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              {rows.map((r) => (
                <div key={r.serialNumber} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Drum #{r.serialNumber}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Gross Weight (lbs)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={r.grossWeight ?? ""}
                        onChange={(e) => updateRow(r.serialNumber, "grossWeight", e.target.value)}
                        placeholder="0.00"
                      />
                      {r.netWeight !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          Net: {r.netWeight.toFixed(2)} lbs
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bulk Density (g/cc)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={r.bulkDensityGcc ?? ""}
                        onChange={(e) => updateRow(r.serialNumber, "bulkDensityGcc", e.target.value)}
                        placeholder="0.0000"
                      />
                      {r.bulkDensityLbcc !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {r.bulkDensityLbcc.toFixed(6)} lb/cc
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Submitting...
                </>
              ) : (
                "Submit Quality Data"
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
