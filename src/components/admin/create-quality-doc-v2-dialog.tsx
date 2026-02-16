"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QualityTemplate } from "@/lib/schemas";

interface CreateQualityDocV2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateQualityDocV2Dialog({
  open,
  onOpenChange,
  onCreated,
}: CreateQualityDocV2DialogProps) {
  const [templates, setTemplates] = useState<QualityTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [rowCount, setRowCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setLoadingTemplates(true);
      fetch("/api/quality-templates?active=true")
        .then((res) => res.json())
        .then((data) => setTemplates(data))
        .catch(() => {})
        .finally(() => setLoadingTemplates(false));
    }
  }, [open]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    if (selectedTemplate) {
      setRowCount(String(selectedTemplate.defaultRowCount));
    }
  }, [selectedTemplate]);

  const handleSubmit = async () => {
    setError("");

    if (!selectedTemplateId) {
      setError("Please select a template");
      return;
    }

    const count = parseInt(rowCount);
    if (isNaN(count) || count < 1) {
      setError("Row count must be at least 1");
      return;
    }

    if (selectedTemplate?.minRowCount && count < selectedTemplate.minRowCount) {
      setError(`Minimum ${selectedTemplate.minRowCount} rows required`);
      return;
    }
    if (selectedTemplate?.maxRowCount && count > selectedTemplate.maxRowCount) {
      setError(`Maximum ${selectedTemplate.maxRowCount} rows allowed`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/quality/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          rowCount: count,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create document");
      }

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedTemplateId("");
    setRowCount("");
    setError("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Quality Document (V2)</DialogTitle>
          <DialogDescription>
            Create a quality document from a template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label className="text-xs">Template *</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 size={14} className="animate-spin" />
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active templates. Create one in Admin &gt; Q. Templates.
              </p>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedTemplate && (
            <>
              {selectedTemplate.description && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  {selectedTemplate.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{selectedTemplate.headerFields.length} header fields, {selectedTemplate.rowFields.length} row fields</p>
                {selectedTemplate.minRowCount && <p>Min rows: {selectedTemplate.minRowCount}</p>}
                {selectedTemplate.maxRowCount && <p>Max rows: {selectedTemplate.maxRowCount}</p>}
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Number of Rows *</Label>
            <Input
              type="number"
              min="1"
              value={rowCount}
              onChange={(e) => setRowCount(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || templates.length === 0}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : null}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
