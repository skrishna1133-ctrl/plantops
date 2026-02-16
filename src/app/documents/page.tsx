"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  FileText,
  FolderOpen,
  ArrowLeft,
  Plus,
  Upload,
  Trash2,
  Download,
  RotateCcw,
  LogOut,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import type { DocumentFolder, InstructionDocument } from "@/lib/schemas";
import { userRoleLabels } from "@/lib/schemas";
import type { UserRole } from "@/lib/schemas";
import CreateFolderDialog from "@/components/documents/create-folder-dialog";
import UploadDocumentDialog from "@/components/documents/upload-document-dialog";

export default function DocumentsPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [docs, setDocs] = useState<InstructionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const isEditor = ["admin", "owner", "engineer"].includes(userRole);
  const isAdmin = ["admin", "owner"].includes(userRole);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFolderId) params.set("folderId", selectedFolderId);

      const [foldersRes, docsRes] = await Promise.all([
        fetch("/api/documents/folders"),
        fetch(`/api/documents?${params}`),
      ]);

      const foldersData = await foldersRes.json();
      const docsData = await docsRes.json();
      setFolders(Array.isArray(foldersData) ? foldersData : []);
      setDocs(Array.isArray(docsData) ? docsData : []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push("/login?from=/documents");
          return;
        }
        setUserRole(data.role || "");
        setUserName(data.fullName || "");
      })
      .catch(() => router.push("/login?from=/documents"));
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDeletingDocId(id);
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Error deleting document:", error);
    } finally {
      setDeletingDocId(null);
    }
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("Delete this folder? It must be empty.")) return;
    setDeletingFolderId(id);
    try {
      const res = await fetch(`/api/documents/folders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete folder");
      } else {
        if (selectedFolderId === id) setSelectedFolderId(null);
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
    } finally {
      setDeletingFolderId(null);
    }
  };

  const renameFolder = async (id: string) => {
    if (renameValue.trim().length < 2) return;
    try {
      const res = await fetch(`/api/documents/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        setRenamingFolderId(null);
        setRenameValue("");
        fetchData();
      }
    } catch (error) {
      console.error("Error renaming folder:", error);
    }
  };

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const filteredDocs = selectedFolderId
    ? docs.filter((d) => d.folderId === selectedFolderId)
    : docs;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft size={20} />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center">
              <FileText className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Documents</h1>
              <p className="text-xs text-muted-foreground">
                {userName ? `Hi, ${userName} — ` : ""}Instructions & SOPs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-400"
            >
              <LogOut size={14} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Action buttons */}
        {isEditor && (
          <div className="flex gap-2">
            <Button onClick={() => setUploadOpen(true)} className="flex-1">
              <Upload size={16} className="mr-2" />
              Upload Document
            </Button>
            <Button
              onClick={() => setCreateFolderOpen(true)}
              variant="outline"
            >
              <Plus size={16} className="mr-2" />
              New Folder
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : (
          <>
            {/* Folder navigation */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Folders
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedFolderId === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFolderId(null)}
                >
                  All Documents
                </Button>
                {folders.map((folder) => (
                  <div key={folder.id} className="flex items-center gap-1">
                    {renamingFolderId === folder.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 w-40"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameFolder(folder.id);
                            if (e.key === "Escape") {
                              setRenamingFolderId(null);
                              setRenameValue("");
                            }
                          }}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => renameFolder(folder.id)}>
                          Save
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant={selectedFolderId === folder.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedFolderId(folder.id)}
                        >
                          <FolderOpen size={14} className="mr-1" />
                          {folder.name}
                        </Button>
                        {isEditor && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setRenamingFolderId(folder.id);
                              setRenameValue(folder.name);
                            }}
                          >
                            <Pencil size={12} />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => deleteFolder(folder.id)}
                            disabled={deletingFolderId === folder.id}
                          >
                            {deletingFolderId === folder.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Documents list */}
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">
                  {selectedFolder
                    ? `No documents in "${selectedFolder.name}"`
                    : "No documents yet"}
                </p>
                {isEditor && (
                  <p className="text-sm mt-1">Upload one using the button above.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {selectedFolder ? selectedFolder.name : "All Documents"} ({filteredDocs.length})
                </h2>
                <div className="space-y-2">
                  {filteredDocs.map((doc) => (
                    <Card key={doc.id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <p className="font-medium">{doc.title}</p>
                            {doc.description && (
                              <p className="text-sm text-muted-foreground">{doc.description}</p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {doc.folderName}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {doc.fileName} — {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              {doc.allowedRoles.map((role) => (
                                <Badge key={role} variant="secondary" className="text-[10px]">
                                  {userRoleLabels[role as UserRole] || role}
                                </Badge>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Uploaded by {doc.uploadedBy} — {new Date(doc.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="View PDF">
                                <Download size={14} />
                              </Button>
                            </a>
                            {doc.previousFileUrl && (
                              <a href={doc.previousFileUrl} target="_blank" rel="noopener noreferrer">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Previous version"
                                >
                                  <RotateCcw size={14} />
                                </Button>
                              </a>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300"
                                onClick={() => deleteDoc(doc.id)}
                                disabled={deletingDocId === doc.id}
                              >
                                {deletingDocId === doc.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onCreated={fetchData}
      />

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onCreated={fetchData}
        folders={folders}
        preselectedFolderId={selectedFolderId || undefined}
      />
    </div>
  );
}
