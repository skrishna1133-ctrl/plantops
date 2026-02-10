"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface QualityDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function QualityDocDialog({
  open,
  onOpenChange,
  onCreated,
}: QualityDocDialogProps) {
  const [poNumber, setPoNumber] = useState("");
  const [materialCode, setMaterialCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPo, setCustomerPo] = useState("");
  const [tareWeight, setTareWeight] = useState("75");
  const [rowCount, setRowCount] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setPoNumber("");
    setMaterialCode("");
    setCustomerName("");
    setCustomerPo("");
    setTareWeight("75");
    setRowCount("5");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poNumber,
          materialCode,
          customerName,
          customerPo,
          tareWeight: Number(tareWeight),
          rowCount: Number(rowCount),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create document");
        return;
      }

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Quality Document</DialogTitle>
          <DialogDescription>
            Create a quality inspection document for a shipment
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="poNumber">PO Number</Label>
            <Input
              id="poNumber"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-12345"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="materialCode">Material Code</Label>
            <Input
              id="materialCode"
              value={materialCode}
              onChange={(e) => setMaterialCode(e.target.value)}
              placeholder="e.g. MAT-001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPo">Customer PO Number</Label>
            <Input
              id="customerPo"
              value={customerPo}
              onChange={(e) => setCustomerPo(e.target.value)}
              placeholder="Customer PO number"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tareWeight">Tare Weight (lbs)</Label>
              <Input
                id="tareWeight"
                type="number"
                value={tareWeight}
                onChange={(e) => setTareWeight(e.target.value)}
                min="0"
                step="0.01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rowCount">Number of Gaylords</Label>
              <Input
                id="rowCount"
                type="number"
                value={rowCount}
                onChange={(e) => setRowCount(e.target.value)}
                min="1"
                max="100"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Creating...
              </>
            ) : (
              "Create Document"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
