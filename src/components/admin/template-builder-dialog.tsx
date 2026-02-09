"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
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
  checklistTypes,
  checklistTypeLabels,
  itemTypes,
  itemTypeLabels,
  type ChecklistType,
  type ItemType,
  type TemplateItem,
} from "@/lib/schemas";

interface TemplateBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface DraftItem {
  title: string;
  type: ItemType;
  description: string;
  required: boolean;
  unit: string;
  numericMin: string;
  numericMax: string;
}

const emptyItem: DraftItem = {
  title: "",
  type: "checkbox",
  description: "",
  required: true,
  unit: "",
  numericMin: "",
  numericMax: "",
};

export default function TemplateBuilderDialog({
  open,
  onOpenChange,
  onCreated,
}: TemplateBuilderDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ChecklistType | "">("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setTitle("");
    setType("");
    setDescription("");
    setItems([{ ...emptyItem }]);
    setErrors({});
  };

  const addItem = () => {
    setItems([...items, { ...emptyItem }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof DraftItem, value: string | boolean) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (title.length < 3) newErrors.title = "Title must be at least 3 characters";
    if (!type) newErrors.type = "Please select a type";
    items.forEach((item, i) => {
      if (item.title.length < 3) newErrors[`item_${i}`] = "Item title must be at least 3 characters";
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    try {
      const payload = {
        title,
        type,
        description: description || undefined,
        items: items.map((item) => {
          const templateItem: Omit<TemplateItem, "id"> = {
            title: item.title,
            type: item.type,
            required: item.required,
          };
          if (item.description) templateItem.description = item.description;
          if (item.type === "numeric") {
            if (item.unit) templateItem.unit = item.unit;
            if (item.numericMin) templateItem.numericMin = Number(item.numericMin);
            if (item.numericMax) templateItem.numericMax = Number(item.numericMax);
          }
          return templateItem;
        }),
      };

      const res = await fetch("/api/checklists/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create template");

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (error) {
      console.error("Error creating template:", error);
      alert("Failed to create template. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Checklist Template</DialogTitle>
          <DialogDescription>
            Define a checklist with items that workers will complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Template Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Title *</Label>
              <Input
                placeholder="e.g., Morning Shift Safety Checklist"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={type} onValueChange={(v) => setType(v as ChecklistType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {checklistTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {checklistTypeLabels[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Brief description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={1}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Checklist Items ({items.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus size={14} className="mr-1" />
                Add Item
              </Button>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="border border-border rounded-lg p-4 space-y-3 bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical size={14} />
                    <span className="text-xs font-medium">Item {index + 1}</span>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-300"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Title *</Label>
                    <Input
                      placeholder="e.g., Fire extinguisher checked"
                      value={item.title}
                      onChange={(e) => updateItem(index, "title", e.target.value)}
                    />
                    {errors[`item_${index}`] && (
                      <p className="text-xs text-red-500">{errors[`item_${index}`]}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={item.type}
                      onValueChange={(v) => updateItem(index, "type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {itemTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {itemTypeLabels[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description / Hint (Optional)</Label>
                  <Input
                    placeholder="Instructions for this item..."
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                  />
                </div>

                {item.type === "numeric" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Input
                        placeholder="e.g., °C, PSI"
                        value={item.unit}
                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Min</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={item.numericMin}
                        onChange={(e) => updateItem(index, "numericMin", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={item.numericMax}
                        onChange={(e) => updateItem(index, "numericMax", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => updateItem(index, "required", e.target.checked)}
                    className="rounded"
                    id={`required_${index}`}
                  />
                  <Label htmlFor={`required_${index}`} className="text-xs cursor-pointer">
                    Required
                  </Label>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {itemTypeLabels[item.type]}
                  </Badge>
                </div>
              </div>
            ))}
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
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Creating...
                </>
              ) : (
                "Create Template"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
