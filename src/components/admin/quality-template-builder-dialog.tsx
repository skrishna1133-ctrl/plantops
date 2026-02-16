"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, GripVertical, Calculator } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  qualityFieldTypes,
  qualityFieldTypeLabels,
  qualityFieldStages,
  type QualityFieldType,
  type QualityFieldStage,
} from "@/lib/schemas";

interface QualityTemplateBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface DraftField {
  label: string;
  type: QualityFieldType;
  stage: QualityFieldStage;
  required: boolean;
  description: string;
  unit: string;
  numericMin: string;
  numericMax: string;
  decimalPlaces: string;
  formula: string;
  defaultValue: string;
}

const emptyField: DraftField = {
  label: "",
  type: "text",
  stage: "worker",
  required: false,
  description: "",
  unit: "",
  numericMin: "",
  numericMax: "",
  decimalPlaces: "",
  formula: "",
  defaultValue: "",
};

const stageLabels: Record<QualityFieldStage, string> = {
  worker: "Worker",
  quality_tech: "Quality Tech",
};

const stageColors: Record<QualityFieldStage, string> = {
  worker: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  quality_tech: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function QualityTemplateBuilderDialog({
  open,
  onOpenChange,
  onCreated,
}: QualityTemplateBuilderDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [defaultRowCount, setDefaultRowCount] = useState("1");
  const [minRowCount, setMinRowCount] = useState("");
  const [maxRowCount, setMaxRowCount] = useState("");
  const [headerFields, setHeaderFields] = useState<DraftField[]>([]);
  const [rowFields, setRowFields] = useState<DraftField[]>([{ ...emptyField }]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (
    context: "header" | "row",
    index: number,
    field: keyof DraftField,
    value: string | boolean
  ) => {
    const setter = context === "header" ? setHeaderFields : setRowFields;
    setter((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addField = (context: "header" | "row") => {
    const setter = context === "header" ? setHeaderFields : setRowFields;
    setter((prev) => [...prev, { ...emptyField }]);
  };

  const removeField = (context: "header" | "row", index: number) => {
    const fields = context === "header" ? headerFields : rowFields;
    if (context === "row" && fields.length <= 1) return;
    const setter = context === "header" ? setHeaderFields : setRowFields;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (title.length < 3) {
      newErrors.title = "Title must be at least 3 characters";
    }

    const allFields = [
      ...headerFields.map((f, i) => ({ ...f, context: "header" as const, index: i })),
      ...rowFields.map((f, i) => ({ ...f, context: "row" as const, index: i })),
    ];

    if (allFields.length === 0) {
      newErrors.fields = "At least one field is required";
    }

    for (const field of allFields) {
      const key = `${field.context}_${field.index}`;
      if (field.label.length < 1) {
        newErrors[`${key}_label`] = "Label is required";
      }
      if (field.type === "calculated" && !field.formula.trim()) {
        newErrors[`${key}_formula`] = "Formula is required for calculated fields";
      }
    }

    const defaultCount = parseInt(defaultRowCount);
    if (isNaN(defaultCount) || defaultCount < 1) {
      newErrors.defaultRowCount = "Must be at least 1";
    }

    if (minRowCount && (isNaN(parseInt(minRowCount)) || parseInt(minRowCount) < 1)) {
      newErrors.minRowCount = "Must be a positive number";
    }

    if (maxRowCount && (isNaN(parseInt(maxRowCount)) || parseInt(maxRowCount) < 1)) {
      newErrors.maxRowCount = "Must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildFieldPayload = (field: DraftField) => {
    const payload: Record<string, unknown> = {
      label: field.label,
      type: field.type,
      stage: field.stage,
      required: field.required,
    };
    if (field.description) payload.description = field.description;
    if (field.unit) payload.unit = field.unit;
    if (field.type === "numeric" || field.type === "calculated") {
      if (field.numericMin) payload.numericMin = parseFloat(field.numericMin);
      if (field.numericMax) payload.numericMax = parseFloat(field.numericMax);
      if (field.decimalPlaces) payload.decimalPlaces = parseInt(field.decimalPlaces);
    }
    if (field.type === "calculated" && field.formula) {
      payload.formula = field.formula;
    }
    if (field.defaultValue) {
      if (field.type === "numeric") {
        payload.defaultValue = parseFloat(field.defaultValue);
      } else if (field.type === "checkbox") {
        payload.defaultValue = field.defaultValue === "true";
      } else {
        payload.defaultValue = field.defaultValue;
      }
    }
    return payload;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    try {
      const payload = {
        title,
        description: description || undefined,
        defaultRowCount: parseInt(defaultRowCount),
        minRowCount: minRowCount ? parseInt(minRowCount) : undefined,
        maxRowCount: maxRowCount ? parseInt(maxRowCount) : undefined,
        headerFields: headerFields.map(buildFieldPayload),
        rowFields: rowFields.map(buildFieldPayload),
      };

      const res = await fetch("/api/quality-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create template");
      }

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create template. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDefaultRowCount("1");
    setMinRowCount("");
    setMaxRowCount("");
    setHeaderFields([]);
    setRowFields([{ ...emptyField }]);
    setErrors({});
  };

  const renderFieldCard = (
    field: DraftField,
    context: "header" | "row",
    index: number,
    total: number
  ) => {
    const key = `${context}_${index}`;
    return (
      <div
        key={key}
        className="border border-border rounded-lg p-4 space-y-3 bg-muted/30"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GripVertical size={14} />
            <span className="text-xs font-medium">
              {context === "header" ? "Header" : "Row"} Field {index + 1}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className={stageColors[field.stage]}>
              {stageLabels[field.stage]}
            </Badge>
            {(context === "header" || total > 1) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:text-red-300"
                onClick={() => removeField(context, index)}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>

        {/* Label + Type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Label *</Label>
            <Input
              placeholder="e.g. Gross Weight"
              value={field.label}
              onChange={(e) => updateField(context, index, "label", e.target.value)}
            />
            {errors[`${key}_label`] && (
              <p className="text-xs text-red-500">{errors[`${key}_label`]}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={field.type}
              onValueChange={(v) => updateField(context, index, "type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualityFieldTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {qualityFieldTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stage + Required */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Filled by</Label>
            <Select
              value={field.stage}
              onValueChange={(v) => updateField(context, index, "stage", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {qualityFieldStages.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              placeholder="Optional description"
              value={field.description}
              onChange={(e) => updateField(context, index, "description", e.target.value)}
            />
          </div>
        </div>

        {/* Numeric-specific fields */}
        {(field.type === "numeric" || field.type === "calculated") && (
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Unit</Label>
              <Input
                placeholder="e.g. lbs"
                value={field.unit}
                onChange={(e) => updateField(context, index, "unit", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min</Label>
              <Input
                type="number"
                placeholder="—"
                value={field.numericMin}
                onChange={(e) => updateField(context, index, "numericMin", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max</Label>
              <Input
                type="number"
                placeholder="—"
                value={field.numericMax}
                onChange={(e) => updateField(context, index, "numericMax", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Decimals</Label>
              <Input
                type="number"
                placeholder="—"
                value={field.decimalPlaces}
                onChange={(e) => updateField(context, index, "decimalPlaces", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Formula for calculated fields */}
        {field.type === "calculated" && (
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Calculator size={12} />
              Formula *
            </Label>
            <Input
              placeholder="e.g. {gross_weight} - {header.tare_weight}"
              value={field.formula}
              onChange={(e) => updateField(context, index, "formula", e.target.value)}
              className="font-mono text-sm"
            />
            {errors[`${key}_formula`] && (
              <p className="text-xs text-red-500">{errors[`${key}_formula`]}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Use {"{fieldId}"} for row fields, {"{header.fieldId}"} for header fields. Supports: + - * / ( )
            </p>
          </div>
        )}

        {/* Default value for non-calculated */}
        {field.type !== "calculated" && field.type !== "photo" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Default Value</Label>
              <Input
                placeholder="Optional"
                value={field.defaultValue}
                onChange={(e) => updateField(context, index, "defaultValue", e.target.value)}
              />
            </div>
            {field.type === "numeric" && (
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input
                  placeholder="e.g. lbs"
                  value={field.unit}
                  onChange={(e) => updateField(context, index, "unit", e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Required checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`${key}_required`}
            checked={field.required}
            onChange={(e) => updateField(context, index, "required", e.target.checked)}
            className="rounded"
          />
          <Label htmlFor={`${key}_required`} className="text-xs cursor-pointer">
            Required
          </Label>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {qualityFieldTypeLabels[field.type]}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Quality Template</DialogTitle>
          <DialogDescription>
            Define a quality document template with header fields and row fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Template Title *</Label>
              <Input
                placeholder="e.g. Bulk Material Quality Inspection"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {errors.title && (
                <p className="text-xs text-red-500">{errors.title}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                placeholder="Optional description for this template"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Row Count Settings */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Row Settings</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Default Rows *</Label>
                <Input
                  type="number"
                  min="1"
                  value={defaultRowCount}
                  onChange={(e) => setDefaultRowCount(e.target.value)}
                />
                {errors.defaultRowCount && (
                  <p className="text-xs text-red-500">{errors.defaultRowCount}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Rows</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="—"
                  value={minRowCount}
                  onChange={(e) => setMinRowCount(e.target.value)}
                />
                {errors.minRowCount && (
                  <p className="text-xs text-red-500">{errors.minRowCount}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Rows</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="—"
                  value={maxRowCount}
                  onChange={(e) => setMaxRowCount(e.target.value)}
                />
                {errors.maxRowCount && (
                  <p className="text-xs text-red-500">{errors.maxRowCount}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Header Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Header Fields</Label>
                <p className="text-xs text-muted-foreground">
                  Document-level fields (e.g. PO Number, Material Code, Tare Weight)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addField("header")}
              >
                <Plus size={14} className="mr-1" />
                Add
              </Button>
            </div>

            {headerFields.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                No header fields. Click &quot;Add&quot; to create document-level fields.
              </div>
            ) : (
              <div className="space-y-3">
                {headerFields.map((field, index) =>
                  renderFieldCard(field, "header", index, headerFields.length)
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Row Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Row Fields</Label>
                <p className="text-xs text-muted-foreground">
                  Per-row repeating fields (e.g. Gross Weight, Net Weight, Bulk Density)
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addField("row")}
              >
                <Plus size={14} className="mr-1" />
                Add
              </Button>
            </div>

            {errors.fields && (
              <p className="text-xs text-red-500">{errors.fields}</p>
            )}

            <div className="space-y-3">
              {rowFields.map((field, index) =>
                renderFieldCard(field, "row", index, rowFields.length)
              )}
            </div>
          </div>

          <Separator />

          {/* Actions */}
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
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : null}
              Create Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
