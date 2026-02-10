"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QualityDocument, QualityDocRow } from "@/lib/schemas";
import PhotoCapture from "@/components/photo-capture";
import { ThemeToggle } from "@/components/theme-toggle";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function LabDocDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<QualityDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QualityDocRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

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

  const updateRow = (serialNumber: number, field: keyof QualityDocRow, value: number | string | undefined) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.serialNumber !== serialNumber) return r;
        const updated = { ...r, [field]: value };

        if (field === "metalContamGrams" && doc) {
          const metalG = value as number;
          const net = r.netWeight;
          if (metalG !== undefined && net !== undefined && net > 0) {
            updated.metalContamPct = (metalG * 0.00220462) / net;
          } else {
            updated.metalContamPct = undefined;
          }
        }

        return updated;
      })
    );
  };

  const updatePhoto = (serialNumber: number, url: string | undefined) => {
    setRows((prev) =>
      prev.map((r) =>
        r.serialNumber === serialNumber ? { ...r, photoUrl: url } : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/quality/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/quality/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, status: "complete" }),
      });
      setCompleted(true);
    } catch (error) {
      console.error("Error completing:", error);
    } finally {
      setSaving(false);
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

  if (completed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="p-8 space-y-4">
            <CheckCircle2 className="mx-auto text-green-500" size={56} />
            <h2 className="text-xl font-bold">Completed!</h2>
            <p className="text-sm text-muted-foreground">
              Quality document for PO {doc.poNumber} has been marked complete.
            </p>
            <Button onClick={() => router.push("/lab")} className="w-full">
              Back to Lab Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const docTitle = `Metal Contamination and Bulk Density Data for ${doc.materialCode} on ${formatDate(doc.createdAt)}`;
  const canComplete = rows.every((r) => r.metalContamGrams !== undefined);

  const avgMetalContamPct = (() => {
    const vals = rows.filter((r) => r.metalContamPct !== undefined).map((r) => r.metalContamPct!);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
  })();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/lab">
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{docTitle}</CardTitle>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Customer PO: {doc.customerPo}</span>
              <span>Tare: {doc.tareWeight} lbs</span>
              <Badge variant="outline" className="text-[10px]">{doc.rowCount} gaylords</Badge>
              {doc.personName && <span>Filled by: {doc.personName}</span>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Gross Wt (lbs)</TableHead>
                    <TableHead>Net Wt (lbs)</TableHead>
                    <TableHead>Bulk Density (g/cc)</TableHead>
                    <TableHead>Bulk Density (lb/cc)</TableHead>
                    <TableHead>Metal Contam (g)</TableHead>
                    <TableHead>% Metal Contam</TableHead>
                    <TableHead>Metal Contamination</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.serialNumber}>
                      <TableCell className="text-center font-medium">{r.serialNumber}</TableCell>
                      <TableCell>
                        {r.grossWeight !== undefined ? r.grossWeight.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.netWeight !== undefined ? r.netWeight.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.bulkDensityGcc !== undefined ? r.bulkDensityGcc.toFixed(4) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.bulkDensityLbcc !== undefined ? r.bulkDensityLbcc.toFixed(6) : "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.0001"
                          className="w-24 h-8 text-sm"
                          value={r.metalContamGrams ?? ""}
                          onChange={(e) =>
                            updateRow(r.serialNumber, "metalContamGrams", e.target.value ? Number(e.target.value) : undefined)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {r.metalContamPct !== undefined ? (r.metalContamPct * 100).toFixed(6) + "%" : "—"}
                      </TableCell>
                      <TableCell>
                        <PhotoCapture
                          photoUrl={r.photoUrl}
                          onPhotoChange={(url) => updatePhoto(r.serialNumber, url)}
                          label="Photo"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {avgMetalContamPct !== undefined && (
              <div className="text-sm font-medium p-3 bg-muted/50 rounded-lg">
                Average % Metal Contamination: {(avgMetalContamPct * 100).toFixed(6)}%
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
              {canComplete && (
                <Button onClick={handleMarkComplete} disabled={saving}>
                  <CheckCircle2 size={14} className="mr-2" />
                  Mark Complete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
