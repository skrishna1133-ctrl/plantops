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
import type { QualityDocumentV2 } from "@/lib/schemas";
import CreateQualityDocV2Dialog from "./create-quality-doc-v2-dialog";

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

export default function QualityDocumentsV2Tab({ readOnly = false }: { readOnly?: boolean }) {
  const [docs, setDocs] = useState<QualityDocumentV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/quality/v2?${params}`);
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching quality docs v2:", error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const deleteDoc = async (id: string) => {
    if (!confirm("Delete this quality document? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/quality/v2/${id}`, { method: "DELETE" });
      fetchDocs();
    } catch (error) {
      console.error("Error deleting doc:", error);
    } finally {
      setDeletingId(null);
    }
  };

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
          <Badge variant="secondary">{docs.length} documents</Badge>
        </div>
        {!readOnly && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-1" />
            New Document
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No V2 quality documents yet.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc ID</TableHead>
                <TableHead>Template</TableHead>
                <TableHead className="text-center">Rows</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Quality Tech</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.docId}</TableCell>
                  <TableCell className="font-medium">{d.templateTitle}</TableCell>
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
                    {d.qualityTechName || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
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
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-300"
                          onClick={() => deleteDoc(d.id)}
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

      {!readOnly && (
        <CreateQualityDocV2Dialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={fetchDocs}
        />
      )}
    </div>
  );
}
