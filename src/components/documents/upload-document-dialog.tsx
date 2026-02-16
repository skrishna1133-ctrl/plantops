"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DocumentFolder, UserRole } from "@/lib/schemas";
import { userRoles, userRoleLabels } from "@/lib/schemas";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const assignableRoles: UserRole[] = ["worker", "quality_tech", "engineer", "shipping"];

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  folders: DocumentFolder[];
  preselectedFolderId?: string;
}

export default function UploadDocumentDialog({
  open,
  onOpenChange,
  onCreated,
  folders,
  preselectedFolderId,
}: UploadDocumentDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && preselectedFolderId) {
      setFolderId(preselectedFolderId);
    }
  }, [open, preselectedFolderId]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFolderId(preselectedFolderId || "");
    setSelectedRoles([]);
    setFile(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.type !== "application/pdf") {
      setError("Only PDF files are allowed");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError("File size must be under 10MB");
      return;
    }
    setError("");
    setFile(f);
  };

  const handleSubmit = async () => {
    setError("");

    if (!file) {
      setError("Please select a PDF file");
      return;
    }
    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters");
      return;
    }
    if (!folderId) {
      setError("Please select a folder");
      return;
    }
    if (selectedRoles.length === 0) {
      setError("Select at least one role that can access this document");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("folderId", folderId);
      formData.append("description", description.trim());
      formData.append("allowedRoles", JSON.stringify(selectedRoles));

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload document");
      }

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a PDF and choose who can access it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <Label>PDF File</Label>
            {file ? (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X size={12} />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select a PDF file</p>
                <p className="text-xs text-muted-foreground mt-1">Max 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="doc-desc">Description (optional)</Label>
            <Input
              id="doc-desc"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Folder */}
          <div className="space-y-2">
            <Label>Folder</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Allowed Roles */}
          <div className="space-y-2">
            <Label>Who can access this document?</Label>
            <div className="flex flex-wrap gap-2">
              {assignableRoles.map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant={selectedRoles.includes(role) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleRole(role)}
                >
                  {userRoleLabels[role]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Admin and Owner always have access.
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 size={14} className="mr-2 animate-spin" />}
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
