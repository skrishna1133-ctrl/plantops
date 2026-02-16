"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
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
import type { QualityTemplate } from "@/lib/schemas";
import QualityTemplateBuilderDialog from "./quality-template-builder-dialog";

export default function QualityTemplatesTab() {
  const [templates, setTemplates] = useState<QualityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/quality-templates");
      const data = await res.json();
      setTemplates(data);
    } catch (error) {
      console.error("Error fetching quality templates:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const toggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      await fetch(`/api/quality-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      fetchTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
    } finally {
      setTogglingId(null);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this quality template? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/quality-templates/${id}`, { method: "DELETE" });
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting quality template:", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{templates.length} templates</Badge>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} className="mr-1" />
          New Template
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No quality templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-center">Header Fields</TableHead>
                <TableHead className="text-center">Row Fields</TableHead>
                <TableHead className="text-center">Default Rows</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">
                    {t.templateId}
                  </TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell className="text-center">
                    {t.headerFields.length}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.rowFields.length}
                  </TableCell>
                  <TableCell className="text-center">
                    {t.defaultRowCount}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={t.active ? "default" : "secondary"}>
                      {t.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActive(t.id, t.active)}
                        disabled={togglingId === t.id}
                        title={t.active ? "Deactivate" : "Activate"}
                      >
                        {togglingId === t.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : t.active ? (
                          <ToggleRight size={16} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={16} />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => deleteTemplate(t.id)}
                        disabled={deletingId === t.id}
                      >
                        {deletingId === t.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <QualityTemplateBuilderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchTemplates}
      />
    </div>
  );
}
