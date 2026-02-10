"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Shipment, ShipmentType, ShipmentStatus } from "@/lib/schemas";
import {
  shipmentTypeLabels,
  shipmentStatusLabels,
  shipmentStatuses,
} from "@/lib/schemas";

interface ShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  shipment?: Shipment | null;
}

export default function ShipmentDialog({
  open,
  onOpenChange,
  onSaved,
  shipment,
}: ShipmentDialogProps) {
  const isEdit = !!shipment;

  const [type, setType] = useState<ShipmentType>("incoming");
  const [poNumber, setPoNumber] = useState("");
  const [materialCode, setMaterialCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [carrier, setCarrier] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("pending");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (shipment) {
      setType(shipment.type);
      setPoNumber(shipment.poNumber);
      setMaterialCode(shipment.materialCode);
      setSupplierName(shipment.supplierName || "");
      setCustomerName(shipment.customerName || "");
      setCarrier(shipment.carrier);
      setShipmentDate(shipment.shipmentDate);
      setNotes(shipment.notes || "");
      setStatus(shipment.status);
    } else {
      setType("incoming");
      setPoNumber("");
      setMaterialCode("");
      setSupplierName("");
      setCustomerName("");
      setCarrier("");
      setShipmentDate("");
      setNotes("");
      setStatus("pending");
    }
    setError("");
  }, [shipment, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const body = {
        type,
        poNumber,
        materialCode,
        supplierName: type === "incoming" ? supplierName : undefined,
        customerName: type === "outgoing" ? customerName : undefined,
        carrier,
        shipmentDate,
        notes: notes || undefined,
        ...(isEdit ? { status } : {}),
      };

      if (isEdit) {
        const res = await fetch(`/api/shipments/${shipment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to update shipment");
          return;
        }
      } else {
        const res = await fetch("/api/shipments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to create shipment");
          return;
        }
      }

      onOpenChange(false);
      onSaved();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Shipment" : "New Shipment"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update shipment details"
              : "Create a new incoming or outgoing shipment"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ShipmentType)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(shipmentTypeLabels) as [ShipmentType, string][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poNumber">PO Number</Label>
            <Input
              id="poNumber"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="Purchase order number"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="materialCode">Material Code</Label>
            <Input
              id="materialCode"
              value={materialCode}
              onChange={(e) => setMaterialCode(e.target.value)}
              placeholder="Material code"
              required
            />
          </div>

          {type === "incoming" ? (
            <div className="space-y-2">
              <Label htmlFor="supplierName">Supplier Name</Label>
              <Input
                id="supplierName"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Supplier name"
                required
              />
            </div>
          ) : (
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
          )}

          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier / Truck</Label>
            <Input
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="Carrier or truck info"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shipmentDate">Shipment Date</Label>
            <Input
              id="shipmentDate"
              type="date"
              value={shipmentDate}
              onChange={(e) => setShipmentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={3}
            />
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as ShipmentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shipmentStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {shipmentStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                {isEdit ? "Updating..." : "Creating..."}
              </>
            ) : isEdit ? (
              "Update Shipment"
            ) : (
              "Create Shipment"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
