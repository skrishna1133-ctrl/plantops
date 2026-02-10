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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  checklistTypes,
  checklistTypeLabels,
  type ChecklistTemplate,
  type ChecklistType,
} from "@/lib/schemas";
import TemplateBuilderDialog from "./template-builder-dialog";

export default function ChecklistTemplatesTab() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      params.set("active", "false");
      const res = await fetch(`/api/checklists/templates?${params}`);
      const data = await res.json();
      setTemplates(data);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const toggleActive = async (id: string, currentActive: boolean) => {
    setTogglingId(id);
    try {
      await fetch(`/api/checklists/templates/${id}`, {
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
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/checklists/templates/${id}`, { method: "DELETE" });
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {checklistTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {checklistTypeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{templates.length} templates</Badge>
        </div>
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
          <p>No templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {checklistTypeLabels[t.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {t.items.length}
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

      <TemplateBuilderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchTemplates}
      />
    </div>
  );
}
