"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, AlertTriangle, History, Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Procedure {
  id: string; title: string; machineTypeName?: string;
  currentRevision: number; content?: string; safetyWarnings?: string;
}

interface Revision {
  id: string; revisionNumber: number; content: string | null;
  safetyWarnings?: string | null; pdfUrl?: string | null; pdfFilename?: string | null;
  isCurrent: boolean; createdAt: string;
}

export default function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRevise, setShowRevise] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reviseForm, setReviseForm] = useState({ content: "", safetyWarnings: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);

  const isManager = ["maintenance_manager", "engineer", "admin", "owner"].includes(role);

  const fetchData = useCallback(async () => {
    const [pRes, rRes] = await Promise.all([
      fetch(`/api/maintenance/procedures/${id}`),
      fetch(`/api/maintenance/procedures/${id}/revisions`),
    ]);
    if (pRes.ok) {
      const p = await pRes.json();
      setProcedure(p);
      setReviseForm({ content: p.content || "", safetyWarnings: p.safetyWarnings || "" });
    }
    if (rRes.ok) setRevisions(await rRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch("/api/auth").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.authenticated) { router.push("/login"); return; }
      setRole(d.role);
      fetchData();
    });
  }, [router, fetchData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setPdfUploadError("Only PDF files are allowed."); return; }
    if (file.size > 20 * 1024 * 1024) { setPdfUploadError("File too large (max 20MB)."); return; }
    setPdfUploadError("");
    setPdfFile(file);
  };

  const clearPdf = () => {
    setPdfFile(null);
    setPdfUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const revise = async () => {
    if (!reviseForm.content && !pdfFile) return;
    setSaving(true);

    let pdfUrl: string | null = null;
    let pdfFilename: string | null = null;

    if (pdfFile) {
      setPdfUploading(true);
      const formData = new FormData();
      formData.append("file", pdfFile);
      const uploadRes = await fetch("/api/maintenance/procedures/upload", { method: "POST", body: formData });
      setPdfUploading(false);
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        setPdfUploadError(err.error || "Upload failed.");
        setSaving(false);
        return;
      }
      const uploaded = await uploadRes.json();
      pdfUrl = uploaded.url;
      pdfFilename = uploaded.filename;
    }

    const res = await fetch(`/api/maintenance/procedures/${id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reviseForm.content || null, safetyWarnings: reviseForm.safetyWarnings || null, pdfUrl, pdfFilename }),
    });
    if (res.ok) { setShowRevise(false); clearPdf(); setReviseForm({ content: "", safetyWarnings: "" }); fetchData(); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!procedure) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Procedure not found</div>;

  const displayRevision = selectedRevision || (revisions.find(r => r.isCurrent) ?? null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/maintenance/procedures"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
            <div>
              <h1 className="text-lg font-bold">{procedure.title}</h1>
              <p className="text-xs text-muted-foreground">{procedure.machineTypeName} • Rev {procedure.currentRevision}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isManager && (
              <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
                <History size={14} className="mr-1" />History
              </Button>
            )}
            {isManager && (
              <Button size="sm" onClick={() => setShowRevise(true)}>
                <Edit size={14} className="mr-1" />New Revision
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {selectedRevision && !selectedRevision.isCurrent && (
          <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Viewing archived revision {selectedRevision.revisionNumber}</p>
            <Button variant="ghost" size="sm" onClick={() => setSelectedRevision(null)}>View Current</Button>
          </div>
        )}

        {displayRevision?.safetyWarnings && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-1">Safety Warnings</p>
                  <p className="text-sm whitespace-pre-wrap">{displayRevision.safetyWarnings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PDF Viewer */}
        {displayRevision?.pdfUrl && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={16} className="text-red-500" />
                Procedure Document
                {displayRevision.pdfFilename && (
                  <span className="text-xs font-normal text-muted-foreground">{displayRevision.pdfFilename}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                src={displayRevision.pdfUrl}
                className="w-full rounded-b-lg border-0"
                style={{ height: "75vh", minHeight: "500px" }}
                title="Procedure PDF"
              />
            </CardContent>
          </Card>
        )}

        {/* Text / Notes Content */}
        {displayRevision?.content && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {displayRevision.pdfUrl ? "Additional Notes" : "Procedure Content"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{displayRevision.content}</pre>
            </CardContent>
          </Card>
        )}

        {!displayRevision?.pdfUrl && !displayRevision?.content && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-sm">No content available for this revision.</CardContent>
          </Card>
        )}
      </main>

      {/* Revise Dialog */}
      <Dialog open={showRevise} onOpenChange={(open) => { setShowRevise(open); if (!open) clearPdf(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Create New Revision (Rev {procedure.currentRevision + 1})</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* PDF Upload */}
            <div>
              <Label>Procedure PDF <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="mt-1.5">
                {pdfFile ? (
                  <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-muted/30">
                    <FileText size={16} className="text-red-500 shrink-0" />
                    <span className="text-sm flex-1 truncate">{pdfFile.name}</span>
                    <span className="text-xs text-muted-foreground">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={clearPdf}>
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-muted/20 transition-colors text-muted-foreground"
                  >
                    <Upload size={20} />
                    <span className="text-sm">Click to upload PDF (max 20MB)</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
                {pdfUploadError && <p className="text-xs text-destructive mt-1">{pdfUploadError}</p>}
              </div>
            </div>

            <div>
              <Label>Notes / Additional Instructions <span className="text-muted-foreground text-xs">(optional if PDF uploaded)</span></Label>
              <Textarea className="mt-1.5 font-mono text-sm" rows={8} value={reviseForm.content} onChange={e => setReviseForm(f => ({ ...f, content: e.target.value }))} placeholder="Step-by-step instructions or notes..." />
            </div>
            <div>
              <Label>Safety Warnings</Label>
              <Textarea className="mt-1.5" rows={3} value={reviseForm.safetyWarnings} onChange={e => setReviseForm(f => ({ ...f, safetyWarnings: e.target.value }))} placeholder="Any safety precautions..." />
            </div>
            <p className="text-xs text-muted-foreground">⚠️ Creating a new revision will archive the current one and notify technicians with open work orders.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowRevise(false); clearPdf(); }}>Cancel</Button>
              <Button onClick={revise} disabled={saving || pdfUploading || (!reviseForm.content && !pdfFile)}>
                {pdfUploading ? "Uploading PDF..." : saving ? "Saving..." : "Publish Revision"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revision History</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {revisions.map(r => (
              <div
                key={r.id}
                className={`p-3 rounded-lg border cursor-pointer hover:bg-muted ${selectedRevision?.id === r.id ? "border-primary" : "border-border"}`}
                onClick={() => { setSelectedRevision(r); setShowHistory(false); }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Revision {r.revisionNumber}</span>
                    {r.pdfUrl && <FileText size={12} className="text-red-500" />}
                  </div>
                  {r.isCurrent ? <Badge variant="secondary">Current</Badge> : <Badge variant="outline">Archived</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
