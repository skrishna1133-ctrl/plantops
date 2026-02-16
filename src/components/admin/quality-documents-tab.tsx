"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Eye } from "lucide-react";
import Link from "next/link";
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
import type { QualityDocument, QualityDocumentV2 } from "@/lib/schemas";
import QualityDocDialog from "./quality-doc-dialog";
import QualityDocDetailDialog from "./quality-doc-detail-dialog";
import CreateQualityDocV2Dialog from "./create-quality-doc-v2-dialog";

const LEGACY_TITLE = "Bulk Density & Metal Contamination Report";

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

type UnifiedDoc = {
  type: "legacy" | "v2";
  id: string;
  docId: string;
  title: string;
  subtitle: string;
  rowCount: number;
  status: string;
  createdAt: string;
  workerName?: string;
  legacy?: QualityDocument;
};

export default function QualityDocumentsTab({ readOnly = false }: { readOnly?: boolean }) {
  const [legacyDocs, setLegacyDocs] = useState<QualityDocument[]>([]);
  const [v2Docs, setV2Docs] = useState<QualityDocumentV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createLegacyOpen, setCreateLegacyOpen] = useState(false);
  const [createV2Open, setCreateV2Open] = useState(false);
  const [selectedLegacyDoc, setSelectedLegacyDoc] = useState<QualityDocument | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);

      const [legacyRes, v2Res] = await Promise.all([
        fetch(`/api/quality?${params}`),
        fetch(`/api/quality/v2?${params}`),
      ]);
      const legacyData = await legacyRes.json();
      const v2Data = await v2Res.json();
      setLegacyDocs(Array.isArray(legacyData) ? legacyData : []);
      setV2Docs(Array.isArray(v2Data) ? v2Data : []);
    } catch (error) {
      console.error("Error fetching quality docs:", error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const deleteDoc = async (type: "legacy" | "v2", id: string) => {
    if (!confirm("Delete this quality document? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const url = type === "legacy" ? `/api/quality/${id}` : `/api/quality/v2/${id}`;
      await fetch(url, { method: "DELETE" });
      fetchDocs();
    } catch (error) {
      console.error("Error deleting doc:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const unifiedDocs: UnifiedDoc[] = [
    ...legacyDocs.map((d): UnifiedDoc => ({
      type: "legacy",
      id: d.id,
      docId: d.docId,
      title: LEGACY_TITLE,
      subtitle: `PO: ${d.poNumber} — ${d.materialCode} — ${d.customerName}`,
      rowCount: d.rowCount,
      status: d.status,
      createdAt: d.createdAt,
      workerName: d.personName,
      legacy: d,
    })),
    ...v2Docs.map((d): UnifiedDoc => ({
      type: "v2",
      id: d.id,
      docId: d.docId,
      title: d.templateTitle,
      subtitle: "",
      rowCount: d.rowCount,
      status: d.status,
      createdAt: d.createdAt,
      workerName: d.workerName,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="worker_filled">Worker Filled</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{unifiedDocs.length} documents</Badge>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateV2Open(true)}>
              <Plus size={16} className="mr-1" />
              New Document
            </Button>
            <Button variant="outline" onClick={() => setCreateLegacyOpen(true)}>
              <Plus size={16} className="mr-1" />
              BD & Metal Contam.
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : unifiedDocs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No quality documents yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-center">Rows</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unifiedDocs.map((d) => (
                <TableRow key={`${d.type}-${d.id}`}>
                  <TableCell className="font-mono text-sm">{d.docId}</TableCell>
                  <TableCell>
                    <p className="font-medium">{d.title}</p>
                    {d.subtitle && (
                      <p className="text-xs text-muted-foreground">{d.subtitle}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{d.rowCount}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={statusColors[d.status]}>
                      {statusLabels[d.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.workerName || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {d.type === "v2" ? (
                        <Link href={`/quality/v2/${d.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="View / Edit"
                          >
                            <Eye size={14} />
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedLegacyDoc(d.legacy!);
                            setDetailOpen(true);
                          }}
                          title="View / Edit"
                        >
                          <Eye size={14} />
                        </Button>
                      )}
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300"
                          onClick={() => deleteDoc(d.type, d.id)}
                          disabled={deletingId === d.id}
                        >
                          {deletingId === d.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <QualityDocDialog
        open={createLegacyOpen}
        onOpenChange={setCreateLegacyOpen}
        onCreated={fetchDocs}
      />

      <CreateQualityDocV2Dialog
        open={createV2Open}
        onOpenChange={setCreateV2Open}
        onCreated={fetchDocs}
      />

      <QualityDocDetailDialog
        doc={selectedLegacyDoc}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={fetchDocs}
        readOnly={readOnly}
      />
    </div>
  );
}
