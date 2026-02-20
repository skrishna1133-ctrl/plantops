"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Loader2, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Shipment } from "@/lib/schemas";
import {
  shipmentStatusLabels,
  shipmentTypeLabels,
} from "@/lib/schemas";
import ShipmentDialog from "@/components/shipment-dialog";

const statusColors: Record<string, string> = {
  pending: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_transit: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  delivered: "bg-green-500/20 text-green-400 border-green-500/30",
};

const typeColors: Record<string, string> = {
  incoming: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  outgoing: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function ShipmentsTab({ readOnly = false, viewAs }: { readOnly?: boolean; viewAs?: string }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchShipments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (viewAs) params.set("viewAs", viewAs);
      const res = await fetch(`/api/shipments?${params}`);
      const data = await res.json();
      setShipments(data);
    } catch (error) {
      console.error("Error fetching shipments:", error);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  const deleteShipment = async (id: string) => {
    if (!confirm("Delete this shipment? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/shipments/${id}`, { method: "DELETE" });
      fetchShipments();
    } catch (error) {
      console.error("Error deleting shipment:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (s: Shipment) => {
    setEditingShipment(s);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingShipment(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="incoming">Incoming</SelectItem>
              <SelectItem value="outgoing">Outgoing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{shipments.length} shipments</Badge>
        </div>
        {!readOnly && (
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1" />
            New Shipment
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No shipments found.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Supplier / Customer</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {!readOnly && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">
                    {s.shipmentId}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={typeColors[s.type]}>
                      {shipmentTypeLabels[s.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.poNumber}</TableCell>
                  <TableCell>{s.materialCode}</TableCell>
                  <TableCell>
                    {s.type === "incoming" ? s.supplierName : s.customerName}
                  </TableCell>
                  <TableCell>{s.carrier}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[s.status]}>
                      {shipmentStatusLabels[s.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.shipmentDate}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300"
                          onClick={() => deleteShipment(s.id)}
                          disabled={deletingId === s.id}
                        >
                          {deletingId === s.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!readOnly && (
        <ShipmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={fetchShipments}
          shipment={editingShipment}
        />
      )}
    </div>
  );
}
