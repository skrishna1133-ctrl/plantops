"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Camera, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QualityDocument, QualityDocRow } from "@/lib/schemas";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  worker_filled: "Worker Filled",
  complete: "Complete",
};

const statusColors: Record<string, string> = {
  draft: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  worker_filled: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  complete: "bg-green-500/20 text-green-400 border-green-500/30",
};

interface QualityDocDetailDialogProps {
  doc: QualityDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export default function QualityDocDetailDialog({
  doc,
  open,
  onOpenChange,
  onUpdated,
}: QualityDocDetailDialogProps) {
  const [rows, setRows] = useState<QualityDocRow[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (doc) setRows([...doc.rows]);
  }, [doc]);

  if (!doc) return null;

  const docTitle = `Metal Contamination and Bulk Density Data for ${doc.materialCode} on ${new Date(doc.createdAt).toLocaleDateString()}`;

  const updateRow = (serialNumber: number, field: keyof QualityDocRow, value: number | string | undefined) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.serialNumber !== serialNumber) return r;
        const updated = { ...r, [field]: value };

        if (field === "grossWeight" || field === "metalContamGrams") {
          const gross = field === "grossWeight" ? (value as number) : r.grossWeight;
          const net = gross !== undefined ? gross - doc.tareWeight : undefined;
          updated.netWeight = net;
          updated.grossWeight = gross;

          const metalG = field === "metalContamGrams" ? (value as number) : r.metalContamGrams;
          if (metalG !== undefined && net !== undefined && net > 0) {
            updated.metalContamPct = (metalG * 0.00220462) / net;
          } else {
            updated.metalContamPct = undefined;
          }
          updated.metalContamGrams = metalG;
        }

        if (field === "bulkDensityGcc") {
          const gcc = value as number;
          updated.bulkDensityLbcc = gcc !== undefined ? (gcc * 62.4279606) / 1000 : undefined;
        }

        return updated;
      })
    );
  };

  const handlePhotoUpload = (serialNumber: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setRows((prev) =>
        prev.map((r) =>
          r.serialNumber === serialNumber ? { ...r, photoUrl: reader.result as string } : r
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (serialNumber: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.serialNumber === serialNumber ? { ...r, photoUrl: undefined } : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/quality/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      onUpdated();
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    setSaving(true);
    try {
      await fetch(`/api/quality/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, status: "complete" }),
      });
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error completing:", error);
    } finally {
      setSaving(false);
    }
  };

  const avgMetalContamPct = (() => {
    const vals = rows.filter((r) => r.metalContamPct !== undefined).map((r) => r.metalContamPct!);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
  })();

  const canComplete = doc.status === "worker_filled" && rows.every((r) => r.metalContamGrams !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{docTitle}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge className={statusColors[doc.status]}>{statusLabels[doc.status]}</Badge>
            <span>PO: {doc.poNumber}</span>
            <span>Customer: {doc.customerName}</span>
            <span>Customer PO: {doc.customerPo}</span>
            <span>Tare: {doc.tareWeight} lbs</span>
            {doc.personName && <span>Filled by: {doc.personName}</span>}
          </div>
        </DialogHeader>

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
                    {doc.status === "worker_filled" || doc.status === "complete" ? (
                      <Input
                        type="number"
                        step="0.0001"
                        className="w-24 h-8 text-sm"
                        value={r.metalContamGrams ?? ""}
                        onChange={(e) =>
                          updateRow(r.serialNumber, "metalContamGrams", e.target.value ? Number(e.target.value) : undefined)
                        }
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {r.metalContamPct !== undefined ? (r.metalContamPct * 100).toFixed(6) + "%" : "—"}
                  </TableCell>
                  <TableCell>
                    <input
                      ref={(el) => { fileInputRefs.current[r.serialNumber] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(r.serialNumber, file);
                      }}
                    />
                    {r.photoUrl ? (
                      <div className="relative w-16 h-16">
                        <img
                          src={r.photoUrl}
                          alt={`Metal contamination #${r.serialNumber}`}
                          className="w-16 h-16 object-cover rounded border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(r.serialNumber)}
                          className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => fileInputRefs.current[r.serialNumber]?.click()}
                      >
                        <Camera size={12} className="mr-1" />
                        Photo
                      </Button>
                    )}
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
          {(doc.status === "worker_filled" || doc.status === "complete") && (
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          )}
          {canComplete && (
            <Button onClick={handleMarkComplete} disabled={saving}>
              <CheckCircle2 size={14} className="mr-2" />
              Mark Complete
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
